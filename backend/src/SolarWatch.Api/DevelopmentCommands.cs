using Microsoft.EntityFrameworkCore;
using SolarWatch.Domain;
using SolarWatch.Infrastructure;

namespace SolarWatch.Api;

public static class DevelopmentCommands
{
    public static async Task<int> RunAsync(WebApplication app, string[] args)
    {
        if (!app.Environment.IsDevelopment())
        {
            Console.Error.WriteLine("Database development commands require the Development environment.");
            return 1;
        }
        var command = args[0];
        var now = app.Services.GetRequiredService<TimeProvider>().GetUtcNow();
        var measuredAt = now;
        if (command == "seed-demo" && args.Length == 3 && args[1] == "--measured-at")
        {
            var value = args[2];
            if (!ReadingTimestamp.TryParse(value, out measuredAt))
            {
                Console.Error.WriteLine("Use an ISO 8601 measurement timestamp with an explicit Z or UTC offset.");
                return 1;
            }
        }
        else if (!((command is "migrate" or "seed-demo" && args.Length == 1) ||
                   (command == "clear-demo" && args is [_, "--confirm"])))
        {
            Console.Error.WriteLine("Usage: migrate | seed-demo [--measured-at <ISO timestamp>] | clear-demo --confirm");
            return 1;
        }
        if (command == "seed-demo" && measuredAt > now)
        {
            Console.Error.WriteLine("The measurement timestamp must not be in the future.");
            return 1;
        }
        await using var scope = app.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<SolarWatchDbContext>();
        if (command == "migrate")
        {
            await db.Database.MigrateAsync();
            Console.WriteLine("Database migrations applied.");
        }
        else if (command == "clear-demo")
        {
            await db.Readings.Where(x => x.InstallationId == InstallationReading.DemoInstallationId).ExecuteDeleteAsync();
            Console.WriteLine("Demo readings cleared.");
        }
        else
        {
            // PostgreSQL timestamps have microsecond precision; normalize for repeatable seeding.
            measuredAt = ReadingTimestamp.Normalize(measuredAt);
            if (!await db.Readings.AnyAsync(x => x.InstallationId == InstallationReading.DemoInstallationId && x.MeasuredAt == measuredAt))
            {
                db.Readings.Add(InstallationReading.Create(measuredAt, 1200, 800, 65, now));
                await db.SaveChangesAsync();
            }
            Console.WriteLine($"Demo reading available at {measuredAt:O} (UTC).");
        }
        return 0;
    }
}
