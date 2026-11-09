using SolarWatch.Simulator;

namespace SolarWatch.UnitTests;

public class ResidentialLiveGeneratorTests
{
    [Fact]
    public void Continuous_profile_and_interval_are_explicit_and_bounded()
    {
        var options = SimulatorOptions.Parse("--continuous --profile residential-v1 --interval-seconds 2".Split(' '));
        Assert.Equal(2, options.IntervalSeconds);
        Assert.Equal(SimulatorOptions.ResidentialProfile, options.Profile);
        Assert.Equal(60, SimulatorOptions.Parse(["--continuous"]).IntervalSeconds);
    }

    [Theory]
    [InlineData("--interval-seconds 2")]
    [InlineData("--history-24h --end-at 2026-10-01T12:00:00Z --interval-seconds 2")]
    [InlineData("--continuous --interval-seconds 0")]
    [InlineData("--continuous --interval-seconds 61")]
    [InlineData("--continuous --interval-seconds x")]
    [InlineData("--continuous --interval-seconds 1 --interval-seconds 1")]
    public void Invalid_intervals_fail_before_running(string arguments) =>
        Assert.Throws<ArgumentException>(() => SimulatorOptions.Parse(arguments.Split(' ')));

    [Fact]
    public void Live_samples_match_the_history_model_at_whole_minutes()
    {
        var end = DateTimeOffset.Parse("2026-10-01T12:00:00Z");
        var history = ResidentialHistoryGenerator.Generate(7, end);
        var live = new ResidentialLiveGenerator(7, history[0].BatteryStateOfChargePercent);
        for (var index = 0; index < 120; index++)
        {
            var sample = live.Next(history[index].MeasuredAt);
            Assert.Equal(history[index].SolarPowerW, sample.SolarPowerW);
            Assert.Equal(history[index].ConsumptionPowerW, sample.ConsumptionPowerW);
            Assert.Equal(history[index].BatteryStateOfChargePercent, sample.BatteryStateOfChargePercent, 0.05);
        }
    }

    [Fact]
    public void Seconds_apart_samples_are_continuous_and_battery_starts_from_the_supplied_charge()
    {
        var at = DateTimeOffset.Parse("2026-10-01T15:00:00Z");
        var live = new ResidentialLiveGenerator(42, 37.5);
        var first = live.Next(at);
        Assert.Equal(37.5, first.BatteryStateOfChargePercent);
        var previous = first;
        for (var second = 1; second <= 60; second++)
        {
            var sample = live.Next(at.AddSeconds(second * 2));
            Assert.InRange(Math.Abs(sample.SolarPowerW - previous.SolarPowerW), 0, 20);
            Assert.InRange(Math.Abs(sample.BatteryStateOfChargePercent - previous.BatteryStateOfChargePercent), 0, 0.1);
            Assert.InRange(sample.BatteryStateOfChargePercent, 0, 100);
            previous = sample;
        }
    }

    [Fact]
    public void Same_seed_and_instants_reproduce_the_same_samples()
    {
        var at = DateTimeOffset.Parse("2026-10-01T09:00:00Z");
        var a = new ResidentialLiveGenerator(5, 50);
        var b = new ResidentialLiveGenerator(5, 50);
        for (var i = 0; i < 30; i++) Assert.Equal(a.Next(at.AddSeconds(i)), b.Next(at.AddSeconds(i)));
    }
}

public class ElectricalParametersTests
{
    private static readonly DateTimeOffset Now = DateTimeOffset.Parse("2026-10-01T12:00:00Z");

    [Fact]
    public void Live_samples_carry_plausible_bounded_electrical_values()
    {
        var live = new SolarWatch.Simulator.ResidentialLiveGenerator(42, 60);
        for (var i = 0; i < 600; i++)
        {
            var s = live.Next(Now.AddSeconds(i * 30));
            Assert.InRange(s.GridVoltageV!.Value, 225, 235);
            Assert.InRange(s.GridFrequencyHz!.Value, 49.9, 50.1);
            Assert.InRange(s.InverterTemperatureC!.Value, 24, 52);
            Assert.InRange(s.BatteryVoltageV!.Value, 43, 58);
        }
    }

    [Fact]
    public void Domain_accepts_omitted_values_and_rejects_out_of_range_or_non_finite_ones()
    {
        Assert.Null(SolarWatch.Domain.InstallationReading.Create(Now, 1, 1, 1, Now).GridVoltageV);
        Assert.Equal(230.1, SolarWatch.Domain.InstallationReading.Create(Now, 1, 1, 1, Now, gridVoltageV: 230.1).GridVoltageV);
        Assert.Throws<ArgumentOutOfRangeException>(() => SolarWatch.Domain.InstallationReading.Create(Now, 1, 1, 1, Now, gridVoltageV: -1));
        Assert.Throws<ArgumentOutOfRangeException>(() => SolarWatch.Domain.InstallationReading.Create(Now, 1, 1, 1, Now, gridFrequencyHz: 10));
        Assert.Throws<ArgumentOutOfRangeException>(() => SolarWatch.Domain.InstallationReading.Create(Now, 1, 1, 1, Now, inverterTemperatureC: double.NaN));
        Assert.Throws<ArgumentOutOfRangeException>(() => SolarWatch.Domain.InstallationReading.Create(Now, 1, 1, 1, Now, batteryVoltageV: 5000));
    }
}
