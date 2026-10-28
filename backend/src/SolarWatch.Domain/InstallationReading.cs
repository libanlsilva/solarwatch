namespace SolarWatch.Domain;

public sealed class InstallationReading
{
    public const string DemoInstallationId = "residential-demo";
    private InstallationReading() { }
    public string InstallationId { get; private set; } = DemoInstallationId;
    public DateTimeOffset MeasuredAt { get; private set; }
    public double SolarPowerW { get; private set; }
    public double ConsumptionPowerW { get; private set; }
    public double BatteryStateOfChargePercent { get; private set; }

    public static InstallationReading Create(DateTimeOffset measuredAt, double solarPowerW,
        double consumptionPowerW, double batteryStateOfChargePercent, DateTimeOffset asOf)
    {
        if (measuredAt > asOf)
            throw new ArgumentOutOfRangeException(nameof(measuredAt), "A reading cannot be in the future.");
        if (!double.IsFinite(solarPowerW) || solarPowerW < 0)
            throw new ArgumentOutOfRangeException(nameof(solarPowerW));
        if (!double.IsFinite(consumptionPowerW) || consumptionPowerW < 0)
            throw new ArgumentOutOfRangeException(nameof(consumptionPowerW));
        if (!double.IsFinite(batteryStateOfChargePercent) || batteryStateOfChargePercent is < 0 or > 100)
            throw new ArgumentOutOfRangeException(nameof(batteryStateOfChargePercent));
        return new InstallationReading
        {
            MeasuredAt = measuredAt.ToUniversalTime(),
            SolarPowerW = solarPowerW,
            ConsumptionPowerW = consumptionPowerW,
            BatteryStateOfChargePercent = batteryStateOfChargePercent
        };
    }
}
