using System.Data.Common;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using SolarWatch.Application;
using SolarWatch.Domain;
using SolarWatch.Infrastructure;

namespace SolarWatch.IntegrationTests;

// Reuse the existing fixture/class so all database-clearing integration tests remain sequential.
public partial class LatestReadingTests
{
    private static readonly DateTimeOffset HistoryNow = DateTimeOffset.Parse("2026-10-30T12:34:56.123456Z");

    [Fact]
    public async Task Empty_history_returns_explicit_inclusive_bounds_and_an_empty_array_without_caching()
    {
        using var response = await factory.CreateClient().GetAsync("/api/readings/history");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(response.Headers.CacheControl?.NoStore);
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(new[] { "asOf", "from", "to", "readings" }, json.RootElement.EnumerateObject().Select(x => x.Name));
        Assert.Equal(JsonValueKind.Array, json.RootElement.GetProperty("readings").ValueKind);
        var result = await response.Content.ReadFromJsonAsync<ReadingHistoryResponse>();
        AssertHistoryBounds(result!, Now);
        Assert.Empty(result!.Readings);
    }

    [Fact]
    public async Task Partial_history_preserves_both_microsecond_boundaries_order_zero_and_off_cadence_samples()
    {
        var from = HistoryNow.AddHours(-24);
        InstallationReading[] expected = [
            InstallationReading.Create(from, 0, 0, 0, HistoryNow),
            InstallationReading.Create(from.AddTicks(10), 1, 2, 100, HistoryNow),
            InstallationReading.Create(HistoryNow.AddHours(-11).AddSeconds(-13).AddTicks(-10), 450.25, 800.5, 42.5, HistoryNow),
            InstallationReading.Create(HistoryNow.AddTicks(-10), 1200, 800, 65, HistoryNow),
            InstallationReading.Create(HistoryNow, 2500, 1800, 99, HistoryNow)
        ];
        await using var db = OpenDb();
        // Seed via EF at a later reference so an already persisted row newer than the query can exist.
        db.Readings.AddRange(expected.Reverse());
        db.Readings.AddRange(
            InstallationReading.Create(from.AddTicks(-10), 9999, 1, 1, HistoryNow),
            InstallationReading.Create(HistoryNow.AddTicks(10), 9999, 1, 1, HistoryNow.AddDays(1)));
        await db.SaveChangesAsync();
        await using var host = CreateFactory(connection, serverClock: new HistoryClock(HistoryNow));
        var result = await host.CreateClient().GetFromJsonAsync<ReadingHistoryResponse>("/api/readings/history");
        AssertHistoryBounds(result!, HistoryNow);
        Assert.Equal(expected.Select(ReadingSnapshot.From), result!.Readings);
        Assert.Equal(7, await db.Readings.CountAsync()); // A GET must not remove excluded rows or fill gaps.
    }

    [Fact]
    public async Task Offset_reference_is_normalized_once_before_SQL_and_does_not_move_during_the_query()
    {
        var clock = new HistoryClock(DateTimeOffset.Parse("2026-10-30T08:34:56.1234567-04:00"));
        await using (var db = OpenDb())
        {
            db.Readings.AddRange(
                InstallationReading.Create(DateTimeOffset.Parse("2026-10-29T08:34:56.123456-04:00"), 0, 0, 0, HistoryNow),
                InstallationReading.Create(HistoryNow, 1, 2, 3, HistoryNow),
                InstallationReading.Create(HistoryNow.AddTicks(10), 9, 9, 9, HistoryNow.AddDays(1)));
            await db.SaveChangesAsync();
        }
        var sqlQueries = 0;
        var observer = new HistoryCommandObserver((command, _) =>
        {
            sqlQueries++;
            Assert.Equal(1, clock.Reads);
            var bounds = command.Parameters.Cast<DbParameter>().Select(x => x.Value).OfType<DateTimeOffset>().ToArray();
            Assert.Contains(HistoryNow.AddHours(-24), bounds);
            Assert.Contains(HistoryNow, bounds);
            clock.Now = HistoryNow.AddDays(1);
        });
        await using var host = CreateFactory(connection, serverClock: clock).WithWebHostBuilder(builder =>
            builder.ConfigureServices(services => services.ConfigureDbContext<SolarWatchDbContext>(options => options.AddInterceptors(observer))));
        var result = await host.CreateClient().GetFromJsonAsync<ReadingHistoryResponse>("/api/readings/history");
        AssertHistoryBounds(result!, HistoryNow);
        Assert.Equal(new[] { HistoryNow.AddHours(-24), HistoryNow }, result!.Readings.Select(x => x.MeasuredAt));
        Assert.Equal(1, clock.Reads);
        Assert.Equal(1, sqlQueries);
    }

    [Fact]
    public async Task Full_1441_sample_history_is_exact_and_additional_persisted_instants_are_not_truncated()
    {
        var from = HistoryNow.AddHours(-24);
        var samples = Enumerable.Range(0, 1441).Select(i =>
            InstallationReading.Create(from.AddMinutes(i), i * 2, i + 0.5, i % 101, HistoryNow)).ToArray();
        await using var db = OpenDb();
        db.Readings.AddRange(samples.Reverse());
        await db.SaveChangesAsync();
        await using var host = CreateFactory(connection, serverClock: new HistoryClock(HistoryNow));
        using var client = host.CreateClient();
        var result = await client.GetFromJsonAsync<ReadingHistoryResponse>("/api/readings/history");
        AssertHistoryBounds(result!, HistoryNow);
        Assert.Equal(1441, result!.Readings.Count);
        Assert.Equal(samples.Select(ReadingSnapshot.From), result.Readings);

        var extra = InstallationReading.Create(from.AddSeconds(30).AddTicks(10), 0, 7, 100, HistoryNow);
        db.Readings.Add(extra);
        await db.SaveChangesAsync();
        var expanded = await client.GetFromJsonAsync<ReadingHistoryResponse>("/api/readings/history");
        AssertHistoryBounds(expanded!, HistoryNow);
        Assert.Equal(1442, expanded!.Readings.Count);
        Assert.Equal(samples.Append(extra).OrderBy(x => x.MeasuredAt).Select(ReadingSnapshot.From), expanded.Readings);
        Assert.Equal(1442, await db.Readings.CountAsync());
    }

    [Fact]
    public async Task Unavailable_history_database_returns_sanitized_503_problem_instead_of_empty_data()
    {
        var unavailable = new NpgsqlConnectionStringBuilder(connection) { Port = 1, Timeout = 1 };
        await using var host = CreateFactory(unavailable.ConnectionString);
        using var response = await host.CreateClient().GetAsync("/api/readings/history");
        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.True(response.Headers.CacheControl?.NoStore);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var body = await response.Content.ReadAsStringAsync();
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        Assert.Equal(503, problem!.Status);
        Assert.Equal("Readings are temporarily unavailable.", problem.Title);
        Assert.Null(problem.Detail);
        using var json = JsonDocument.Parse(body);
        Assert.DoesNotContain("readings", json.RootElement.EnumerateObject().Select(x => x.Name));
        Assert.DoesNotContain("Password", body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("Npgsql", body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("ConnectionStrings", body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(connection, body, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Client_cancellation_reaches_a_real_blocked_PostgreSQL_query_and_the_host_remains_usable()
    {
        // Hold a real lock until the HTTP SELECT is waiting in PostgreSQL, then cancel the client.
        await using var blocker = new NpgsqlConnection(connection);
        await blocker.OpenAsync();
        await using var transaction = await blocker.BeginTransactionAsync();
        await using (var command = new NpgsqlCommand("LOCK TABLE readings IN ACCESS EXCLUSIVE MODE", blocker, transaction))
            await command.ExecuteNonQueryAsync();

        var started = new TaskCompletionSource<int>(TaskCreationOptions.RunContinuationsAsynchronously);
        var observer = new HistoryCommandObserver((command, token) =>
        {
            Assert.True(token.CanBeCanceled);
            started.TrySetResult(((NpgsqlConnection)command.Connection!).ProcessID);
        });
        var status = new HistoryCancellationStatus();
        await using var host = CreateFactory(connection).WithWebHostBuilder(builder =>
            builder.ConfigureServices(services =>
            {
                services.ConfigureDbContext<SolarWatchDbContext>(options => options.AddInterceptors(observer));
                services.AddSingleton<IStartupFilter>(status);
            }));
        using var client = host.CreateClient();
        using var stop = new CancellationTokenSource();
        using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        var pending = client.GetAsync("/api/readings/history", stop.Token);
        try
        {
            var processId = await started.Task.WaitAsync(deadline.Token);
            await using var monitor = new NpgsqlConnection(connection);
            await monitor.OpenAsync(deadline.Token);
            await using var waiting = new NpgsqlCommand(
                "SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE pid = @pid AND wait_event_type = 'Lock')", monitor);
            waiting.Parameters.AddWithValue("pid", processId);
            while (!Equals(true, await waiting.ExecuteScalarAsync(deadline.Token)))
                await Task.Delay(10, deadline.Token);

            stop.Cancel();
            await Assert.ThrowsAnyAsync<OperationCanceledException>(() => pending.WaitAsync(deadline.Token));
            await observer.Cancelled.Task.WaitAsync(deadline.Token);
            // Observe server completion as well: a cancelled client alone cannot distinguish a wrongly caught 503.
            Assert.Equal(499, await status.Completed.Task.WaitAsync(deadline.Token));
        }
        finally
        {
            stop.Cancel();
            await transaction.RollbackAsync();
        }
        var result = await client.GetFromJsonAsync<ReadingHistoryResponse>("/api/readings/history");
        AssertHistoryBounds(result!, Now);
        Assert.Empty(result!.Readings);
    }

    private static void AssertHistoryBounds(ReadingHistoryResponse response, DateTimeOffset expected)
    {
        Assert.NotNull(response);
        Assert.Equal(expected, response.AsOf);
        Assert.Equal(response.AsOf, response.To);
        Assert.Equal(expected.AddHours(-24), response.From);
        Assert.Equal(TimeSpan.FromHours(24), response.To - response.From);
        Assert.Equal(TimeSpan.Zero, response.AsOf.Offset);
        Assert.Equal(TimeSpan.Zero, response.From.Offset);
        Assert.Equal(TimeSpan.Zero, response.To.Offset);
        Assert.Equal(0, response.AsOf.Ticks % 10);
        Assert.All(response.Readings, reading =>
        {
            Assert.Equal(InstallationReading.DemoInstallationId, reading.InstallationId);
            Assert.Equal(TimeSpan.Zero, reading.MeasuredAt.Offset);
            Assert.Equal(0, reading.MeasuredAt.Ticks % 10);
            Assert.InRange(reading.MeasuredAt, response.From, response.To);
        });
    }

    private sealed class HistoryClock(DateTimeOffset now) : TimeProvider
    {
        public DateTimeOffset Now { get; set; } = now;
        public int Reads { get; private set; }
        public override DateTimeOffset GetUtcNow() { Reads++; return Now; }
    }

    private sealed class HistoryCommandObserver(Action<DbCommand, CancellationToken> executing) : DbCommandInterceptor
    {
        public TaskCompletionSource Cancelled { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(DbCommand command,
            CommandEventData eventData, InterceptionResult<DbDataReader> result, CancellationToken cancellationToken = default)
        {
            executing(command, cancellationToken);
            return ValueTask.FromResult(result);
        }

        public override Task CommandCanceledAsync(DbCommand command, CommandEndEventData eventData,
            CancellationToken cancellationToken = default)
        {
            Cancelled.TrySetResult();
            return Task.CompletedTask;
        }
    }

    private sealed class HistoryCancellationStatus : IStartupFilter
    {
        public TaskCompletionSource<int> Completed { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
        {
            app.Use(async (context, continuation) =>
            {
                try { await continuation(); }
                finally
                {
                    if (context.RequestAborted.IsCancellationRequested)
                        Completed.TrySetResult(context.Response.StatusCode);
                }
            });
            next(app);
        };
    }
}
