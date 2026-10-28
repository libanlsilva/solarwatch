using SolarWatch.Domain;

namespace SolarWatch.Application;

public interface IReadingStore
{
    Task<InstallationReading?> GetLatestAsync(CancellationToken cancellationToken);
}
