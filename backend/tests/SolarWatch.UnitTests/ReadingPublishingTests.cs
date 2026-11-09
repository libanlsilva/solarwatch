using SolarWatch.Application;
using SolarWatch.Domain;

namespace SolarWatch.UnitTests;

public class ReadingPublishingTests
{
    private static readonly DateTimeOffset Now = DateTimeOffset.Parse("2026-10-01T12:00:00Z");
    private static readonly SubmitReadingRequest Valid = new("residential-demo", "2026-10-01T11:59:00Z", 10, 20, 30);

    [Fact]
    public async Task Publishes_the_acknowledged_snapshot_only_after_a_committed_insert()
    {
        var publisher = new Recorder();
        var result = await new SubmitReading(new Store(true), new Clock(), publisher).ExecuteAsync(Valid, default);
        Assert.Equal([result.Accepted], publisher.Published);
    }

    [Fact]
    public async Task Duplicates_and_invalid_readings_publish_nothing()
    {
        var publisher = new Recorder();
        Assert.True((await new SubmitReading(new Store(false), new Clock(), publisher).ExecuteAsync(Valid, default)).IsDuplicate);
        Assert.NotEmpty((await new SubmitReading(new Store(true), new Clock(), publisher)
            .ExecuteAsync(Valid with { SolarPowerW = -1 }, default)).Errors);
        Assert.Empty(publisher.Published);
    }

    [Fact]
    public async Task A_failing_publisher_does_not_fail_the_committed_ingestion()
    {
        var result = await new SubmitReading(new Store(true), new Clock(), new Recorder { Fail = true }).ExecuteAsync(Valid, default);
        Assert.NotNull(result.Accepted);
        Assert.Empty(result.Errors);
    }

    private sealed class Clock : TimeProvider { public override DateTimeOffset GetUtcNow() => Now; }
    private sealed class Recorder : IReadingPublisher
    {
        public List<LatestReadingResponse> Published { get; } = [];
        public bool Fail { get; init; }
        public Task PublishAsync(LatestReadingResponse reading, CancellationToken cancellationToken)
        {
            if (Fail) throw new InvalidOperationException("hub down");
            Published.Add(reading);
            return Task.CompletedTask;
        }
    }
    private sealed class Store(bool accepts) : IReadingStore
    {
        public Task<IReadOnlyList<InstallationReading>> GetHistoryAsync(DateTimeOffset from, DateTimeOffset to, CancellationToken c) => throw new NotSupportedException();
        public Task<InstallationReading?> GetLatestAsync(CancellationToken c) => throw new NotSupportedException();
        public Task<bool> TryAddAsync(InstallationReading reading, CancellationToken c) => Task.FromResult(accepts);
    }
}
