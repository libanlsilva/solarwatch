using System.Diagnostics;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using SolarWatch.Application;
using SolarWatch.Domain;
using SolarWatch.Simulator;

namespace SolarWatch.IntegrationTests;

public partial class LatestReadingTests
{
    [Fact]
    public async Task Residential_history_persists_profile_values_and_preserves_an_occupied_instant()
    {
        var expected = ResidentialHistoryGenerator.Generate(42, HistoryEnd).ToArray();
        await using var db = OpenDb();
        // A different profile/old measurement at this key must never be replaced.
        db.Readings.Add(InstallationReading.Create(expected[720].MeasuredAt, 7777, 8888, 99, Now));
        await db.SaveChangesAsync();
        await using var host = factory.WithWebHostBuilder(builder => builder.ConfigureLogging(logging => logging.ClearProviders()));
        using var client = host.CreateClient();
        using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(90));
        using var output = new StringWriter();
        var elapsed = Stopwatch.StartNew();
        Assert.Equal(1, await SimulatorRunner.RunAsync(HistoryOptions() with { Profile = "residential-v1" }, client, output, deadline.Token));
        testOutput.WriteLine($"Residential PostgreSQL HTTP: {elapsed.Elapsed.TotalSeconds:F3} s; 1440 accepted / 1 conflict.");
        Assert.Contains("accepted=1440, rejected=1, conflicts=1, errors=0, uncertain=0, unattempted=0", output.ToString());
        expected[720] = expected[720] with { SolarPowerW = 7777, ConsumptionPowerW = 8888, BatteryStateOfChargePercent = 99 };
        var stored = await db.Readings.AsNoTracking().OrderBy(x => x.MeasuredAt).ToListAsync();
        Assert.Equal(1441, stored.Count);
        Assert.Equal(expected, stored.Select(ReadingSnapshot.From));
        Assert.Equal(ReadingTimestamp.Normalize(HistoryEnd), stored[^1].MeasuredAt);
        Assert.Equal(ReadingTimestamp.Normalize(HistoryEnd).AddHours(-24), stored[0].MeasuredAt);
        Assert.Equal(expected[^1], (await client.GetFromJsonAsync<LatestReadingResponse>("/api/readings/latest"))!.Reading);
        var history = await client.GetFromJsonAsync<ReadingHistoryResponse>("/api/readings/history");
        Assert.Equal(expected.Where(x => x.MeasuredAt >= history!.From && x.MeasuredAt <= history.To), history!.Readings);
    }

    [Fact]
    public async Task Residential_interrupted_POST_preserves_actual_rows_and_uncertain_reporting()
    {
        await using var host = factory.WithWebHostBuilder(builder => builder.ConfigureLogging(logging => logging.ClearProviders()));
        using var stop = new CancellationTokenSource();
        using var client = new HttpClient(new LostAcknowledgmentHandler(host.Server.CreateHandler(), stop, stopAfter: 3))
            { BaseAddress = new Uri("http://localhost") };
        using var output = new StringWriter();
        Assert.Equal(1, await SimulatorRunner.RunAsync(HistoryOptions() with { Profile = "residential-v1" }, client, output, stop.Token));
        Assert.Contains("attempted=3, accepted=2, rejected=0, conflicts=0, errors=1, uncertain=1, unattempted=1438", output.ToString());
        await using var db = OpenDb();
        var stored = await db.Readings.AsNoTracking().OrderBy(x => x.MeasuredAt).ToListAsync();
        Assert.Equal(ResidentialHistoryGenerator.Generate(42, HistoryEnd).Take(3), stored.Select(ReadingSnapshot.From));
    }
}
