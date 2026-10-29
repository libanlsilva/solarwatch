using SolarWatch.Domain;

namespace SolarWatch.Application;

public interface IReadingStore
{
    Task<InstallationReading?> GetLatestAsync(CancellationToken cancellationToken);
    Task<bool> TryAddAsync(InstallationReading reading, CancellationToken cancellationToken);
}
