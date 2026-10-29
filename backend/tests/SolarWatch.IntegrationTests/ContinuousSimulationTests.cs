using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using SolarWatch.Application;
using SolarWatch.Domain;
using SolarWatch.Simulator;
using SolarWatch.TestSupport;

namespace SolarWatch.IntegrationTests;

public partial class LatestReadingTests
{
    [Fact]
    public async Task Scheduled_continuous_readings_persist_and_advance_latest_without_real_minute_waits()
    {
        var serverClock = new MutableServerClock();
        var timer = new ManualTimeProvider();
        await using var host = CreateFactory(connection, serverClock: serverClock);
        using var client = host.CreateClient();
        using var stop = new CancellationTokenSource();
        using var output = new StringWriter();
        var run = SimulatorRunner.RunAsync(SimulatorOptions.Parse(["--continuous", "--seed", "42"]), client, output, stop.Token, timer);
        await timer.NextDelayAsync();
        var first = await client.GetFromJsonAsync<LatestReadingResponse>("/api/readings/latest");
        Assert.Equal(Now, first!.Reading!.MeasuredAt);

        serverClock.Now = Now.AddMinutes(1).AddTicks(7);
        timer.Advance(TimeSpan.FromMinutes(1));
        await timer.NextDelayAsync();
        var second = await client.GetFromJsonAsync<LatestReadingResponse>("/api/readings/latest");
        Assert.Equal(ReadingTimestamp.Normalize(serverClock.Now), second!.Reading!.MeasuredAt);
        Assert.NotEqual(first.Reading, second.Reading);
        Assert.Equal(serverClock.Now, second.AsOf);
        stop.Cancel();
        Assert.Equal(0, await run.WaitAsync(TimeSpan.FromSeconds(5)));
        Assert.Contains("attempted=2, accepted=2, rejected=0, errors=0, uncertain=0", output.ToString());
        await using var db = OpenDb();
        var stored = await db.Readings.OrderBy(x => x.MeasuredAt).ToListAsync();
        Assert.Equal(2, stored.Count);
        Assert.Equal(first.Reading, ReadingSnapshot.From(stored[0]));
        Assert.Equal(second.Reading, ReadingSnapshot.From(stored[1]));
    }

    [Fact]
    public async Task Unchanged_server_instant_conflicts_on_second_iteration_without_overwriting()
    {
        var timer = new ManualTimeProvider();
        using var client = factory.CreateClient();
        using var output = new StringWriter();
        var run = SimulatorRunner.RunAsync(SimulatorOptions.Parse(["--continuous"]), client, output, clock: timer);
        await timer.NextDelayAsync();
        var original = await client.GetFromJsonAsync<LatestReadingResponse>("/api/readings/latest");
        timer.Advance(TimeSpan.FromMinutes(1));
        Assert.Equal(1, await run.WaitAsync(TimeSpan.FromSeconds(5)));
        Assert.Contains("HTTP 409", output.ToString());
        Assert.Contains("attempted=2, accepted=1, rejected=1, errors=0, uncertain=0", output.ToString());
        Assert.Equal(original, await client.GetFromJsonAsync<LatestReadingResponse>("/api/readings/latest"));
        await using var db = OpenDb();
        Assert.Single(await db.Readings.ToListAsync());
    }

    [Fact]
    public async Task Cancellation_after_database_commit_before_acknowledgment_reports_uncertainty()
    {
        using var stop = new CancellationTokenSource();
        using var client = new HttpClient(new LostAcknowledgmentHandler(factory.Server.CreateHandler(), stop))
            { BaseAddress = new Uri("http://localhost") };
        using var output = new StringWriter();
        Assert.Equal(1, await SimulatorRunner.RunAsync(SimulatorOptions.Parse(["--continuous"]), client, output, stop.Token));
        Assert.Contains("attempted=1, accepted=0, rejected=0, errors=1, uncertain=1", output.ToString());
        Assert.Contains("write outcome is uncertain", output.ToString());
        await using var db = OpenDb();
        var persisted = Assert.Single(await db.Readings.ToListAsync());
        Assert.Equal(Now, persisted.MeasuredAt);
    }

    private sealed class MutableServerClock : TimeProvider
    {
        public DateTimeOffset Now { get; set; } = LatestReadingTests.Now;
        public override DateTimeOffset GetUtcNow() => Now;
    }

    private sealed class LostAcknowledgmentHandler(HttpMessageHandler inner, CancellationTokenSource stop) : DelegatingHandler(inner)
    {
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var response = await base.SendAsync(request, cancellationToken);
            if (request.Method == HttpMethod.Post && response.StatusCode == HttpStatusCode.Created)
            {
                response.Dispose();
                stop.Cancel();
                throw new OperationCanceledException(cancellationToken);
            }
            return response;
        }
    }
}
