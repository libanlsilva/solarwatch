using Microsoft.EntityFrameworkCore;
using SolarWatch.Application;
using SolarWatch.Domain;

namespace SolarWatch.Infrastructure;

public sealed class PostgresReadingStore(SolarWatchDbContext db) : IReadingStore
{
    public Task<InstallationReading?> GetLatestAsync(CancellationToken cancellationToken) =>
        db.Readings.AsNoTracking()
            .Where(x => x.InstallationId == InstallationReading.DemoInstallationId)
            .OrderByDescending(x => x.MeasuredAt)
            .FirstOrDefaultAsync(cancellationToken);
}
