using System.Security.Cryptography;
using System.Text;
using SolarWatch.Domain;
using SolarWatch.Simulator;

namespace SolarWatch.UnitTests;

public class ResidentialHistoryGeneratorTests
{
    private static readonly DateTimeOffset End = DateTimeOffset.Parse("2026-11-01T23:00:30.1234567Z");

    [Fact]
    public void Version_one_canonical_fixture_is_stable_on_the_supported_runtime()
    {
        var rows = ResidentialHistoryGenerator.Generate(42, End);
        var csv = string.Join("\n", rows.Select(x => FormattableString.Invariant(
            $"{x.MeasuredAt:O},{x.SolarPowerW:F0},{x.ConsumptionPowerW:F0},{x.BatteryStateOfChargePercent:F2}"))) + "\n";
        Assert.Equal("1ea48d5b3d00f9c6031846ea1f14276a38fee77c351b888cd800bc375237c182",
            Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(csv))).ToLowerInvariant());
    }

    [Fact]
    public void Deterministic_UTC_window_preserves_fractional_reference_across_offsets_and_DST_date()
    {
        var rows = ResidentialHistoryGenerator.Generate(42, End);
        Assert.Equal(rows, ResidentialHistoryGenerator.Generate(42, End));
        Assert.Equal(rows, ResidentialHistoryGenerator.Generate(42, End.ToOffset(TimeSpan.FromHours(-4))));
        Assert.Equal(rows, ResidentialHistoryGenerator.Generate(42, End.ToOffset(TimeSpan.FromHours(-5))));
        Assert.Equal(rows, ResidentialHistoryGenerator.Generate(42, End.AddTicks(2)));
        Assert.NotEqual(rows, ResidentialHistoryGenerator.Generate(43, End));
        Assert.Equal(1441, rows.Count);
        Assert.Equal(1441, rows.Select(x => x.MeasuredAt).Distinct().Count());
        for (var index = 0; index < rows.Count; index++)
        {
            Assert.Equal(ReadingTimestamp.Normalize(End).AddHours(-24).AddMinutes(index), rows[index].MeasuredAt);
            Assert.Equal(TimeSpan.Zero, rows[index].MeasuredAt.Offset);
            Assert.Equal("residential-demo", rows[index].InstallationId);
        }
    }

    [Theory]
    [InlineData(0)]
    [InlineData(42)]
    [InlineData(43)]
    [InlineData(int.MinValue)]
    [InlineData(int.MaxValue)]
    public void All_samples_obey_documented_bounds_precision_and_adjacent_continuity(int seed)
    {
        var rows = ResidentialHistoryGenerator.Generate(seed, End);
        foreach (var row in rows)
        {
            Assert.InRange(row.SolarPowerW, 0, 4200);
            Assert.InRange(row.ConsumptionPowerW, 260, 2990);
            Assert.InRange(row.BatteryStateOfChargePercent, 0, 100);
            Assert.Equal(Math.Truncate(row.SolarPowerW), row.SolarPowerW);
            Assert.Equal(Math.Truncate(row.ConsumptionPowerW), row.ConsumptionPowerW);
            Assert.Equal(Math.Round(row.BatteryStateOfChargePercent, 2), row.BatteryStateOfChargePercent);
        }
        foreach (var (previous, current) in rows.Zip(rows.Skip(1)))
        {
            Assert.InRange(Math.Abs(current.SolarPowerW - previous.SolarPowerW), 0, 40);
            Assert.InRange(Math.Abs(current.ConsumptionPowerW - previous.ConsumptionPowerW), 0, 30);
            Assert.InRange(Math.Abs(current.BatteryStateOfChargePercent - previous.BatteryStateOfChargePercent), 0, 0.340001);
        }
    }

    [Fact]
    public void Solar_has_actual_night_zeros_gradual_daylight_and_a_daytime_peak()
    {
        var rows = ResidentialHistoryGenerator.Generate(42, End);
        Assert.All(rows.Where(x => x.MeasuredAt.Hour < 11 || x.MeasuredAt.Hour >= 23), x => Assert.Equal(0, x.SolarPowerW));
        double At(int hour) => rows.First(x => x.MeasuredAt.Hour == hour && x.MeasuredAt.Minute == 0).SolarPowerW;
        Assert.True(At(12) > 0 && At(13) > At(12) && At(15) > At(13));
        Assert.True(At(19) > At(21) && At(21) > At(22) && At(22) > 0);
        var peak = rows.MaxBy(x => x.SolarPowerW)!;
        Assert.InRange(peak.MeasuredAt.Hour, 16, 18);
        Assert.InRange(peak.SolarPowerW, 3900, 4200);
    }

    [Fact]
    public void Home_has_base_load_and_activity_periods_without_a_midnight_reset()
    {
        var rows = ResidentialHistoryGenerator.Generate(42, End);
        double At(int hour) => rows.First(x => x.MeasuredAt.Hour == hour && x.MeasuredAt.Minute == 0).ConsumptionPowerW;
        Assert.True(At(1) > At(6) + 800);
        Assert.True(At(12) > At(8) + 500);
        var midnight = rows.Single(x => x.MeasuredAt.Hour == 0 && x.MeasuredAt.Minute == 0);
        Assert.NotEqual(50, midnight.BatteryStateOfChargePercent);
        Assert.Equal(rows[0].SolarPowerW, rows[^1].SolarPowerW);
        Assert.Equal(rows[0].ConsumptionPowerW, rows[^1].ConsumptionPowerW);
    }

    [Fact]
    public void Battery_initializes_once_charges_on_surplus_discharges_on_deficit_and_saturates()
    {
        var rows = ResidentialHistoryGenerator.Generate(42, End);
        Assert.Equal(50, rows[0].BatteryStateOfChargePercent);
        Assert.Contains(rows, x => x.BatteryStateOfChargePercent == 0);
        Assert.Contains(rows, x => x.BatteryStateOfChargePercent == 100);
        var rising = 0;
        var falling = 0;
        foreach (var (previous, current) in rows.Zip(rows.Skip(1)))
        {
            var balance = previous.SolarPowerW - previous.ConsumptionPowerW + current.SolarPowerW - current.ConsumptionPowerW;
            var delta = current.BatteryStateOfChargePercent - previous.BatteryStateOfChargePercent;
            if (balance > 0) { Assert.True(delta >= 0); if (delta > 0) rising++; }
            if (balance < 0) { Assert.True(delta <= 0); if (delta < 0) falling++; }
        }
        Assert.True(rising > 100 && falling > 100);
        // First minute is at night: rate derives from the documented 10 kWh capacity.
        var expected = decimal.Round(50m - ((decimal)rows[0].ConsumptionPowerW + (decimal)rows[1].ConsumptionPowerW) / 2m / 6000m, 2, MidpointRounding.AwayFromZero);
        Assert.Equal((double)expected, rows[1].BatteryStateOfChargePercent);
    }

    [Theory]
    [InlineData("--profile residential-v1")]
    [InlineData("--continuous --profile residential-v1")]
    [InlineData("--count 1 --profile residential-v1")]
    [InlineData("--history-24h --end-at 2026-10-01T12:00:00Z --profile unknown")]
    [InlineData("--history-24h --end-at 2026-10-01T12:00:00Z --profile residential-v2")]
    [InlineData("--history-24h --end-at 2026-10-01T12:00:00Z --profile")]
    [InlineData("--history-24h --end-at 2026-10-01T12:00:00Z --profile residential-v1 --profile residential-v1")]
    [InlineData("--history-24h --count 1 --end-at 2026-10-01T12:00:00Z --profile residential-v1")]
    public void Profile_is_explicit_history_only_and_rejects_invalid_combinations(string arguments) =>
        Assert.Throws<ArgumentException>(() => SimulatorOptions.Parse(arguments.Split(' ')));

    [Fact]
    public void Omitted_profile_remains_null_in_all_legacy_modes()
    {
        Assert.Null(SimulatorOptions.Parse([]).Profile);
        Assert.Null(SimulatorOptions.Parse(["--continuous"]).Profile);
        Assert.Null(SimulatorOptions.Parse(["--history-24h", "--end-at", End.ToString("O")]).Profile);
        Assert.Equal("residential-v1", SimulatorOptions.Parse(["--profile", "residential-v1", "--history-24h", "--end-at", End.ToString("O")]).Profile);
    }
}
