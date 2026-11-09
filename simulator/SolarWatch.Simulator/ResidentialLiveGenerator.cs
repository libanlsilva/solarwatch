using SolarWatch.Application;
using SolarWatch.Domain;

namespace SolarWatch.Simulator;

// Stateful sampler for continuous mode. Battery charge integrates the power balance over the real
// elapsed time (trapezoid, +/-2,000 W limit, 10,000 Wh capacity), as in the 24-hour profile.
public sealed class ResidentialLiveGenerator(int seed, double initialChargePercent)
{
    private readonly ResidentialModel model = new(seed);
    private decimal charge = (decimal)Math.Clamp(initialChargePercent, 0, 100);
    private DateTimeOffset? previousAt;
    private double previousSolar, previousHome;

    public ReadingSnapshot Next(DateTimeOffset measuredAt)
    {
        var at = ReadingTimestamp.Normalize(measuredAt);
        var hour = ResidentialModel.Hour(at);
        var solar = model.SolarW(hour);
        var home = model.HomeW(hour);
        if (previousAt is { } last && at > last)
        {
            var hours = (decimal)(at - last).TotalHours;
            var balance = ((decimal)previousSolar - (decimal)previousHome + (decimal)solar - (decimal)home) / 2m;
            // W * h / 10,000 Wh * 100 = W * h / 100
            charge = Math.Clamp(charge + Math.Clamp(balance, -2000m, 2000m) * hours / 100m, 0m, 100m);
        }
        previousAt = at;
        previousSolar = solar;
        previousHome = home;
        var soc = (double)decimal.Round(charge, 2, MidpointRounding.AwayFromZero);
        return new(InstallationReading.DemoInstallationId, at, solar, home, soc,
            model.GridVoltageV(hour), model.GridFrequencyHz(hour), ResidentialModel.InverterTemperatureC(solar, home),
            ResidentialModel.BatteryVoltageV(soc, solar - home));
    }
}
