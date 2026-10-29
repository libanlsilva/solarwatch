using SolarWatch.Application;
using SolarWatch.Domain;

namespace SolarWatch.Simulator;

public static class ReadingGenerator
{
    public static IReadOnlyList<ReadingSnapshot> Generate(int count, int seed, DateTimeOffset endAt)
    {
        if (count is < 1 or > SimulatorOptions.MaxCount) throw new ArgumentOutOfRangeException(nameof(count));
        var end = ReadingTimestamp.Normalize(endAt);
        var start = end.AddMinutes(-(count - 1));
        var random = new Random(seed);
        return Enumerable.Range(0, count).Select(index => new ReadingSnapshot(
            InstallationReading.DemoInstallationId, start.AddMinutes(index),
            random.Next(0, 5001), random.Next(100, 3001), random.Next(0, 101))).ToArray();
    }
}
