using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Npgsql;
using SolarWatch.Api;
using SolarWatch.Application;
using SolarWatch.Domain;
using SolarWatch.Infrastructure;
using Xunit.Abstractions;

namespace SolarWatch.IntegrationTests;

// Tests in this class run sequentially and clear only the explicitly configured *_tests database.
public partial class LatestReadingTests : IAsyncLifetime
{
    private readonly ITestOutputHelper testOutput;
    public LatestReadingTests(ITestOutputHelper testOutput) => this.testOutput = testOutput;
    private static readonly DateTimeOffset Now = DateTimeOffset.Parse("2026-10-01T12:00:00Z");
    private string connection = null!;
    private WebApplicationFactory<Program> factory = null!;
    private SolarWatchDbContext OpenDb() => new(new DbContextOptionsBuilder<SolarWatchDbContext>().UseNpgsql(connection).Options);

    public async Task InitializeAsync()
    {
        connection = Environment.GetEnvironmentVariable("SOLARWATCH_TEST_CONNECTION")
            ?? throw new InvalidOperationException("Set SOLARWATCH_TEST_CONNECTION to a real PostgreSQL database ending in _tests. Integration tests are never skipped.");
        if (new NpgsqlConnectionStringBuilder(connection).Database?.EndsWith("_tests", StringComparison.Ordinal) != true)
            throw new InvalidOperationException("Integration tests require a dedicated database ending in _tests.");
        await using var db = OpenDb();
        await db.Database.MigrateAsync();
        await db.Readings.ExecuteDeleteAsync();
        factory = CreateFactory(connection);
    }

    private static WebApplicationFactory<Program> CreateFactory(string connectionString,
        string environment = "Development", string remote = "127.0.0.1", TimeProvider? serverClock = null) =>
        new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment(environment);
            builder.UseSetting("ConnectionStrings:SolarWatch", connectionString);
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<TimeProvider>();
                services.AddSingleton<TimeProvider>(serverClock ?? new FixedClock());
                services.AddSingleton<IStartupFilter>(new RemoteAddressFilter(remote));
            });
        });

    public async Task DisposeAsync()
    {
        if (factory is not null) await factory.DisposeAsync();
    }

    [Fact]
    public async Task Empty_database_returns_null_and_server_time_without_caching()
    {
        var response = await factory.CreateClient().GetAsync("/api/readings/latest");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(response.Headers.CacheControl?.NoStore);
        var result = await response.Content.ReadFromJsonAsync<LatestReadingResponse>();
        Assert.NotNull(result);
        Assert.Null(result.Reading);
        Assert.Equal(Now, result.AsOf);
    }

    [Fact]
    public async Task Selects_latest_measurement_not_insertion_order_and_survives_host_restart()
    {
        await using (var db = OpenDb())
        {
            db.Readings.Add(InstallationReading.Create(Now.AddMinutes(-1), 1200, 800, 65, Now));
            await db.SaveChangesAsync();
            db.Readings.Add(InstallationReading.Create(Now.AddHours(-1), 400, 500, 30, Now));
            await db.SaveChangesAsync();
        }
        var first = await factory.CreateClient().GetFromJsonAsync<LatestReadingResponse>("/api/readings/latest");
        Assert.Equal(new ReadingSnapshot("residential-demo", Now.AddMinutes(-1), 1200, 800, 65), first?.Reading);
        await factory.DisposeAsync();
        factory = CreateFactory(connection);
        var afterRestart = await factory.CreateClient().GetFromJsonAsync<LatestReadingResponse>("/api/readings/latest");
        Assert.Equal(first, afterRestart);
    }

    [Fact]
    public async Task Applied_migration_matches_model_and_database_rejects_invalid_values()
    {
        await using var db = OpenDb();
        Assert.False(db.Database.HasPendingModelChanges());
        Assert.NotEmpty(await db.Database.GetAppliedMigrationsAsync());
        var error = await Assert.ThrowsAsync<PostgresException>(() => db.Database.ExecuteSqlRawAsync(
            "INSERT INTO readings (\"InstallationId\", \"MeasuredAt\", \"SolarPowerW\", \"ConsumptionPowerW\", \"BatteryStateOfChargePercent\") VALUES ('residential-demo', '2026-10-01T12:00:00Z', -1, 800, 65)"));
        Assert.Equal(PostgresErrorCodes.CheckViolation, error.SqlState);
        Assert.Equal(0, await db.Readings.CountAsync());
    }

    [Fact]
    public async Task Unavailable_database_returns_a_problem_not_an_empty_result()
    {
        var unavailable = new NpgsqlConnectionStringBuilder(connection) { Port = 1, Timeout = 1 };
        await using var brokenHost = CreateFactory(unavailable.ConnectionString);
        var response = await brokenHost.CreateClient().GetAsync("/api/readings/latest");
        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        Assert.DoesNotContain("Password", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Development_seed_uses_current_clock_accepts_controlled_time_and_is_repeatable()
    {
        await using var app = CommandApp("Development");
        Assert.Equal(0, await DevelopmentCommands.RunAsync(app, ["seed-demo"]));
        Assert.Equal(0, await DevelopmentCommands.RunAsync(app, ["seed-demo"]));
        Assert.Equal(0, await DevelopmentCommands.RunAsync(app, ["seed-demo", "--measured-at", "2026-10-01T07:00:00-04:00"]));
        await using var db = OpenDb();
        Assert.Equal(2, await db.Readings.CountAsync());
        var latest = await db.Readings.OrderByDescending(x => x.MeasuredAt).FirstAsync();
        Assert.Equal(Now, latest.MeasuredAt);
        Assert.Equal(1200, latest.SolarPowerW);
        Assert.Equal(800, latest.ConsumptionPowerW);
        Assert.Equal(65, latest.BatteryStateOfChargePercent);
        Assert.Contains(await db.Readings.ToListAsync(), x => x.MeasuredAt == Now.AddHours(-1));
    }

    [Theory]
    [InlineData("2026-10-01T12:01:00Z")]
    [InlineData("2026-10-01T11:00:00")]
    [InlineData("invalid")]
    public async Task Invalid_seed_timestamp_does_not_write(string timestamp)
    {
        await using var app = CommandApp("Development");
        Assert.Equal(1, await DevelopmentCommands.RunAsync(app, ["seed-demo", "--measured-at", timestamp]));
        await using var db = OpenDb();
        Assert.Equal(0, await db.Readings.CountAsync());
    }

    [Fact]
    public async Task Clearing_requires_confirmation_and_development_commands_reject_production()
    {
        await using var app = CommandApp("Development");
        await DevelopmentCommands.RunAsync(app, ["seed-demo"]);
        Assert.Equal(1, await DevelopmentCommands.RunAsync(app, ["clear-demo"]));
        await using var production = CommandApp("Production");
        Assert.Equal(1, await DevelopmentCommands.RunAsync(production, ["clear-demo", "--confirm"]));
        await using var db = OpenDb();
        Assert.Equal(1, await db.Readings.CountAsync());
        Assert.Equal(0, await DevelopmentCommands.RunAsync(app, ["clear-demo", "--confirm"]));
        Assert.Equal(0, await db.Readings.CountAsync());
    }

    private WebApplication CommandApp(string environment)
    {
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions { EnvironmentName = environment });
        builder.Services.AddSingleton<TimeProvider>(new FixedClock());
        builder.Services.AddDbContext<SolarWatchDbContext>(options => options.UseNpgsql(connection));
        return builder.Build();
    }

    private sealed class FixedClock : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => Now;
    }

    private sealed class RemoteAddressFilter(string remote) : IStartupFilter
    {
        public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
        {
            app.Use(async (context, continuation) =>
            {
                context.Connection.RemoteIpAddress = IPAddress.Parse(remote);
                await continuation();
            });
            next(app);
        };
    }
}
