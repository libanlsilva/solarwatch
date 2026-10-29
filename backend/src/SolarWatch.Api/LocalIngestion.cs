using System.Data.Common;
using System.Net;
using System.Text.Json;
using SolarWatch.Application;

namespace SolarWatch.Api;

public static class LocalIngestion
{
    public static void MapLocalIngestion(this WebApplication app)
    {
        // No write route is registered outside Development. This is not authentication.
        if (!app.Environment.IsDevelopment()) return;

        app.MapPost("/api/readings", async (SubmitReading command,
            HttpContext context, CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            try
            {
                if (!context.Request.HasJsonContentType())
                    return Results.Problem(statusCode: StatusCodes.Status415UnsupportedMediaType,
                        title: "Use application/json for a reading.");
                var request = await context.Request.ReadFromJsonAsync<SubmitReadingRequest>(cancellationToken);
                if (request is null) return InvalidBody();
                var result = await command.ExecuteAsync(request, cancellationToken);
                if (result.Errors.Count > 0) return Results.ValidationProblem(result.Errors);
                if (result.IsDuplicate) return Results.Problem(statusCode: StatusCodes.Status409Conflict,
                    title: "A reading already exists for this installation and measurement instant.");
                return Results.Json(result.Accepted, statusCode: StatusCodes.Status201Created);
            }
            catch (Exception exception) when (exception is JsonException or BadHttpRequestException)
            {
                return InvalidBody();
            }
            catch (Exception exception) when (exception is DbException or InvalidOperationException { InnerException: DbException }
                or Microsoft.EntityFrameworkCore.DbUpdateException { InnerException: DbException })
            {
                return Results.Problem(statusCode: StatusCodes.Status503ServiceUnavailable,
                    title: "Readings are temporarily unavailable.");
            }
        }).AddEndpointFilter(async (context, next) =>
        {
            var http = context.HttpContext;
            if (http.Connection.RemoteIpAddress is not { } remote || !IsLoopbackAddress(remote) ||
                !IsLoopbackHost(http.Request.Host.Host) ||
                http.Request.Headers.Keys.Any(key => key.Equals("Forwarded", StringComparison.OrdinalIgnoreCase) ||
                    key.StartsWith("X-Forwarded-", StringComparison.OrdinalIgnoreCase)) ||
                (http.Request.Headers.TryGetValue("Origin", out var origin) &&
                    (!Uri.TryCreate(origin.ToString(), UriKind.Absolute, out var uri) || !IsLoopbackHost(uri.Host))))
                return Results.Problem(statusCode: StatusCodes.Status403Forbidden,
                    title: "Ingestion requires a direct local Development connection.");
            return await next(context);
        }).WithName("SubmitReading")
            .Accepts<SubmitReadingRequest>("application/json")
            .Produces<LatestReadingResponse>(StatusCodes.Status201Created)
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status403Forbidden)
            .ProducesProblem(StatusCodes.Status409Conflict)
            .ProducesProblem(StatusCodes.Status415UnsupportedMediaType)
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable);
    }

    private static IResult InvalidBody() => Results.ValidationProblem(new Dictionary<string, string[]>
    {
        ["body"] = ["Supply a valid JSON reading object with numeric metrics."]
    });

    private static bool IsLoopbackHost(string host) =>
        host.Equals("localhost", StringComparison.OrdinalIgnoreCase) ||
        (IPAddress.TryParse(host.Trim('[', ']'), out var address) && IsLoopbackAddress(address));

    private static bool IsLoopbackAddress(IPAddress address) =>
        IPAddress.IsLoopback(address.IsIPv4MappedToIPv6 ? address.MapToIPv4() : address);
}
