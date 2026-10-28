using SolarWatch.Domain;

namespace SolarWatch.UnitTests;

public class InstallationReadingTests
{
    private static readonly DateTimeOffset Now = DateTimeOffset.Parse("2026-10-01T12:00:00Z");

    [Theory]
    [InlineData(0, 0, 0)]
    [InlineData(1200, 800, 65)]
    [InlineData(0, 800, 100)]
    public void Accepts_valid_values_and_normalizes_the_instant(double solar, double consumption, double charge)
    {
        var reading = InstallationReading.Create(Now.ToOffset(TimeSpan.FromHours(-4)), solar, consumption, charge, Now);
        Assert.Equal("residential-demo", reading.InstallationId);
        Assert.Equal(TimeSpan.Zero, reading.MeasuredAt.Offset);
        Assert.Equal(Now, reading.MeasuredAt);
        Assert.Equal(solar, reading.SolarPowerW);
        Assert.Equal(consumption, reading.ConsumptionPowerW);
        Assert.Equal(charge, reading.BatteryStateOfChargePercent);
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(double.NaN)]
    [InlineData(double.PositiveInfinity)]
    [InlineData(double.NegativeInfinity)]
    public void Rejects_invalid_power(double power)
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => InstallationReading.Create(Now, power, 800, 65, Now));
        Assert.Throws<ArgumentOutOfRangeException>(() => InstallationReading.Create(Now, 1200, power, 65, Now));
    }

    [Theory]
    [InlineData(-0.1)]
    [InlineData(100.1)]
    [InlineData(double.NaN)]
    [InlineData(double.PositiveInfinity)]
    public void Rejects_invalid_charge(double charge) =>
        Assert.Throws<ArgumentOutOfRangeException>(() => InstallationReading.Create(Now, 1200, 800, charge, Now));

    [Fact]
    public void Rejects_future_measurements() =>
        Assert.Throws<ArgumentOutOfRangeException>(() => InstallationReading.Create(Now.AddTicks(1), 1200, 800, 65, Now));
}
