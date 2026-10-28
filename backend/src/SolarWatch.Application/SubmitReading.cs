using SolarWatch.Domain;

namespace SolarWatch.Application;

public sealed record SubmitReadingRequest(string? InstallationId, string? MeasuredAt,
    double? SolarPowerW, double? ConsumptionPowerW, double? BatteryStateOfChargePercent);

public sealed record SubmitReadingResult(LatestReadingResponse? Accepted,
    Dictionary<string, string[]> Errors, bool IsDuplicate = false);

public sealed class SubmitReading(IReadingStore store, TimeProvider clock)
{
    public async Task<SubmitReadingResult> ExecuteAsync(SubmitReadingRequest request, CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>();
        var now = clock.GetUtcNow();
        if (request.InstallationId != InstallationReading.DemoInstallationId)
            errors["installationId"] = ["Use residential-demo, the only supported installation."];
        if (!ReadingTimestamp.TryParse(request.MeasuredAt, out var measuredAt))
            errors["measuredAt"] = ["Use an ISO 8601 timestamp with seconds and an explicit Z or UTC offset."];
        else if (measuredAt > now)
            errors["measuredAt"] = ["A reading cannot be in the future."];
        if (request.SolarPowerW is not { } solar || !double.IsFinite(solar) || solar < 0)
            errors["solarPowerW"] = ["Supply finite, non-negative power in W."];
        if (request.ConsumptionPowerW is not { } consumption || !double.IsFinite(consumption) || consumption < 0)
            errors["consumptionPowerW"] = ["Supply finite, non-negative power in W."];
        if (request.BatteryStateOfChargePercent is not { } charge || !double.IsFinite(charge) || charge is < 0 or > 100)
            errors["batteryStateOfChargePercent"] = ["Supply a finite percentage between 0 and 100."];
        if (errors.Count > 0) return new(null, errors);

        var reading = InstallationReading.Create(measuredAt, request.SolarPowerW!.Value,
            request.ConsumptionPowerW!.Value, request.BatteryStateOfChargePercent!.Value, now);
        if (!await store.TryAddAsync(reading, cancellationToken)) return new(null, errors, IsDuplicate: true);
        return new(new LatestReadingResponse(clock.GetUtcNow(), ReadingSnapshot.From(reading)), errors);
    }
}
