using Microsoft.EntityFrameworkCore;
using Npgsql;
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

    public async Task<IReadOnlyList<InstallationReading>> GetHistoryAsync(DateTimeOffset from, DateTimeOffset to,
        CancellationToken cancellationToken) =>
        await db.Readings.AsNoTracking()
            .Where(x => x.InstallationId == InstallationReading.DemoInstallationId &&
                x.MeasuredAt >= from && x.MeasuredAt <= to)
            .OrderBy(x => x.MeasuredAt)
            .ToListAsync(cancellationToken);

    public async Task<bool> TryAddAsync(InstallationReading reading, CancellationToken cancellationToken)
    {
        db.Readings.Add(reading);
        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return true;
        }
        catch (DbUpdateException exception) when (exception.InnerException is PostgresException
            { SqlState: PostgresErrorCodes.UniqueViolation, ConstraintName: "PK_readings" })
        {
            db.Entry(reading).State = EntityState.Detached;
            return false;
        }
    }
}
