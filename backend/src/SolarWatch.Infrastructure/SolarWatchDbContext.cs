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
        });
        reading.HasKey(x => new { x.InstallationId, x.MeasuredAt });
        reading.Property(x => x.InstallationId).HasMaxLength(64);
        reading.Property(x => x.MeasuredAt).HasColumnType("timestamp with time zone");
    }
}
