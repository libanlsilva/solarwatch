using System.Data.Common;
using SolarWatch.Application;

namespace SolarWatch.Api;

public static class ReadingHistoryEndpoint
{
    public static void MapReadingHistory(this WebApplication app)
    {
        app.MapGet("/api/readings/history", async (GetReadingHistory query,
            HttpContext context, CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            try { return Results.Ok(await query.ExecuteAsync(cancellationToken)); }
            catch (Exception exception) when (!cancellationToken.IsCancellationRequested &&
                exception is DbException or InvalidOperationException { InnerException: DbException })
            {
                return Results.Problem(statusCode: StatusCodes.Status503ServiceUnavailable,
                    title: "Readings are temporarily unavailable.");
            }
        }).WithName("GetReadingHistory")
            .Produces<ReadingHistoryResponse>()
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable);
    }
}
