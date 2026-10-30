using SolarWatch.Domain;

namespace SolarWatch.Application;

public interface IReadingStore
{
    Task<InstallationReading?> GetLatestAsync(CancellationToken cancellationToken);
    // Persisted demo readings within inclusive UTC bounds, ordered by measurement time ascending.
    Task<IReadOnlyList<InstallationReading>> GetHistoryAsync(DateTimeOffset from, DateTimeOffset to,
        CancellationToken cancellationToken);
    Task<bool> TryAddAsync(InstallationReading reading, CancellationToken cancellationToken);
}
