using Microsoft.EntityFrameworkCore;
using SolarWatch.Domain;

namespace SolarWatch.Infrastructure;

public sealed class SolarWatchDbContext(DbContextOptions<SolarWatchDbContext> options) : DbContext(options)
{
    public DbSet<InstallationReading> Readings => Set<InstallationReading>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var reading = modelBuilder.Entity<InstallationReading>();
        reading.ToTable("readings", table =>
        {
            table.HasCheckConstraint("ck_readings_installation", "\"InstallationId\" = 'residential-demo'");
            table.HasCheckConstraint("ck_readings_solar", "\"SolarPowerW\" >= 0 AND \"SolarPowerW\" < 'Infinity'::double precision");
            table.HasCheckConstraint("ck_readings_consumption", "\"ConsumptionPowerW\" >= 0 AND \"ConsumptionPowerW\" < 'Infinity'::double precision");
            table.HasCheckConstraint("ck_readings_battery", "\"BatteryStateOfChargePercent\" >= 0 AND \"BatteryStateOfChargePercent\" <= 100");
            table.HasCheckConstraint("ck_readings_grid_voltage", "\"GridVoltageV\" IS NULL OR (\"GridVoltageV\" >= 0 AND \"GridVoltageV\" <= 1000)");
            table.HasCheckConstraint("ck_readings_grid_frequency", "\"GridFrequencyHz\" IS NULL OR (\"GridFrequencyHz\" >= 40 AND \"GridFrequencyHz\" <= 70)");
            table.HasCheckConstraint("ck_readings_inverter_temperature", "\"InverterTemperatureC\" IS NULL OR (\"InverterTemperatureC\" >= -40 AND \"InverterTemperatureC\" <= 150)");
            table.HasCheckConstraint("ck_readings_battery_voltage", "\"BatteryVoltageV\" IS NULL OR (\"BatteryVoltageV\" >= 0 AND \"BatteryVoltageV\" <= 1000)");
        });
        reading.HasKey(x => new { x.InstallationId, x.MeasuredAt });
        reading.Property(x => x.InstallationId).HasMaxLength(64);
        reading.Property(x => x.MeasuredAt).HasColumnType("timestamp with time zone");
    }
}
