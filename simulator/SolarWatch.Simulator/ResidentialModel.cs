namespace SolarWatch.Simulator;

// Instantaneous synthetic model shared by the 24-hour profile and live continuous mode.
// Fixed formulas: docs/architecture/residential-history-profile.md.
public sealed class ResidentialModel
{
    private readonly double solarPhase1, solarPhase2, homePhase1, homePhase2;

    public ResidentialModel(int seed)
    {
        var random = new Random(seed);
        solarPhase1 = random.NextDouble() * 2 * Math.PI;
        solarPhase2 = random.NextDouble() * 2 * Math.PI;
        homePhase1 = random.NextDouble() * 2 * Math.PI;
        homePhase2 = random.NextDouble() * 2 * Math.PI;
    }

    // Electrical parameters (live mode only; the 24-hour profile stays unchanged). Smooth, bounded,
    // deterministic functions of time: 230 V grid, 50 Hz, inverter heating with solar output,
    // and a 48 V battery bank whose voltage follows charge and sags under load.
    public double GridVoltageV(double hour) => Math.Round(230 + 2.5 * Math.Sin(2 * Math.PI * hour * 6 + solarPhase1)
        + 0.8 * Math.Sin(2 * Math.PI * hour * 40 + homePhase1), 1);

    public double GridFrequencyHz(double hour) => Math.Round(50 + 0.04 * Math.Sin(2 * Math.PI * hour * 20 + homePhase2)
        + 0.015 * Math.Sin(2 * Math.PI * hour * 90 + solarPhase2), 2);

    public static double InverterTemperatureC(double solarW, double homeW) =>
        Math.Round(24 + 22 * solarW / 4200 + 4 * homeW / 3000, 1);

    public static double BatteryVoltageV(double chargePercent, double netW) =>
        Math.Round(44 + 0.12 * chargePercent + Math.Clamp(netW, -2000, 2000) / 2000 * 0.8, 2);

    public static double Hour(DateTimeOffset at) => at.UtcDateTime.TimeOfDay.TotalHours;

    public double SolarW(double hour)
    {
        var daylight = hour > 11 && hour < 23 ? Math.Sin(Math.PI * (hour - 11) / 12) : 0;
        var modulation = 0.97 + 0.02 * Math.Sin(2 * Math.PI * hour / 2 + solarPhase1)
            + 0.01 * Math.Sin(2 * Math.PI * hour / 0.75 + solarPhase2);
        return Math.Round(4200 * daylight * daylight * modulation, MidpointRounding.AwayFromZero);
    }

    public double HomeW(double hour) => Math.Round(350 + Activity(hour, 12, 900, 1.25) + Activity(hour, 18, 350, 2)
        + Activity(hour, 1, 1300, 1.5) + 60 * Math.Sin(2 * Math.PI * hour / 3 + homePhase1)
        + 30 * Math.Sin(2 * Math.PI * hour + homePhase2), MidpointRounding.AwayFromZero);

    private static double Activity(double hour, double center, double amplitude, double width)
    {
        var distance = Math.Abs(hour - center);
        distance = Math.Min(distance, 24 - distance);
        return amplitude * Math.Exp(-0.5 * Math.Pow(distance / width, 2));
    }
}
