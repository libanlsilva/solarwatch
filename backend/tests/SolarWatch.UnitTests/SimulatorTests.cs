using System.Net;
using System.Net.Http.Json;
using SolarWatch.Application;
using SolarWatch.Domain;
using SolarWatch.Simulator;

namespace SolarWatch.UnitTests;

public class SimulatorTests
{
    private static readonly DateTimeOffset Now = DateTimeOffset.Parse("2026-10-01T12:00:00.1234567Z");

    [Fact]
    public void Generation_is_deterministic_bounded_UTC_and_spaced_one_minute_apart()
    {
        var readings = ReadingGenerator.Generate(120, 42, Now.ToOffset(TimeSpan.FromHours(-4)));
        Assert.Equal(readings, ReadingGenerator.Generate(120, 42, Now));
        Assert.NotEqual(readings, ReadingGenerator.Generate(120, 43, Now));
        Assert.Equal(ReadingTimestamp.Normalize(Now), readings[^1].MeasuredAt);
        for (var index = 0; index < readings.Count; index++)
        {
            var reading = readings[index];
            Assert.Equal(TimeSpan.Zero, reading.MeasuredAt.Offset);
            Assert.InRange(reading.SolarPowerW, 0, 5000);
            Assert.InRange(reading.ConsumptionPowerW, 100, 3000);
            Assert.InRange(reading.BatteryStateOfChargePercent, 0, 100);
            if (index > 0) Assert.Equal(TimeSpan.FromMinutes(1), reading.MeasuredAt - readings[index - 1].MeasuredAt);
        }
    }

    [Theory]
    [InlineData("--count", "0")]
    [InlineData("--count", "121")]
    [InlineData("--count", "1.5")]
    [InlineData("--seed", "2147483648")]
    [InlineData("--end-at", "2026-10-01T12:00:00")]
    [InlineData("--end-at", "invalid")]
    [InlineData("--api-url", "https://example.com")]
    [InlineData("--api-url", "http://user:secret@localhost:5171")]
    [InlineData("--api-url", "http://localhost:5171/path")]
    [InlineData("--api-url", "http://localhost:5171?key=value")]
    [InlineData("--unknown", "1")]
    public void Rejects_invalid_options(string name, string value) =>
        Assert.Throws<ArgumentException>(() => SimulatorOptions.Parse([name, value]));

    [Fact]
    public void Validates_duplicate_missing_options_and_normalizes_controlled_end()
    {
        Assert.Throws<ArgumentException>(() => SimulatorOptions.Parse(["--count"]));
        Assert.Throws<ArgumentException>(() => SimulatorOptions.Parse(["--count", "1", "--count", "2"]));
        var parsed = SimulatorOptions.Parse(["--count", "2", "--seed", "-42", "--end-at", "2026-10-01T08:00:00.1234567-04:00"]);
        Assert.Equal(Now, parsed.EndAt);
        Assert.Equal(2, parsed.Count);
        Assert.Equal(-42, parsed.Seed);
        Assert.Equal(10, SimulatorOptions.Parse([]).Count);
    }

    [Fact]
    public async Task Ordinary_mode_uses_server_time_without_the_host_clock()
    {
        var handler = new StubHandler();
        using var client = new HttpClient(handler) { BaseAddress = new Uri("http://localhost") };
        using var output = new StringWriter();
        var options = SimulatorOptions.Parse(["--count", "2"]);
        Assert.Equal(0, await SimulatorRunner.RunAsync(options, client, output));
        Assert.Equal(ReadingTimestamp.Normalize(Now), handler.Submitted[^1].MeasuredAt);
        Assert.Contains("accepted=2, rejected=0, errors=0, unattempted=0", output.ToString());
    }

    [Theory]
    [InlineData(400, 2, 2, 0)]
    [InlineData(409, 2, 2, 0)]
    [InlineData(503, 1, 0, 1)]
    [InlineData(302, 1, 0, 1)]
    public async Task Rejections_continue_but_unexpected_HTTP_stops_with_nonzero_exit(int status, int attempted, int rejected, int errors)
    {
        var handler = new StubHandler { Status = (HttpStatusCode)status };
        using var client = new HttpClient(handler) { BaseAddress = new Uri("http://localhost") };
        using var output = new StringWriter();
        Assert.Equal(1, await SimulatorRunner.RunAsync(SimulatorOptions.Parse(["--count", "2"]), client, output));
        Assert.Equal(attempted, handler.Submitted.Count);
        Assert.Contains($"accepted=0, rejected={rejected}, errors={errors}", output.ToString());
        Assert.Contains($"HTTP {status}", output.ToString());
    }

    [Fact]
    public async Task Future_batch_is_rejected_before_any_submission()
    {
        var handler = new StubHandler();
        using var client = new HttpClient(handler) { BaseAddress = new Uri("http://localhost") };
        using var output = new StringWriter();
        Assert.Equal(1, await SimulatorRunner.RunAsync(new(new Uri("http://localhost"), 2, 42, Now.AddMinutes(1)), client, output));
        Assert.Empty(handler.Submitted);
        Assert.Contains("attempted=0", output.ToString());
    }

    [Fact]
    public async Task Submicrosecond_future_end_is_rejected_before_truncation()
    {
        var handler = new StubHandler();
        using var client = new HttpClient(handler) { BaseAddress = new Uri("http://localhost") };
        using var output = new StringWriter();
        var options = SimulatorOptions.Parse(["--end-at", Now.AddTicks(1).ToString("O")]);
        Assert.Equal(1, await SimulatorRunner.RunAsync(options, client, output));
        Assert.Empty(handler.Submitted);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task Network_or_invalid_acknowledgment_stops_without_claiming_success(bool networkFailure)
    {
        var handler = new StubHandler { NetworkFailure = networkFailure, InvalidAcknowledgment = !networkFailure };
        using var client = new HttpClient(handler) { BaseAddress = new Uri("http://localhost") };
        using var output = new StringWriter();
        Assert.Equal(1, await SimulatorRunner.RunAsync(SimulatorOptions.Parse(["--count", "2"]), client, output));
        Assert.Single(handler.Submitted);
        Assert.Contains("accepted=0, rejected=0, errors=1, unattempted=1", output.ToString());
        Assert.Contains("may have persisted", output.ToString());
    }

    private sealed class StubHandler : HttpMessageHandler
    {
        public HttpStatusCode Status { get; init; } = HttpStatusCode.Created;
        public bool NetworkFailure { get; init; }
        public bool InvalidAcknowledgment { get; init; }
        public List<ReadingSnapshot> Submitted { get; } = [];

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            if (request.Method == HttpMethod.Get)
                return new(HttpStatusCode.OK) { Content = JsonContent.Create(new LatestReadingResponse(Now, null)) };
            var reading = (await request.Content!.ReadFromJsonAsync<ReadingSnapshot>(cancellationToken))!;
            Submitted.Add(reading);
            if (NetworkFailure) throw new HttpRequestException("Do not expose transport details.");
            return new(Status) { Content = JsonContent.Create(new LatestReadingResponse(Now, InvalidAcknowledgment ? null : reading)) };
        }
    }
}
