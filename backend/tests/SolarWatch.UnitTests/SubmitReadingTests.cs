using SolarWatch.Application;
using SolarWatch.Domain;

namespace SolarWatch.UnitTests;

public class SubmitReadingTests
{
    private static readonly DateTimeOffset Now = DateTimeOffset.Parse("2026-10-01T12:00:00Z");

    [Fact]
    public async Task Reuses_domain_rules_normalizes_precision_and_forwards_cancellation()
    {
        var store = new RecordingStore();
        using var cancellation = new CancellationTokenSource();
        var result = await new SubmitReading(store, new Clock()).ExecuteAsync(
            new("residential-demo", "2026-10-01T07:59:00.1234567-04:00", 0, 0, 100), cancellation.Token);
        Assert.Empty(result.Errors);
        Assert.False(result.IsDuplicate);
        Assert.Equal(Now, result.Accepted?.AsOf);
        Assert.Equal(DateTimeOffset.Parse("2026-10-01T11:59:00.123456Z"), result.Accepted?.Reading?.MeasuredAt);
        Assert.Equal(cancellation.Token, store.Token);
        Assert.Equal(ReadingSnapshot.From(store.Reading!), result.Accepted?.Reading);
    }

    [Fact]
    public async Task Invalid_fields_are_reported_together_without_calling_storage()
    {
        var store = new RecordingStore();
        var result = await new SubmitReading(store, new Clock()).ExecuteAsync(
            new("other", "2026-10-01T11:59:00", double.NaN, double.PositiveInfinity, -1), default);
        Assert.Equal(5, result.Errors.Count);
        Assert.Null(store.Reading);
        Assert.Null(result.Accepted);
    }

    [Fact]
    public async Task Future_is_checked_before_timestamp_truncation()
    {
        var store = new RecordingStore();
        var result = await new SubmitReading(store, new Clock()).ExecuteAsync(
            new("residential-demo", "2026-10-01T12:00:00.0000001Z", 0, 0, 0), default);
        Assert.Contains("measuredAt", result.Errors.Keys);
        Assert.Null(store.Reading);
    }

    [Fact]
    public async Task Storage_conflict_is_not_reported_as_an_acceptance()
    {
        var result = await new SubmitReading(new RecordingStore(false), new Clock()).ExecuteAsync(
            new("residential-demo", "2026-10-01T11:59:00Z", 1, 1, 1), default);
        Assert.True(result.IsDuplicate);
        Assert.Null(result.Accepted);
        Assert.Empty(result.Errors);
    }

    private sealed class Clock : TimeProvider { public override DateTimeOffset GetUtcNow() => Now; }
    private sealed class RecordingStore(bool accepts = true) : IReadingStore
    {
        public InstallationReading? Reading { get; private set; }
        public CancellationToken Token { get; private set; }
        public Task<InstallationReading?> GetLatestAsync(CancellationToken cancellationToken) => throw new NotSupportedException();
        public Task<bool> TryAddAsync(InstallationReading reading, CancellationToken cancellationToken)
        {
            Reading = reading;
            Token = cancellationToken;
            return Task.FromResult(accepts);
        }
    }
}
