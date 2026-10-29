using System.Threading.Channels;

namespace SolarWatch.TestSupport;

// A test-only monotonic clock for the one-shot timers used by Task.Delay.
internal sealed class ManualTimeProvider : TimeProvider
{
    private readonly object gate = new();
    private readonly List<ManualTimer> timers = [];
    private readonly Channel<TimeSpan> scheduled = Channel.CreateUnbounded<TimeSpan>();
    private long ticks;
    public override long TimestampFrequency => TimeSpan.TicksPerSecond;
    public override long GetTimestamp() { lock (gate) return ticks; }
    // Deliberately unrelated to server time. Production scheduling must never use this as measuredAt.
    public override DateTimeOffset GetUtcNow() => DateTimeOffset.Parse("2040-01-01T00:00:00Z").AddTicks(GetTimestamp());

    public Task<TimeSpan> NextDelayAsync() => scheduled.Reader.ReadAsync().AsTask().WaitAsync(TimeSpan.FromSeconds(5));

    public override ITimer CreateTimer(TimerCallback callback, object? state, TimeSpan dueTime, TimeSpan period)
    {
        if (period != Timeout.InfiniteTimeSpan) throw new NotSupportedException("Tests expect a one-shot delay, not periodic queued work.");
        var timer = new ManualTimer(this, callback, state);
        timer.Change(dueTime, period);
        scheduled.Writer.TryWrite(dueTime);
        return timer;
    }

    public void Advance(TimeSpan elapsed)
    {
        if (elapsed < TimeSpan.Zero) throw new ArgumentOutOfRangeException(nameof(elapsed));
        List<ManualTimer> ready;
        lock (gate)
        {
            ticks += elapsed.Ticks;
            ready = timers.Where(timer => timer.Due <= ticks).ToList();
            foreach (var timer in ready) timer.Due = long.MaxValue;
        }
        foreach (var timer in ready) timer.Fire();
    }

    private sealed class ManualTimer(ManualTimeProvider owner, TimerCallback callback, object? state) : ITimer
    {
        public long Due { get; set; } = long.MaxValue;
        private bool disposed;
        public bool Change(TimeSpan dueTime, TimeSpan period)
        {
            if (period != Timeout.InfiniteTimeSpan) throw new NotSupportedException();
            lock (owner.gate)
            {
                if (disposed) return false;
                Due = dueTime == Timeout.InfiniteTimeSpan ? long.MaxValue : owner.ticks + dueTime.Ticks;
                if (!owner.timers.Contains(this)) owner.timers.Add(this);
                return true;
            }
        }
        public void Fire() { lock (owner.gate) { if (disposed) return; } callback(state); }
        public void Dispose() { lock (owner.gate) { disposed = true; owner.timers.Remove(this); } }
        public ValueTask DisposeAsync() { Dispose(); return ValueTask.CompletedTask; }
    }
}
