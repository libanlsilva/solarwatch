using System.Net;
using System.Net.Http.Json;
using System.Text;
using SolarWatch.Application;
using SolarWatch.Domain;
using SolarWatch.Simulator;

namespace SolarWatch.UnitTests;

public class HistorySimulatorTests
{
    private static readonly DateTimeOffset Now = DateTimeOffset.Parse("2026-10-01T12:00:30.1234567Z");
    private static SimulatorOptions Options(DateTimeOffset? end = null) => SimulatorOptions.Parse(
        ["--history-24h", "--end-at", (end ?? Now).ToString("O"), "--seed", "42"]);

    [Fact]
    public void Generates_exact_inclusive_UTC_window_without_rounding_or_resetting_the_seed()
    {
        var readings = ReadingGenerator.GenerateHistory24h(42, Now);
        Assert.Equal(1441, readings.Count);
        Assert.Equal(1441, readings.Select(x => x.MeasuredAt).Distinct().Count());
        Assert.Equal(ReadingTimestamp.Normalize(Now).AddHours(-24), readings[0].MeasuredAt);
        Assert.Equal(ReadingTimestamp.Normalize(Now), readings[^1].MeasuredAt);
        Assert.Equal(TimeSpan.FromHours(24), readings[^1].MeasuredAt - readings[0].MeasuredAt);
        Assert.Equal(readings, ReadingGenerator.GenerateHistory24h(42, Now.ToOffset(TimeSpan.FromHours(-4))));
        Assert.Equal(readings, ReadingGenerator.GenerateHistory24h(42, Now.AddTicks(2)));
        Assert.NotEqual(readings, ReadingGenerator.GenerateHistory24h(43, Now));
        Assert.Equal(ReadingGenerator.Generate(120, 42, readings[119].MeasuredAt), readings.Take(120));
        for (var index = 0; index < readings.Count; index++)
        {
            var reading = readings[index];
            Assert.Equal("residential-demo", reading.InstallationId);
            Assert.Equal(TimeSpan.Zero, reading.MeasuredAt.Offset);
            Assert.InRange(reading.MeasuredAt, readings[0].MeasuredAt, readings[^1].MeasuredAt);
            Assert.InRange(reading.SolarPowerW, 0, 5000);
            Assert.InRange(reading.ConsumptionPowerW, 100, 3000);
            Assert.InRange(reading.BatteryStateOfChargePercent, 0, 100);
            if (index > 0) Assert.Equal(TimeSpan.FromMinutes(1), reading.MeasuredAt - readings[index - 1].MeasuredAt);
        }
        Assert.Throws<ArgumentOutOfRangeException>(() => ReadingGenerator.Generate(1441, 42, Now));
    }

    [Theory]
    [InlineData("--history-24h")]
    [InlineData("--history-24h true")]
    [InlineData("--history-24h --history-24h --end-at 2026-10-01T12:00:00Z")]
    [InlineData("--history-24h --continuous --end-at 2026-10-01T12:00:00Z")]
    [InlineData("--continuous --history-24h --end-at 2026-10-01T12:00:00Z")]
    [InlineData("--history-24h --count 120 --end-at 2026-10-01T12:00:00Z")]
    [InlineData("--history-24h --end-at 2026-10-01T12:00:00")]
    [InlineData("--history-24h --end-at invalid")]
    [InlineData("--history-24h --end-at 0001-01-01T12:00:00Z")]
    [InlineData("--history-24h --end-at 2026-10-01T12:00:00Z --api-url http://example.com")]
    [InlineData("--history-24h --end-at 2026-10-01T12:00:00Z --api-url http://user:secret@localhost")]
    public void Rejects_invalid_or_ambiguous_history_options(string arguments) =>
        Assert.Throws<ArgumentException>(() => SimulatorOptions.Parse(arguments.Split(' ')));

    [Fact]
    public async Task Full_success_forwards_all_readings_sequentially_and_only_uses_server_validation_time()
    {
        using var handler = new Handler();
        using var client = Client(handler);
        using var output = new StringWriter();
        Assert.True(Options().History24h);
        Assert.False(SimulatorOptions.Parse([]).History24h);
        Assert.Equal(0, await SimulatorRunner.RunAsync(Options(), client, output));
        Assert.Equal(1, handler.Gets);
        Assert.Equal(ReadingGenerator.GenerateHistory24h(42, Now), handler.Submitted);
        Assert.Equal(1, handler.MaxActive);
        Assert.Contains("requested=1441, attempted=1441, accepted=1441, rejected=0, conflicts=0, errors=0, uncertain=0, unattempted=0", output.ToString());
        Assert.Contains("elapsedSeconds=", output.ToString());
    }

    [Fact]
    public async Task Known_rejections_continue_but_never_claim_full_success()
    {
        using var handler = new Handler
        {
            OnPost = (reading, index, _) => Task.FromResult(index switch
            {
                1 => new HttpResponseMessage(HttpStatusCode.Conflict),
                2 => new HttpResponseMessage(HttpStatusCode.BadRequest),
                _ => Ack(reading)
            })
        };
        using var client = Client(handler);
        using var output = new StringWriter();
        Assert.Equal(1, await SimulatorRunner.RunAsync(Options(), client, output));
        Assert.Equal(1441, handler.Submitted.Count);
        Assert.Contains("HTTP 409", output.ToString());
        Assert.Contains("HTTP 400", output.ToString());
        Assert.Contains("accepted=1439, rejected=2, conflicts=1, errors=0, uncertain=0, unattempted=0", output.ToString());
    }

    [Theory]
    [InlineData("network")]
    [InlineData("timeout")]
    [InlineData("json")]
    [InlineData("mismatch")]
    [InlineData("503")]
    [InlineData("200")]
    public async Task Partial_failure_stops_without_retry_and_reports_uncertain_and_unattempted_separately(string failure)
    {
        using var handler = new Handler
        {
            OnPost = (reading, index, _) =>
            {
                if (index < 3) return Task.FromResult(Ack(reading));
                return failure switch
                {
                    "network" => throw new HttpRequestException("private transport details"),
                    "timeout" => throw new TaskCanceledException("private timeout details"),
                    "json" => Task.FromResult(Json("null", HttpStatusCode.Created)),
                    "mismatch" => Task.FromResult(Ack(reading with { SolarPowerW = reading.SolarPowerW + 1 })),
                    _ => Task.FromResult(new HttpResponseMessage((HttpStatusCode)int.Parse(failure)))
                };
            }
        };
        using var client = Client(handler);
        using var output = new StringWriter();
        Assert.Equal(1, await SimulatorRunner.RunAsync(Options(), client, output));
        Assert.Equal(3, handler.Submitted.Count);
        Assert.Contains("attempted=3, accepted=2, rejected=0, conflicts=0, errors=1, uncertain=1, unattempted=1438", output.ToString());
        Assert.Contains("write outcome is uncertain", output.ToString());
        Assert.DoesNotContain("private", output.ToString());
    }

    [Fact]
    public async Task Controlled_stop_after_confirmations_is_incomplete_and_not_successful()
    {
        using var stop = new CancellationTokenSource();
        using var handler = new Handler();
        using var client = Client(handler);
        using var output = new StopAfterAccepted(stop, 3);
        Assert.Equal(1, await SimulatorRunner.RunAsync(Options(), client, output, stop.Token));
        Assert.Equal(3, handler.Submitted.Count);
        Assert.Contains("attempted=3, accepted=3, rejected=0, conflicts=0, errors=1, uncertain=0, unattempted=1438", output.ToString());
        Assert.Contains("incomplete history", output.ToString());
    }

    [Fact]
    public async Task Controlled_stop_during_POST_is_uncertain_even_after_earlier_success()
    {
        using var stop = new CancellationTokenSource();
        var entered = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        using var handler = new Handler
        {
            OnPost = async (reading, index, token) =>
            {
                if (index == 3) { entered.SetResult(); await Task.Delay(Timeout.InfiniteTimeSpan, token); }
                return Ack(reading);
            }
        };
        using var client = Client(handler);
        using var output = new StringWriter();
        var run = SimulatorRunner.RunAsync(Options(), client, output, stop.Token);
        await entered.Task.WaitAsync(TimeSpan.FromSeconds(5));
        stop.Cancel();
        Assert.Equal(1, await run.WaitAsync(TimeSpan.FromSeconds(5)));
        Assert.Contains("attempted=3, accepted=2, rejected=0, conflicts=0, errors=1, uncertain=1, unattempted=1438", output.ToString());
    }

    [Fact]
    public async Task Already_cancelled_run_does_not_contact_API_and_is_not_successful()
    {
        using var stop = new CancellationTokenSource();
        stop.Cancel();
        using var handler = new Handler();
        using var client = Client(handler);
        using var output = new StringWriter();
        Assert.Equal(1, await SimulatorRunner.RunAsync(Options(), client, output, stop.Token));
        Assert.Equal(0, handler.Gets);
        Assert.Contains("attempted=0, accepted=0, rejected=0, conflicts=0, errors=1, uncertain=0, unattempted=1441", output.ToString());
    }

    [Theory]
    [InlineData("null")]
    [InlineData("{}")]
    [InlineData("{\"asOf\":\"2026-10-01T12:00:30\"}")]
    [InlineData("{\"asOf\":\"invalid\"}")]
    public async Task Invalid_reference_response_never_submits(string json)
    {
        using var handler = new Handler { OnGet = _ => Task.FromResult(Json(json)) };
        using var client = Client(handler);
        using var output = new StringWriter();
        Assert.Equal(1, await SimulatorRunner.RunAsync(Options(), client, output));
        Assert.Empty(handler.Submitted);
        Assert.Contains("errors=1, uncertain=0, unattempted=1441", output.ToString());
    }

    [Theory]
    [InlineData(302)]
    [InlineData(503)]
    public async Task Bad_reference_status_stops_before_POST(int status)
    {
        using var handler = new Handler { OnGet = _ => Task.FromResult(new HttpResponseMessage((HttpStatusCode)status)) };
        using var client = Client(handler);
        using var output = new StringWriter();
        Assert.Equal(1, await SimulatorRunner.RunAsync(Options(), client, output));
        Assert.Empty(handler.Submitted);
        Assert.Contains($"reference request returned HTTP {status}", output.ToString());
    }

    [Fact]
    public async Task Future_reference_is_checked_before_microsecond_truncation()
    {
        using var handler = new Handler();
        using var client = Client(handler);
        using var output = new StringWriter();
        Assert.Equal(1, await SimulatorRunner.RunAsync(Options(Now.AddTicks(1)), client, output));
        Assert.Empty(handler.Submitted);
        Assert.Contains("errors=1, uncertain=0, unattempted=1441", output.ToString());
    }

    private static HttpClient Client(HttpMessageHandler handler) => new(handler) { BaseAddress = new Uri("http://localhost") };
    private static HttpResponseMessage Json(string json, HttpStatusCode status = HttpStatusCode.OK) =>
        new(status) { Content = new StringContent(json, Encoding.UTF8, "application/json") };
    private static HttpResponseMessage Ack(ReadingSnapshot reading) => new(HttpStatusCode.Created)
        { Content = JsonContent.Create(new LatestReadingResponse(Now, reading)) };

    private sealed class StopAfterAccepted(CancellationTokenSource stop, int count) : StringWriter
    {
        private int accepted;
        public override void WriteLine(string? value)
        {
            base.WriteLine(value);
            if (value?.StartsWith("Accepted ", StringComparison.Ordinal) == true && ++accepted == count) stop.Cancel();
        }
    }

    private sealed class Handler : HttpMessageHandler
    {
        public Func<CancellationToken, Task<HttpResponseMessage>>? OnGet { get; init; }
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
                        ? new(HttpStatusCode.OK) { Content = JsonContent.Create(new LatestReadingResponse(Now, null)) }
                        : await OnGet(cancellationToken);
                }
                var reading = (await request.Content!.ReadFromJsonAsync<ReadingSnapshot>(cancellationToken))!;
                Submitted.Add(reading);
                return OnPost is null ? Ack(reading) : await OnPost(reading, Submitted.Count, cancellationToken);
            }
            finally { Interlocked.Decrement(ref active); }
        }
    }
}
