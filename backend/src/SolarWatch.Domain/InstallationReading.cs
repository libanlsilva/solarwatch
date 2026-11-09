namespace SolarWatch.Domain;

public sealed class InstallationReading
{
    public const string DemoInstallationId = "residential-demo";
    // Plausible residential bounds. Optional electrical parameters are null for pre-v0.2 readings.
    public const double MaxVoltageV = 1000, MinFrequencyHz = 40, MaxFrequencyHz = 70,
        MinTemperatureC = -40, MaxTemperatureC = 150;
    private InstallationReading() { }
    public string InstallationId { get; private set; } = DemoInstallationId;
    public DateTimeOffset MeasuredAt { get; private set; }
    public double SolarPowerW { get; private set; }
    public double ConsumptionPowerW { get; private set; }
    public double BatteryStateOfChargePercent { get; private set; }
    public double? GridVoltageV { get; private set; }
    public double? GridFrequencyHz { get; private set; }
    public double? InverterTemperatureC { get; private set; }
    public double? BatteryVoltageV { get; private set; }

    public static bool IsValidOptional(double? value, double min, double max) =>
        value is null || (double.IsFinite(value.Value) && value.Value >= min && value.Value <= max);

    public static InstallationReading Create(DateTimeOffset measuredAt, double solarPowerW,
        double consumptionPowerW, double batteryStateOfChargePercent, DateTimeOffset asOf,
        double? gridVoltageV = null, double? gridFrequencyHz = null,
        double? inverterTemperatureC = null, double? batteryVoltageV = null)
    {
        if (measuredAt > asOf)
            throw new ArgumentOutOfRangeException(nameof(measuredAt), "A reading cannot be in the future.");
        if (!double.IsFinite(solarPowerW) || solarPowerW < 0)
            throw new ArgumentOutOfRangeException(nameof(solarPowerW));
        if (!double.IsFinite(consumptionPowerW) || consumptionPowerW < 0)
            throw new ArgumentOutOfRangeException(nameof(consumptionPowerW));
        if (!double.IsFinite(batteryStateOfChargePercent) || batteryStateOfChargePercent is < 0 or > 100)
            throw new ArgumentOutOfRangeException(nameof(batteryStateOfChargePercent));
        if (!IsValidOptional(gridVoltageV, 0, MaxVoltageV)) throw new ArgumentOutOfRangeException(nameof(gridVoltageV));
        if (!IsValidOptional(gridFrequencyHz, MinFrequencyHz, MaxFrequencyHz)) throw new ArgumentOutOfRangeException(nameof(gridFrequencyHz));
        if (!IsValidOptional(inverterTemperatureC, MinTemperatureC, MaxTemperatureC)) throw new ArgumentOutOfRangeException(nameof(inverterTemperatureC));
        if (!IsValidOptional(batteryVoltageV, 0, MaxVoltageV)) throw new ArgumentOutOfRangeException(nameof(batteryVoltageV));
        return new InstallationReading
        {
            MeasuredAt = ReadingTimestamp.Normalize(measuredAt),
            SolarPowerW = solarPowerW,
            ConsumptionPowerW = consumptionPowerW,
            BatteryStateOfChargePercent = batteryStateOfChargePercent,
            GridVoltageV = gridVoltageV,
            GridFrequencyHz = gridFrequencyHz,
            InverterTemperatureC = inverterTemperatureC,
            BatteryVoltageV = batteryVoltageV
        };
    }
}
