using SolarWatch.Application;
using SolarWatch.Domain;

namespace SolarWatch.UnitTests;

public class GetReadingHistoryTests
{
    private static readonly DateTimeOffset Now = DateTimeOffset.Parse("2026-10-30T12:34:56.123456Z");

    [Theory]
    [InlineData("2026-10-30T12:34:56.1234567Z")]
    [InlineData("2026-10-30T08:34:56.1234567-04:00")]
    public async Task Captures_one_normalized_UTC_reference_before_storage_and_keeps_the_original_bounds(string instant)
    {
        var clock = new Clock(DateTimeOffset.Parse(instant));
        var started = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var complete = new TaskCompletionSource<IReadOnlyList<InstallationReading>>(TaskCreationOptions.RunContinuationsAsynchronously);
        var store = new Store((from, to, token) =>
        {
            Assert.Equal(1, clock.Reads);
            Assert.Equal(Now.AddHours(-24), from);
            Assert.Equal(Now, to);
            Assert.Equal(TimeSpan.Zero, from.Offset);
            Assert.Equal(TimeSpan.Zero, to.Offset);
            started.SetResult();
            return complete.Task.WaitAsync(token);
        });
        var pending = new GetReadingHistory(store, clock).ExecuteAsync(default);
        await started.Task.WaitAsync(TimeSpan.FromSeconds(5));
        clock.Now = Now.AddDays(1);
        complete.SetResult([]);
        var result = await pending;
        Assert.Equal(1, clock.Reads);
        Assert.Equal(Now, result.AsOf);
        Assert.Equal(result.AsOf, result.To);
        Assert.Equal(Now.AddHours(-24), result.From);
        Assert.Equal(TimeSpan.FromHours(24), result.To - result.From);
        Assert.Empty(result.Readings);
    }

    [Fact]
    public async Task Maps_persisted_samples_in_storage_order_without_filling_gaps_or_replacing_zero()
    {
        InstallationReading[] readings = [
            InstallationReading.Create(Now.AddHours(-24), 0, 0, 0, Now),
            InstallationReading.Create(Now.AddMinutes(-17).AddTicks(-10), 1700.5, 800.25, 100, Now),
            InstallationReading.Create(Now, 42, 11, 65, Now)
        ];
        using var stop = new CancellationTokenSource();
        var store = new Store((_, _, token) =>
        {
            Assert.Equal(stop.Token, token);
            return Task.FromResult<IReadOnlyList<InstallationReading>>(readings);
        });
        var response = await new GetReadingHistory(store, new Clock(Now)).ExecuteAsync(stop.Token);
        Assert.Equal(readings.Select(ReadingSnapshot.From), response.Readings);
        Assert.Equal(3, response.Readings.Count);
    }

    [Fact]
    public async Task Already_cancelled_request_does_not_read_the_clock_or_storage()
    {
        var clock = new Clock(Now);
        var store = new Store((_, _, _) => throw new InvalidOperationException("Storage must not be called."));
        using var stop = new CancellationTokenSource();
        stop.Cancel();
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            new GetReadingHistory(store, clock).ExecuteAsync(stop.Token));
        Assert.Equal(0, clock.Reads);
    }

    [Fact]
    public async Task Cancellation_interrupts_pending_storage_instead_of_returning_an_empty_history()
    {
        using var stop = new CancellationTokenSource();
        var started = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var store = new Store(async (_, _, token) =>
        {
            Assert.Equal(stop.Token, token);
            started.SetResult();
            await Task.Delay(Timeout.InfiniteTimeSpan, token);
            return [];
        });
        var pending = new GetReadingHistory(store, new Clock(Now)).ExecuteAsync(stop.Token);
        await started.Task.WaitAsync(TimeSpan.FromSeconds(5));
        stop.Cancel();
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => pending);
    }

    [Fact]
    public async Task Storage_failure_is_not_reported_as_an_empty_history()
    {
        var failure = new InvalidOperationException("Storage failed.");
        var store = new Store((_, _, _) => throw failure);
        var thrown = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            new GetReadingHistory(store, new Clock(Now)).ExecuteAsync(default));
        Assert.Same(failure, thrown);
    }

    private sealed class Clock(DateTimeOffset now) : TimeProvider
    {
        public DateTimeOffset Now { get; set; } = now;
        public int Reads { get; private set; }
        public override DateTimeOffset GetUtcNow() { Reads++; return Now; }
    }

    private sealed class Store(Func<DateTimeOffset, DateTimeOffset, CancellationToken,
        Task<IReadOnlyList<InstallationReading>>> query) : IReadingStore
    {
        public Task<IReadOnlyList<InstallationReading>> GetHistoryAsync(DateTimeOffset from, DateTimeOffset to,
            CancellationToken cancellationToken) => query(from, to, cancellationToken);
        public Task<InstallationReading?> GetLatestAsync(CancellationToken cancellationToken) => throw new NotSupportedException();
        public Task<bool> TryAddAsync(InstallationReading reading, CancellationToken cancellationToken) => throw new NotSupportedException();
    }
}
