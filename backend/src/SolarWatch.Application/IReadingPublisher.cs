namespace SolarWatch.Application;

// Announces a committed reading to live subscribers. Best effort: persistence is the source of truth.
public interface IReadingPublisher
{
    Task PublishAsync(LatestReadingResponse reading, CancellationToken cancellationToken);
}
