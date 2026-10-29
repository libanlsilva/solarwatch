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
    private static DateTimeOffset HistoryEnd => Now.AddMinutes(-1).AddTicks(7);
    private static SimulatorOptions HistoryOptions(int seed = 42) => SimulatorOptions.Parse(
        ["--history-24h", "--end-at", HistoryEnd.ToOffset(TimeSpan.FromHours(-4)).ToString("O"), "--seed", seed.ToString()]);

    [Fact]
    public async Task Full_history_persists_exact_values_range_and_cadence_then_identical_rerun_only_conflicts()
    {
        // Expected uniqueness errors are verified below; avoid thousands of EF diagnostic log lines.
        await using var host = factory.WithWebHostBuilder(builder => builder.ConfigureLogging(logging => logging.ClearProviders()));
        using var client = host.CreateClient();
        using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(90));
        using var output = new StringWriter();
        var elapsed = Stopwatch.StartNew();
        Assert.Equal(0, await SimulatorRunner.RunAsync(HistoryOptions(), client, output, deadline.Token));
        testOutput.WriteLine($"PostgreSQL HTTP history fresh: {elapsed.Elapsed.TotalSeconds:F3} s for 1441 accepted POSTs.");
        Assert.Contains("attempted=1441, accepted=1441, rejected=0, conflicts=0, errors=0, uncertain=0, unattempted=0", output.ToString());
        await using var db = OpenDb();
        var stored = await db.Readings.AsNoTracking().OrderBy(x => x.MeasuredAt).ToListAsync();
        var expected = ReadingGenerator.GenerateHistory24h(42, HistoryEnd);
        Assert.Equal(1441, stored.Count);
        Assert.Equal(1441, stored.Select(x => (x.InstallationId, x.MeasuredAt)).Distinct().Count());
        Assert.Equal(expected, stored.Select(ReadingSnapshot.From));
        Assert.Equal(ReadingTimestamp.Normalize(HistoryEnd).AddHours(-24), stored[0].MeasuredAt);
        Assert.Equal(ReadingTimestamp.Normalize(HistoryEnd), stored[^1].MeasuredAt);
        Assert.All(stored.Zip(stored.Skip(1)), pair => Assert.Equal(TimeSpan.FromMinutes(1), pair.Second.MeasuredAt - pair.First.MeasuredAt));
        var latest = await client.GetFromJsonAsync<LatestReadingResponse>("/api/readings/latest");
        Assert.Equal(expected[^1], latest!.Reading);

        using var repeatedOutput = new StringWriter();
        elapsed.Restart();
        Assert.Equal(1, await SimulatorRunner.RunAsync(HistoryOptions(), client, repeatedOutput, deadline.Token));
        testOutput.WriteLine($"PostgreSQL HTTP history repeat: {elapsed.Elapsed.TotalSeconds:F3} s for 1441 conflicts.");
        Assert.Contains("accepted=0, rejected=1441, conflicts=1441, errors=0, uncertain=0, unattempted=0", repeatedOutput.ToString());
        var after = await db.Readings.AsNoTracking().OrderBy(x => x.MeasuredAt).ToListAsync();
        Assert.Equal(expected, after.Select(ReadingSnapshot.From));
        Assert.Equal(latest, await client.GetFromJsonAsync<LatestReadingResponse>("/api/readings/latest"));
    }

    [Fact]
    public async Task Partial_range_fills_missing_instants_without_overwriting_or_displacing_a_newer_reading()
    {
        var expected = ReadingGenerator.GenerateHistory24h(42, HistoryEnd);
        var occupied = new[] { 0, 720, 1440 };
        await using var db = OpenDb();
        foreach (var index in occupied)
            db.Readings.Add(InstallationReading.Create(expected[index].MeasuredAt, 7777, 8888, 99, Now));
        var offCadence = InstallationReading.Create(expected[10].MeasuredAt.AddSeconds(30), 6666, 4444, 44, Now);
        db.Readings.Add(offCadence);
        db.Readings.Add(InstallationReading.Create(Now, 9999, 5555, 55, Now));
        await db.SaveChangesAsync();
        await using var host = factory.WithWebHostBuilder(builder => builder.ConfigureLogging(logging => logging.ClearProviders()));
        using var client = host.CreateClient();
        using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(90));
        using var output = new StringWriter();
        var elapsed = Stopwatch.StartNew();
        Assert.Equal(1, await SimulatorRunner.RunAsync(HistoryOptions(), client, output, deadline.Token));
        testOutput.WriteLine($"PostgreSQL HTTP partial history: {elapsed.Elapsed.TotalSeconds:F3} s for 1438 accepted / 3 conflicting POSTs.");
        Assert.Contains("accepted=1438, rejected=3, conflicts=3, errors=0, uncertain=0, unattempted=0", output.ToString());
        var stored = await db.Readings.AsNoTracking().OrderBy(x => x.MeasuredAt).ToListAsync();
        Assert.Equal(1443, stored.Count);
        var byTimestamp = stored.ToDictionary(x => x.MeasuredAt);
        for (var index = 0; index < expected.Count; index++)
            Assert.Equal(occupied.Contains(index)
                ? expected[index] with { SolarPowerW = 7777, ConsumptionPowerW = 8888, BatteryStateOfChargePercent = 99 }
                : expected[index], ReadingSnapshot.From(byTimestamp[expected[index].MeasuredAt]));
        Assert.Equal(ReadingSnapshot.From(offCadence), ReadingSnapshot.From(byTimestamp[offCadence.MeasuredAt]));
        var latest = await client.GetFromJsonAsync<LatestReadingResponse>("/api/readings/latest");
        Assert.Equal(new ReadingSnapshot("residential-demo", Now, 9999, 5555, 55), latest!.Reading);

        using var changedSeedOutput = new StringWriter();
        Assert.Equal(1, await SimulatorRunner.RunAsync(HistoryOptions(43), client, changedSeedOutput, deadline.Token));
        Assert.Contains("accepted=0, rejected=1441, conflicts=1441", changedSeedOutput.ToString());
        var after = await db.Readings.AsNoTracking().OrderBy(x => x.MeasuredAt).ToListAsync();
        Assert.Equal(stored.Select(ReadingSnapshot.From), after.Select(ReadingSnapshot.From));
    }

    [Fact]
    public async Task Interrupted_history_keeps_confirmed_and_uncertain_rows_without_claiming_completion()
    {
        await using var host = factory.WithWebHostBuilder(builder => builder.ConfigureLogging(logging => logging.ClearProviders()));
        using var stop = new CancellationTokenSource();
        using var client = new HttpClient(new LostAcknowledgmentHandler(host.Server.CreateHandler(), stop, stopAfter: 3))
            { BaseAddress = new Uri("http://localhost") };
        using var output = new StringWriter();
        Assert.Equal(1, await SimulatorRunner.RunAsync(HistoryOptions(), client, output, stop.Token));
        Assert.Contains("attempted=3, accepted=2, rejected=0, conflicts=0, errors=1, uncertain=1, unattempted=1438", output.ToString());
        Assert.Contains("write outcome is uncertain", output.ToString());
        await using var db = OpenDb();
        var persisted = await db.Readings.AsNoTracking().OrderBy(x => x.MeasuredAt).ToListAsync();
        Assert.Equal(ReadingGenerator.GenerateHistory24h(42, HistoryEnd).Take(3), persisted.Select(ReadingSnapshot.From));
    }
}
