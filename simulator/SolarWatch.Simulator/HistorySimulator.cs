using System.Diagnostics;
using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using SolarWatch.Application;
using SolarWatch.Domain;

namespace SolarWatch.Simulator;

internal static class HistorySimulator
{
    public static async Task<int> RunAsync(SimulatorOptions options, HttpClient client, TextWriter output,
        CancellationToken cancellationToken)
    {
        var elapsed = Stopwatch.StartNew();
        int attempted = 0, accepted = 0, rejected = 0, conflicts = 0, errors = 0, uncertain = 0;
        var pendingWrite = false;
        try
        {
            cancellationToken.ThrowIfCancellationRequested();
            using var referenceResponse = await client.GetAsync("/api/readings/latest", cancellationToken);
            if (referenceResponse.StatusCode != HttpStatusCode.OK)
            {
                errors++;
                output.WriteLine($"Stopped: reference request returned HTTP {(int)referenceResponse.StatusCode}. No write is pending.");
            }
            else
            {
                var reference = await referenceResponse.Content.ReadFromJsonAsync<ServerReference>(cancellationToken)
                    ?? throw new JsonException();
                if (!ReadingTimestamp.TryParse(reference.AsOf, out var asOf) || asOf == default) throw new JsonException();
                // Validate the original instant before truncating to PostgreSQL precision.
                if (options.EndAt is not { } endAt || endAt > asOf)
                    throw new ArgumentException("History ending instant is missing or after server asOf.");
                var readings = ReadingGenerator.GenerateHistory24h(options.Seed, endAt);
                output.WriteLine($"History mode: {readings.Count} readings, {readings[0].MeasuredAt:O} through {readings[^1].MeasuredAt:O} (UTC), oldest first. Press Ctrl+C to stop.");
                foreach (var reading in readings)
                {
                    cancellationToken.ThrowIfCancellationRequested();
                    attempted++;
                    pendingWrite = true;
                    using var response = await client.PostAsJsonAsync("/api/readings", reading, cancellationToken);
                    if (response.StatusCode == HttpStatusCode.Created)
                    {
                        var acknowledgment = await response.Content.ReadFromJsonAsync<LatestReadingResponse>(cancellationToken);
                        if (acknowledgment?.Reading != reading || acknowledgment.AsOf < reading.MeasuredAt)
                            throw new JsonException();
                        accepted++;
                        pendingWrite = false;
                        output.WriteLine(FormattableString.Invariant($"Accepted {reading.MeasuredAt:O}: solar={reading.SolarPowerW} W, consumption={reading.ConsumptionPowerW} W, battery={reading.BatteryStateOfChargePercent}%"));
                    }
                    else if (response.StatusCode is HttpStatusCode.BadRequest or HttpStatusCode.Conflict)
                    {
                        rejected++;
                        if (response.StatusCode == HttpStatusCode.Conflict) conflicts++;
                        pendingWrite = false;
                        output.WriteLine($"Rejected {reading.MeasuredAt:O}: HTTP {(int)response.StatusCode}. Existing rows are never overwritten.");
                    }
                    else
                    {
                        errors++;
                        uncertain++;
                        output.WriteLine($"Stopped: unexpected POST HTTP {(int)response.StatusCode}. The write outcome is uncertain; inspect the API before retrying.");
                        break;
                    }
                }
            }
        }
        catch (ArgumentException)
        {
            errors++;
            output.WriteLine("Stopped: invalid history reference; use a past UTC/offset instant with a complete preceding 24-hour window. No readings were submitted.");
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            errors++;
            if (pendingWrite) uncertain++;
            output.WriteLine(pendingWrite
                ? "Stopped by operator during POST: the write outcome is uncertain; inspect the API before retrying."
                : "Stopped by operator. No write is pending; incomplete history is not a successful run.");
        }
        catch (Exception exception) when (exception is HttpRequestException or OperationCanceledException or JsonException)
        {
            errors++;
            if (pendingWrite) uncertain++;
            output.WriteLine(pendingWrite
                ? "Stopped: HTTP, network, timeout, or acknowledgment failure during POST. The write outcome is uncertain; inspect the API before retrying."
                : "Stopped: HTTP, network, timeout, or invalid reference response. No write is pending.");
        }
        elapsed.Stop();
        var unattempted = ReadingGenerator.HistoryReadingCount - attempted;
        output.WriteLine(string.Create(CultureInfo.InvariantCulture,
            $"Summary (history-24h): requested={ReadingGenerator.HistoryReadingCount}, attempted={attempted}, accepted={accepted}, rejected={rejected}, conflicts={conflicts}, errors={errors}, uncertain={uncertain}, unattempted={unattempted}, elapsedSeconds={elapsed.Elapsed.TotalSeconds:F3}. No automatic retries were made."));
        return accepted == ReadingGenerator.HistoryReadingCount && errors == 0 && rejected == 0 ? 0 : 1;
    }

    private sealed record ServerReference(string? AsOf);
}
