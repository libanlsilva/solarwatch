using SolarWatch.Domain;

namespace SolarWatch.Application;

public sealed record ReadingHistoryResponse(DateTimeOffset AsOf, DateTimeOffset From,
    DateTimeOffset To, IReadOnlyList<ReadingSnapshot> Readings);

public sealed class GetReadingHistory(IReadingStore store, TimeProvider clock)
{
    public async Task<ReadingHistoryResponse> ExecuteAsync(CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var asOf = ReadingTimestamp.Normalize(clock.GetUtcNow());
        var from = asOf.AddHours(-24);
        var readings = await store.GetHistoryAsync(from, asOf, cancellationToken);
        return new ReadingHistoryResponse(asOf, from, asOf, readings.Select(ReadingSnapshot.From).ToArray());
    }
}
