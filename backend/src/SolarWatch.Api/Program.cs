using System.Data.Common;
using Microsoft.EntityFrameworkCore;
using SolarWatch.Api;
using SolarWatch.Application;
using SolarWatch.Infrastructure;

var isCommand = args.FirstOrDefault() is "migrate" or "seed-demo" or "clear-demo";
var builder = WebApplication.CreateBuilder(isCommand ? [] : args);
builder.Services.AddOpenApi();
builder.Services.AddProblemDetails();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddDbContext<SolarWatchDbContext>(options => options.UseNpgsql(
    builder.Configuration.GetConnectionString("SolarWatch")
        ?? throw new InvalidOperationException("Configure ConnectionStrings:SolarWatch using user secrets or an environment variable.")));
builder.Services.AddScoped<IReadingStore, PostgresReadingStore>();
builder.Services.AddScoped<GetLatestReading>();
builder.Services.AddScoped<GetReadingHistory>();
builder.Services.AddScoped<SubmitReading>();

var app = builder.Build();
if (isCommand)
{
    Environment.ExitCode = await DevelopmentCommands.RunAsync(app, args);
    return;
}
app.UseExceptionHandler();
if (app.Environment.IsDevelopment()) app.MapOpenApi();
else app.UseHttpsRedirection();

app.MapGet("/api/readings/latest", async (GetLatestReading query, HttpContext context, CancellationToken cancellationToken) =>
{
    context.Response.Headers.CacheControl = "no-store";
    try { return Results.Ok(await query.ExecuteAsync(cancellationToken)); }
    catch (Exception exception) when (exception is DbException or InvalidOperationException { InnerException: DbException })
    {
        return Results.Problem(statusCode: StatusCodes.Status503ServiceUnavailable,
            title: "Readings are temporarily unavailable.");
    }
}).WithName("GetLatestReading")
    .Produces<LatestReadingResponse>()
    .ProducesProblem(StatusCodes.Status503ServiceUnavailable);
app.MapLocalIngestion();
app.MapReadingHistory();
app.Run();

public partial class Program;
