using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.SignalR.Client;
using SolarWatch.Api;
using SolarWatch.Application;

namespace SolarWatch.IntegrationTests;

public partial class LatestReadingTests
{
    private HubConnection Subscribe(TaskCompletionSource<LatestReadingResponse> first, List<LatestReadingResponse> all)
    {
        var connectionToHub = new HubConnectionBuilder()
            .WithUrl(new Uri(factory.Server.BaseAddress, ReadingsHub.Path), options =>
            {
                options.Transports = HttpTransportType.LongPolling;
                options.HttpMessageHandlerFactory = _ => factory.Server.CreateHandler();
            }).Build();
        connectionToHub.On<LatestReadingResponse>(ReadingsHub.ReadingEvent, reading =>
        {
            lock (all) all.Add(reading);
            first.TrySetResult(reading);
        });
        return connectionToHub;
    }

    [Fact]
    public async Task Connected_clients_receive_each_committed_reading_exactly_as_acknowledged()
    {
        var first = new TaskCompletionSource<LatestReadingResponse>(TaskCreationOptions.RunContinuationsAsynchronously);
        var all = new List<LatestReadingResponse>();
        await using var hub = Subscribe(first, all);
        await hub.StartAsync();
        using var client = factory.CreateClient();
        using var response = await client.PostAsJsonAsync("/api/readings", Valid() with { GridVoltageV = 230.5 });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var acknowledged = await response.Content.ReadFromJsonAsync<LatestReadingResponse>();
        var pushed = await first.Task.WaitAsync(TimeSpan.FromSeconds(10));
        Assert.Equal(acknowledged, pushed);
        Assert.Equal(230.5, pushed.Reading!.GridVoltageV);
    }

    [Fact]
    public async Task Duplicate_and_invalid_submissions_are_not_pushed()
    {
        var first = new TaskCompletionSource<LatestReadingResponse>(TaskCreationOptions.RunContinuationsAsynchronously);
        var all = new List<LatestReadingResponse>();
        await using var hub = Subscribe(first, all);
        await hub.StartAsync();
        using var client = factory.CreateClient();
        Assert.Equal(HttpStatusCode.Created, (await client.PostAsJsonAsync("/api/readings", Valid())).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync("/api/readings", Valid())).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/readings", Valid() with { SolarPowerW = -5 })).StatusCode);
        await first.Task.WaitAsync(TimeSpan.FromSeconds(10));
        await Task.Delay(500);
        lock (all) Assert.Single(all);
    }
}
