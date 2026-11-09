using SolarWatch.Domain;

namespace SolarWatch.Application;

public sealed record SubmitReadingRequest(string? InstallationId, string? MeasuredAt,
    double? SolarPowerW, double? ConsumptionPowerW, double? BatteryStateOfChargePercent,
    double? GridVoltageV = null, double? GridFrequencyHz = null,
    double? InverterTemperatureC = null, double? BatteryVoltageV = null);

public sealed record SubmitReadingResult(LatestReadingResponse? Accepted,
    Dictionary<string, string[]> Errors, bool IsDuplicate = false);

public sealed class SubmitReading(IReadingStore store, TimeProvider clock, IReadingPublisher? publisher = null)
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
        if (!InstallationReading.IsValidOptional(request.GridVoltageV, 0, InstallationReading.MaxVoltageV))
            errors["gridVoltageV"] = ["Supply a finite voltage between 0 and 1000 V, or omit it."];
        if (!InstallationReading.IsValidOptional(request.GridFrequencyHz, InstallationReading.MinFrequencyHz, InstallationReading.MaxFrequencyHz))
            errors["gridFrequencyHz"] = ["Supply a finite frequency between 40 and 70 Hz, or omit it."];
        if (!InstallationReading.IsValidOptional(request.InverterTemperatureC, InstallationReading.MinTemperatureC, InstallationReading.MaxTemperatureC))
            errors["inverterTemperatureC"] = ["Supply a finite temperature between -40 and 150 °C, or omit it."];
        if (!InstallationReading.IsValidOptional(request.BatteryVoltageV, 0, InstallationReading.MaxVoltageV))
            errors["batteryVoltageV"] = ["Supply a finite voltage between 0 and 1000 V, or omit it."];
        if (errors.Count > 0) return new(null, errors);

        var reading = InstallationReading.Create(measuredAt, request.SolarPowerW!.Value,
            request.ConsumptionPowerW!.Value, request.BatteryStateOfChargePercent!.Value, now,
            request.GridVoltageV, request.GridFrequencyHz, request.InverterTemperatureC, request.BatteryVoltageV);
        if (!await store.TryAddAsync(reading, cancellationToken)) return new(null, errors, IsDuplicate: true);
        var accepted = new LatestReadingResponse(clock.GetUtcNow(), ReadingSnapshot.From(reading));
        await PublishBestEffortAsync(accepted);
        return new(accepted, errors);
    }

    // A live-push failure must never fail or undo an already committed ingestion, and a slow
    // subscriber must not delay the acknowledgment: the push gets its own short deadline.
    private async Task PublishBestEffortAsync(LatestReadingResponse accepted)
    {
        if (publisher is null) return;
        try
        {
            using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(2));
            await publisher.PublishAsync(accepted, timeout.Token);
        }
        catch (Exception)
        {
            // Subscribers resynchronize through /api/readings/latest after reconnecting.
        }
    }
}
