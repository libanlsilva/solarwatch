using SolarWatch.Application;
using SolarWatch.Domain;

namespace SolarWatch.UnitTests;

public class GetLatestReadingTests
{
    [Fact]
    public async Task Empty_result_still_has_a_server_reference_time()
    {
        var now = DateTimeOffset.Parse("2026-10-01T12:00:00Z");
        var response = await new GetLatestReading(new StubStore(null), new FixedClock(now)).ExecuteAsync(default);
        Assert.Equal(now, response.AsOf);
        Assert.Null(response.Reading);
    }

    [Fact]
    public async Task Preserves_the_complete_snapshot_and_forwards_cancellation()
    {
        var now = DateTimeOffset.Parse("2026-10-01T12:00:00Z");
        var reading = InstallationReading.Create(now.AddMinutes(-1), 1200, 800, 65, now);
        var store = new StubStore(reading);
        using var cancellation = new CancellationTokenSource();
        var response = await new GetLatestReading(store, new FixedClock(now)).ExecuteAsync(cancellation.Token);
        Assert.Equal(cancellation.Token, store.Token);
        Assert.Equal(now, response.AsOf);
        Assert.Equal(new ReadingSnapshot("residential-demo", reading.MeasuredAt, 1200, 800, 65), response.Reading);
    }

    private sealed class FixedClock(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }

    private sealed class StubStore(InstallationReading? reading) : IReadingStore
    {
        public CancellationToken Token { get; private set; }
        public Task<InstallationReading?> GetLatestAsync(CancellationToken cancellationToken)
        {
            Token = cancellationToken;
            return Task.FromResult(reading);
        }
    }
}
