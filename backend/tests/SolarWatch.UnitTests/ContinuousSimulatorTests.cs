using System.Net;
using System.Net.Http.Json;
using System.Text;
using SolarWatch.Application;
using SolarWatch.Domain;
using SolarWatch.Simulator;
using SolarWatch.TestSupport;

namespace SolarWatch.UnitTests;

public class ContinuousSimulatorTests
{
    private static readonly DateTimeOffset Now = DateTimeOffset.Parse("2026-10-01T12:00:00.1234567Z");

    [Theory]
    [InlineData("--continuous")]
    [InlineData("--continuous --seed -42")]
    [InlineData("--seed 42 --continuous --api-url http://localhost:5171")]
    public void Continuous_mode_is_explicit_and_accepts_seed_and_local_URL(string arguments)
    {
        Assert.True(SimulatorOptions.Parse(arguments.Split(' ')).Continuous);
        Assert.False(SimulatorOptions.Parse([]).Continuous);
    }

    [Theory]
    [InlineData("--continuous --continuous")]
    [InlineData("--continuous true")]
    [InlineData("--continuous --count 1")]
    [InlineData("--count 10 --continuous")]
    [InlineData("--continuous --end-at 2026-10-01T12:00:00Z")]
    [InlineData("--continuous --seed")]
    [InlineData("--continuous --api-url http://example.com")]
    [InlineData("--continuous --api-url http://user:secret@localhost")]
    public void Invalid_or_ambiguous_options_fail_before_running(string arguments) =>
        Assert.Throws<ArgumentException>(() => SimulatorOptions.Parse(arguments.Split(' ')));

    [Fact]
    public async Task Sends_immediately_then_each_minute_using_new_server_times_and_a_seeded_value_sequence()
    {
        var clock = new ManualTimeProvider();
        using var stop = new CancellationTokenSource();
        using var handler = new RecordingHandler();
        using var client = Client(handler);
        using var output = new StringWriter();
        var run = Run(client, output, clock, stop.Token);
        Assert.Equal(TimeSpan.FromSeconds(60), await clock.NextDelayAsync());
        Assert.Single(handler.Submitted);
        clock.Advance(TimeSpan.FromSeconds(59));
        Assert.Single(handler.Submitted);
        clock.Advance(TimeSpan.FromSeconds(1));
        Assert.Equal(TimeSpan.FromSeconds(60), await clock.NextDelayAsync());
        clock.Advance(TimeSpan.FromSeconds(60));
        await clock.NextDelayAsync();
        stop.Cancel();
        Assert.Equal(0, await run.WaitAsync(TimeSpan.FromSeconds(5)));
        Assert.Equal(3, handler.Gets);
        var expected = ReadingGenerator.Generate(3, 42, Now);
        for (var index = 0; index < 3; index++)
        {
            var actual = handler.Submitted[index];
            Assert.Equal(ReadingTimestamp.Normalize(Now.AddMinutes(index)), actual.MeasuredAt);
            Assert.NotEqual(clock.GetUtcNow(), actual.MeasuredAt);
            Assert.Equal(expected[index].SolarPowerW, actual.SolarPowerW);
            Assert.Equal(expected[index].ConsumptionPowerW, actual.ConsumptionPowerW);
            Assert.Equal(expected[index].BatteryStateOfChargePercent, actual.BatteryStateOfChargePercent);
        }
        clock.Advance(TimeSpan.FromHours(3));
        Assert.Equal(3, handler.Submitted.Count);
        Assert.Contains("attempted=3, accepted=3, rejected=0, errors=0, uncertain=0", output.ToString());
    }

    [Fact]
    public async Task Slow_POST_never_overlaps_or_queues_missed_work()
    {
        var clock = new ManualTimeProvider();
        using var stop = new CancellationTokenSource();
        var entered = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var release = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        using var handler = new RecordingHandler
        {
            OnPost = async (reading, index, token) =>
            {
                if (index == 1) { entered.SetResult(); await release.Task.WaitAsync(token); }
                return Ack(reading);
            }
        };
        using var client = Client(handler);
        using var output = new StringWriter();
        var run = Run(client, output, clock, stop.Token);
        await entered.Task.WaitAsync(TimeSpan.FromSeconds(5));
        clock.Advance(TimeSpan.FromSeconds(185));
        Assert.Equal(1, handler.Gets);
        Assert.Single(handler.Submitted);
        release.SetResult();
        Assert.Equal(TimeSpan.FromSeconds(55), await clock.NextDelayAsync());
        Assert.Single(handler.Submitted);
        clock.Advance(TimeSpan.FromSeconds(55));
        await clock.NextDelayAsync();
        stop.Cancel();
        Assert.Equal(0, await run.WaitAsync(TimeSpan.FromSeconds(5)));
        Assert.Equal(2, handler.Submitted.Count);
        Assert.Equal(1, handler.MaxActive);
    }

    [Theory]
    [InlineData(119)]
    [InlineData(185)]
    public async Task Late_timer_runs_one_iteration_then_waits_a_full_minute_without_a_burst(int lateSeconds)
    {
        var clock = new ManualTimeProvider();
        using var stop = new CancellationTokenSource();
        using var handler = new RecordingHandler();
        using var client = Client(handler);
        using var output = new StringWriter();
        var run = Run(client, output, clock, stop.Token);
        await clock.NextDelayAsync();
        clock.Advance(TimeSpan.FromSeconds(lateSeconds));
        Assert.Equal(TimeSpan.FromSeconds(60), await clock.NextDelayAsync());
        Assert.Equal(2, handler.Submitted.Count);
        stop.Cancel();
        Assert.Equal(0, await run.WaitAsync(TimeSpan.FromSeconds(5)));
    }

    [Fact]
    public async Task Already_cancelled_run_does_not_contact_the_API()
    {
        using var stop = new CancellationTokenSource();
        stop.Cancel();
        using var handler = new RecordingHandler();
        using var client = Client(handler);
        using var output = new StringWriter();
        Assert.Equal(0, await Run(client, output, new ManualTimeProvider(), stop.Token));
        Assert.Equal(0, handler.Gets);
        Assert.Contains("attempted=0, accepted=0, rejected=0, errors=0, uncertain=0", output.ToString());
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Operator_cancellation_distinguishes_reference_requests_from_pending_writes(bool duringPost)
    {
        using var stop = new CancellationTokenSource();
        var entered = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        async Task<HttpResponseMessage> Block(CancellationToken token)
        {
            entered.SetResult();
            await Task.Delay(Timeout.InfiniteTimeSpan, token);
            throw new InvalidOperationException("Unreachable");
        }
        using var handler = new RecordingHandler
        {
            OnGet = duringPost ? null : (_, token) => Block(token),
            OnPost = duringPost ? (_, _, token) => Block(token) : null
        };
        using var client = Client(handler);
        using var output = new StringWriter();
        var run = Run(client, output, new ManualTimeProvider(), stop.Token);
        await entered.Task.WaitAsync(TimeSpan.FromSeconds(5));
        stop.Cancel();
        Assert.Equal(duringPost ? 1 : 0, await run.WaitAsync(TimeSpan.FromSeconds(5)));
        Assert.Contains(duringPost ? "errors=1, uncertain=1" : "errors=0, uncertain=0", output.ToString());
        Assert.Contains(duringPost ? "write outcome is uncertain" : "No write is pending", output.ToString());
    }

    [Theory]
    [InlineData(400)]
    [InlineData(503)]
    [InlineData(302)]
    public async Task Bad_reference_status_stops_without_a_POST(int status)
    {
        using var handler = new RecordingHandler { OnGet = (_, _) => Task.FromResult(new HttpResponseMessage((HttpStatusCode)status)) };
        using var client = Client(handler);
        using var output = new StringWriter();
        Assert.Equal(1, await Run(client, output, new ManualTimeProvider()));
        Assert.Empty(handler.Submitted);
        Assert.Contains($"reference request returned HTTP {status}", output.ToString());
        Assert.Contains("errors=1, uncertain=0", output.ToString());
    }

    [Theory]
    [InlineData("null")]
    [InlineData("{}")]
    [InlineData("{")]
    [InlineData("{\"asOf\":\"invalid\"}")]
    [InlineData("{\"asOf\":\"2026-10-01T12:00:00\"}")]
    [InlineData("{\"asOf\":null}")]
    [InlineData("{\"asOf\":\"0001-01-01T00:00:00Z\"}")]
    public async Task Malformed_reference_never_assigns_a_local_timestamp_or_submits(string json)
    {
        using var handler = new RecordingHandler { OnGet = (_, _) => Task.FromResult(Json(json)) };
        using var client = Client(handler);
        using var output = new StringWriter();
        Assert.Equal(1, await Run(client, output, new ManualTimeProvider()));
        Assert.Empty(handler.Submitted);
        Assert.Contains("errors=1, uncertain=0", output.ToString());
    }

    [Theory]
    [InlineData(400, 1, 0, 0)]
    [InlineData(409, 1, 0, 0)]
    [InlineData(503, 0, 1, 1)]
    [InlineData(302, 0, 1, 1)]
    [InlineData(200, 0, 1, 1)]
    public async Task Rejected_and_unexpected_POST_statuses_stop_without_retry(int status, int rejected, int errors, int uncertain)
    {
        using var handler = new RecordingHandler { OnPost = (_, _, _) => Task.FromResult(new HttpResponseMessage((HttpStatusCode)status)) };
        using var client = Client(handler);
        using var output = new StringWriter();
        Assert.Equal(1, await Run(client, output, new ManualTimeProvider()));
        Assert.Single(handler.Submitted);
        Assert.Contains($"HTTP {status}", output.ToString());
        Assert.Contains($"accepted=0, rejected={rejected}, errors={errors}, uncertain={uncertain}", output.ToString());
    }

    [Theory]
    [InlineData("null")]
    [InlineData("{}")]
    [InlineData("{")]
    public async Task Malformed_acknowledgment_does_not_claim_acceptance(string json)
    {
        using var handler = new RecordingHandler { OnPost = (_, _, _) => Task.FromResult(Json(json, HttpStatusCode.Created)) };
        using var client = Client(handler);
        using var output = new StringWriter();
        Assert.Equal(1, await Run(client, output, new ManualTimeProvider()));
        Assert.Single(handler.Submitted);
        Assert.Contains("accepted=0, rejected=0, errors=1, uncertain=1", output.ToString());
    }

    [Theory]
    [InlineData(false, false)]
    [InlineData(false, true)]
    [InlineData(true, false)]
    [InlineData(true, true)]
    public async Task Network_failure_or_timeout_without_operator_stop_is_an_error(bool duringPost, bool timeout)
    {
        Task<HttpResponseMessage> Fail() => throw (timeout
            ? new TaskCanceledException("private timeout details") : new HttpRequestException("private transport details"));
        using var handler = new RecordingHandler
        {
            OnGet = duringPost ? null : (_, _) => Fail(),
            OnPost = duringPost ? (_, _, _) => Fail() : null
        };
        using var client = Client(handler);
        using var output = new StringWriter();
        Assert.Equal(1, await Run(client, output, new ManualTimeProvider()));
        Assert.Contains(duringPost ? "errors=1, uncertain=1" : "errors=1, uncertain=0", output.ToString());
        Assert.DoesNotContain("private", output.ToString());
    }

    private static HttpClient Client(HttpMessageHandler handler) => new(handler) { BaseAddress = new Uri("http://localhost") };
    private static Task<int> Run(HttpClient client, TextWriter output, TimeProvider clock, CancellationToken token = default) =>
        SimulatorRunner.RunAsync(SimulatorOptions.Parse(["--continuous"]), client, output, token, clock);
    private static HttpResponseMessage Json(string json, HttpStatusCode status = HttpStatusCode.OK) =>
        new(status) { Content = new StringContent(json, Encoding.UTF8, "application/json") };
    private static HttpResponseMessage Ack(ReadingSnapshot reading) => new(HttpStatusCode.Created)
    {
        Content = JsonContent.Create(new LatestReadingResponse(reading.MeasuredAt.AddSeconds(1), reading))
    };

    private sealed class RecordingHandler : HttpMessageHandler
    {
        public Func<int, CancellationToken, Task<HttpResponseMessage>>? OnGet { get; init; }
        public Func<ReadingSnapshot, int, CancellationToken, Task<HttpResponseMessage>>? OnPost { get; init; }
        public List<ReadingSnapshot> Submitted { get; } = [];
        public int Gets { get; private set; }
        public int MaxActive { get; private set; }
        private int active;
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var current = Interlocked.Increment(ref active);
            MaxActive = Math.Max(MaxActive, current);
            try
            {
                if (request.Method == HttpMethod.Get)
                {
                    Gets++;
                    return OnGet is null
                        ? new(HttpStatusCode.OK) { Content = JsonContent.Create(new LatestReadingResponse(Now.AddMinutes(Gets - 1), null)) }
                        : await OnGet(Gets, cancellationToken);
                }
                var reading = (await request.Content!.ReadFromJsonAsync<ReadingSnapshot>(cancellationToken))!;
                Submitted.Add(reading);
                return OnPost is null ? Ack(reading) : await OnPost(reading, Submitted.Count, cancellationToken);
            }
            finally { Interlocked.Decrement(ref active); }
        }
    }
}
