using SolarWatch.Application;
using SolarWatch.Domain;

namespace SolarWatch.Simulator;

// Fixed synthetic model: docs/architecture/residential-history-profile.md.
public static class ResidentialHistoryGenerator
{
    public static IReadOnlyList<ReadingSnapshot> Generate(int seed, DateTimeOffset endAt)
    {
        var start = ReadingTimestamp.Normalize(endAt).AddHours(-24);
        var random = new Random(seed);
        var solarPhase1 = random.NextDouble() * 2 * Math.PI;
        var solarPhase2 = random.NextDouble() * 2 * Math.PI;
        var homePhase1 = random.NextDouble() * 2 * Math.PI;
        var homePhase2 = random.NextDouble() * 2 * Math.PI;
        var readings = new List<ReadingSnapshot>(ReadingGenerator.HistoryReadingCount);
        var charge = 50m;
        for (var index = 0; index < ReadingGenerator.HistoryReadingCount; index++)
        {
            var at = start.AddMinutes(index);
            var hour = at.UtcDateTime.TimeOfDay.TotalHours;
            var daylight = hour > 11 && hour < 23 ? Math.Sin(Math.PI * (hour - 11) / 12) : 0;
            var modulation = 0.97 + 0.02 * Math.Sin(2 * Math.PI * hour / 2 + solarPhase1)
                + 0.01 * Math.Sin(2 * Math.PI * hour / 0.75 + solarPhase2);
            var solar = Math.Round(4200 * daylight * daylight * modulation, MidpointRounding.AwayFromZero);
            var home = Math.Round(350 + Activity(hour, 12, 900, 1.25) + Activity(hour, 18, 350, 2)
                + Activity(hour, 1, 1300, 1.5) + 60 * Math.Sin(2 * Math.PI * hour / 3 + homePhase1)
                + 30 * Math.Sin(2 * Math.PI * hour + homePhase2), MidpointRounding.AwayFromZero);
            if (index > 0)
            {
                var previous = readings[^1];
                var balance = ((decimal)previous.SolarPowerW - (decimal)previous.ConsumptionPowerW
                    + (decimal)solar - (decimal)home) / 2m;
                // 100 / (10,000 Wh * 60 minutes/hour); retain unrounded internal charge.
                charge = Math.Clamp(charge + Math.Clamp(balance, -2000m, 2000m) / 6000m, 0m, 100m);
            }
            readings.Add(new(InstallationReading.DemoInstallationId, at, solar, home,
                (double)decimal.Round(charge, 2, MidpointRounding.AwayFromZero)));
        }
        return readings;
    }

    private static double Activity(double hour, double center, double amplitude, double width)
    {
        var distance = Math.Abs(hour - center);
        distance = Math.Min(distance, 24 - distance);
        return amplitude * Math.Exp(-0.5 * Math.Pow(distance / width, 2));
    }
}
