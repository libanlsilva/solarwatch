namespace SolarWatch.Application;

public sealed record ReadingSnapshot(string InstallationId, DateTimeOffset MeasuredAt,
    double SolarPowerW, double ConsumptionPowerW, double BatteryStateOfChargePercent);
public sealed record LatestReadingResponse(DateTimeOffset AsOf, ReadingSnapshot? Reading);

public sealed class GetLatestReading(IReadingStore store, TimeProvider clock)
{
    public async Task<LatestReadingResponse> ExecuteAsync(CancellationToken cancellationToken)
    {
        var reading = await store.GetLatestAsync(cancellationToken);
        var asOf = clock.GetUtcNow();
        return new LatestReadingResponse(asOf, reading is null ? null : new ReadingSnapshot(
            reading.InstallationId, reading.MeasuredAt, reading.SolarPowerW,
            reading.ConsumptionPowerW, reading.BatteryStateOfChargePercent));
    }
}
