using Microsoft.AspNetCore.SignalR;
using SolarWatch.Application;

namespace SolarWatch.Api;

// Server-to-client only: clients receive the "reading" event and cannot invoke anything.
public sealed class ReadingsHub : Hub
{
    public const string Path = "/hubs/readings";
    public const string ReadingEvent = "reading";
}

public sealed class SignalRReadingPublisher(IHubContext<ReadingsHub> hub) : IReadingPublisher
{
    public Task PublishAsync(LatestReadingResponse reading, CancellationToken cancellationToken) =>
        hub.Clients.All.SendAsync(ReadingsHub.ReadingEvent, reading, cancellationToken);
}
