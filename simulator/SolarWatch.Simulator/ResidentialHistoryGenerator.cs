using SolarWatch.Application;
using SolarWatch.Domain;

namespace SolarWatch.Simulator;

// Fixed synthetic model: docs/architecture/residential-history-profile.md.
public static class ResidentialHistoryGenerator
{
    public static IReadOnlyList<ReadingSnapshot> Generate(int seed, DateTimeOffset endAt)
    {
        var start = ReadingTimestamp.Normalize(endAt).AddHours(-24);
        var model = new ResidentialModel(seed);
        var readings = new List<ReadingSnapshot>(ReadingGenerator.HistoryReadingCount);
        var charge = 50m;
        for (var index = 0; index < ReadingGenerator.HistoryReadingCount; index++)
        {
            var at = start.AddMinutes(index);
            var hour = ResidentialModel.Hour(at);
            var solar = model.SolarW(hour);
            var home = model.HomeW(hour);
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
}
