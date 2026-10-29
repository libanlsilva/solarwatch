using System.Net;
using System.Net.Http.Json;
using System.Text;
using Microsoft.EntityFrameworkCore;
using SolarWatch.Application;

namespace SolarWatch.IntegrationTests;

public partial class LatestReadingTests
{
    private static SubmitReadingRequest Valid(string timestamp = "2026-10-01T11:59:00Z") =>
        new("residential-demo", timestamp, 1234, 987, 76);

    [Fact]
    public async Task Ingestion_acknowledges_normalized_row_and_older_arrival_cannot_replace_latest()
    {
        using var client = factory.CreateClient();
        using var response = await client.PostAsJsonAsync("/api/readings", Valid("2026-10-01T07:59:00.1234567-04:00"));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.True(response.Headers.CacheControl?.NoStore);
        var accepted = await response.Content.ReadFromJsonAsync<LatestReadingResponse>();
        Assert.Equal(Now, accepted?.AsOf);
        Assert.Equal(DateTimeOffset.Parse("2026-10-01T11:59:00.123456Z"), accepted?.Reading?.MeasuredAt);
        Assert.Equal(TimeSpan.Zero, accepted?.Reading?.MeasuredAt.Offset);
        Assert.Equal(HttpStatusCode.Created, (await client.PostAsJsonAsync("/api/readings", Valid("2026-10-01T11:00:00Z") with
            { SolarPowerW = 0, ConsumptionPowerW = 0, BatteryStateOfChargePercent = 0 })).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await client.PostAsJsonAsync("/api/readings", Valid("2026-10-01T10:00:00Z") with
            { BatteryStateOfChargePercent = 100 })).StatusCode);
        var latest = await client.GetFromJsonAsync<LatestReadingResponse>("/api/readings/latest");
        Assert.Equal(accepted, latest);
        await using var db = OpenDb();
        Assert.Equal(3, await db.Readings.CountAsync());
        Assert.Equal(accepted!.Reading!.MeasuredAt, (await db.Readings.OrderByDescending(x => x.MeasuredAt).FirstAsync()).MeasuredAt);
    }

    [Fact]
    public async Task Identical_conflicting_offset_and_submicrosecond_duplicates_return_409_without_overwrite()
    {
        using var client = factory.CreateClient();
        var original = Valid("2026-10-01T11:59:00.1234561Z");
        Assert.Equal(HttpStatusCode.Created, (await client.PostAsJsonAsync("/api/readings", original)).StatusCode);
        foreach (var duplicate in new[] { original, original with { SolarPowerW = 1 },
            original with { MeasuredAt = "2026-10-01T07:59:00.1234569-04:00" } })
        {
            using var response = await client.PostAsJsonAsync("/api/readings", duplicate);
            Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
            Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
            Assert.DoesNotContain("PK_readings", await response.Content.ReadAsStringAsync());
        }
        await using var db = OpenDb();
        var persisted = Assert.Single(await db.Readings.ToListAsync());
        Assert.Equal(original.SolarPowerW, persisted.SolarPowerW);
    }

    [Fact]
    public async Task Concurrent_duplicate_requests_produce_one_created_row_and_conflicts()
    {
        using var client = factory.CreateClient();
        var start = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var submissions = Enumerable.Range(0, 8).Select(async index =>
        {
            await start.Task;
            return await client.PostAsJsonAsync("/api/readings", Valid() with { SolarPowerW = index });
        }).ToArray();
        start.SetResult();
        var responses = await Task.WhenAll(submissions);
        Assert.Single(responses, x => x.StatusCode == HttpStatusCode.Created);
        Assert.Equal(7, responses.Count(x => x.StatusCode == HttpStatusCode.Conflict));
        var winner = await responses.Single(x => x.StatusCode == HttpStatusCode.Created).Content.ReadFromJsonAsync<LatestReadingResponse>();
        await using var db = OpenDb();
        Assert.Equal(winner!.Reading!.SolarPowerW, Assert.Single(await db.Readings.ToListAsync()).SolarPowerW);
        foreach (var response in responses) response.Dispose();
    }

    public static IEnumerable<object[]> InvalidPayloads()
    {
        const string valid = "{\"installationId\":\"residential-demo\",\"measuredAt\":\"2026-10-01T11:59:00Z\",\"solarPowerW\":1234,\"consumptionPowerW\":987,\"batteryStateOfChargePercent\":76}";
        foreach (var invalid in new[]
        {
            "{}", "null", "{", valid.Replace("residential-demo", "other"),
            valid.Replace("2026-10-01T11:59:00Z", "2026-10-01T11:59:00"),
            valid.Replace("2026-10-01T11:59:00Z", "2026-10-01T12:00:00.0000001Z"),
            valid.Replace("2026-10-01T11:59:00Z", "invalid"),
            valid.Replace("1234", "-1"), valid.Replace("987", "-1"),
            valid.Replace("1234", "null"), valid.Replace("987", "null"), valid.Replace("76", "null"),
            valid.Replace("1234", "1e999"), valid.Replace("1234", "\"NaN\""),
            valid.Replace("987", "\"Infinity\""), valid.Replace("76", "101"), valid.Replace("76", "-1"),
            valid.Replace(",\"solarPowerW\":1234", ""), valid.Replace(",\"consumptionPowerW\":987", ""),
            valid.Replace(",\"batteryStateOfChargePercent\":76", "")
        }) yield return [invalid];
    }

    [Theory]
    [MemberData(nameof(InvalidPayloads))]
    public async Task Invalid_JSON_or_measurements_return_400_without_writes(string payload)
    {
        using var client = factory.CreateClient();
        using var response = await client.PostAsync("/api/readings", new StringContent(payload, Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        Assert.Contains("errors", await response.Content.ReadAsStringAsync());
        await using var db = OpenDb();
        Assert.Empty(await db.Readings.ToListAsync());
    }

    [Theory]
    [InlineData("::1", "http://[::1]")]
    [InlineData("::ffff:127.0.0.1", "http://127.0.0.1")]
    public async Task IPv6_and_mapped_local_connections_are_supported(string remote, string baseUrl)
    {
        await using var host = CreateFactory(connection, remote: remote);
        using var client = host.CreateClient(new() { BaseAddress = new Uri(baseUrl) });
        Assert.Equal(HttpStatusCode.Created, (await client.PostAsJsonAsync("/api/readings", Valid())).StatusCode);
    }

    [Theory]
    [InlineData("Production")]
    [InlineData("Staging")]
    public async Task Write_route_is_absent_outside_development(string environment)
    {
        await using var host = CreateFactory(connection, environment);
        using var client = host.CreateClient(new() { BaseAddress = new Uri("https://localhost"), AllowAutoRedirect = false });
        Assert.Equal(HttpStatusCode.NotFound, (await client.PostAsJsonAsync("/api/readings", Valid())).StatusCode);
        await using var db = OpenDb();
        Assert.Empty(await db.Readings.ToListAsync());
    }

    [Theory]
    [InlineData("203.0.113.5", "http://localhost", null, null)]
    [InlineData("127.0.0.1", "http://solarwatch.example", null, null)]
    [InlineData("127.0.0.1", "http://localhost", "X-Forwarded-For", "127.0.0.1")]
    [InlineData("127.0.0.1", "http://localhost", "Forwarded", "for=127.0.0.1")]
    [InlineData("127.0.0.1", "http://localhost", "Origin", "https://untrusted.example")]
    [InlineData("127.0.0.1", "http://localhost", "Origin", "null")]
    public async Task Nonlocal_or_forwarded_writes_are_forbidden(string remote, string baseUrl, string? header, string? value)
    {
        await using var host = CreateFactory(connection, remote: remote);
        using var client = host.CreateClient(new() { BaseAddress = new Uri(baseUrl) });
        if (header is not null) client.DefaultRequestHeaders.Add(header, value);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync("/api/readings", Valid())).StatusCode);
        await using var db = OpenDb();
        Assert.Empty(await db.Readings.ToListAsync());
    }

    [Fact]
    public async Task Ingestion_database_failure_returns_sanitized_503()
    {
        var unavailable = new Npgsql.NpgsqlConnectionStringBuilder(connection) { Port = 1, Timeout = 1 };
        await using var host = CreateFactory(unavailable.ConnectionString);
        using var response = await host.CreateClient().PostAsJsonAsync("/api/readings", Valid());
        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.DoesNotContain("Password", await response.Content.ReadAsStringAsync());
        Assert.DoesNotContain("Npgsql", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Non_JSON_requests_are_rejected_without_writes()
    {
        using var response = await factory.CreateClient().PostAsync("/api/readings", new StringContent("not JSON"));
        Assert.Equal(HttpStatusCode.UnsupportedMediaType, response.StatusCode);
        await using var db = OpenDb();
        Assert.Empty(await db.Readings.ToListAsync());
    }
}
