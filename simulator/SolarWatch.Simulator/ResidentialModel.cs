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
