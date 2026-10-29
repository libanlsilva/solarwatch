using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using SolarWatch.Application;
using SolarWatch.Domain;

namespace SolarWatch.Simulator;

internal static class ContinuousSimulator
{
    private static readonly TimeSpan Cadence = TimeSpan.FromSeconds(60);

    public static async Task<int> RunAsync(SimulatorOptions options, HttpClient client, TextWriter output,
        TimeProvider clock, CancellationToken cancellationToken)
    {
        long attempted = 0, accepted = 0, rejected = 0, errors = 0, uncertain = 0;
        var pendingWrite = false;
        var random = new Random(options.Seed);
        output.WriteLine("Continuous mode: immediate sample, then 60-second cadence. Press Ctrl+C to stop.");
        try
        {
            while (true)
            {
                cancellationToken.ThrowIfCancellationRequested();
                var started = clock.GetTimestamp();
                using var referenceResponse = await client.GetAsync("/api/readings/latest", cancellationToken);
                if (referenceResponse.StatusCode != HttpStatusCode.OK)
                {
                    errors++;
                    output.WriteLine($"Stopped: reference request returned HTTP {(int)referenceResponse.StatusCode}. No write is pending.");
                    break;
                }
                var reference = await referenceResponse.Content.ReadFromJsonAsync<ServerReference>(cancellationToken)
                    ?? throw new JsonException();
                if (!ReadingTimestamp.TryParse(reference.AsOf, out var asOf) || asOf == default) throw new JsonException();
                var reading = ReadingGenerator.Next(random, asOf);
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
                    pendingWrite = false;
                    output.WriteLine($"Stopped: rejected {reading.MeasuredAt:O}, HTTP {(int)response.StatusCode}.");
                    break;
                }
                else
                {
                    errors++;
                    uncertain++;
                    output.WriteLine($"Stopped: unexpected POST HTTP {(int)response.StatusCode}. The write outcome is uncertain; inspect the API before retrying.");
                    break;
                }

                // Skip elapsed minute slots relative to this iteration's start. A late wake starts
                // a new cadence, so it cannot be followed by another request a few milliseconds later.
                var elapsed = clock.GetElapsedTime(started);
                var delay = Cadence - TimeSpan.FromTicks(elapsed.Ticks % Cadence.Ticks);
                await Task.Delay(delay, clock, cancellationToken);
            }
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            if (pendingWrite)
            {
                errors++;
                uncertain++;
                output.WriteLine("Stopped by operator during POST: the write outcome is uncertain; inspect the API before retrying.");
            }
            else output.WriteLine("Stopped by operator. No write is pending.");
        }
        catch (Exception exception) when (exception is HttpRequestException or OperationCanceledException or JsonException)
        {
            errors++;
            if (pendingWrite) uncertain++;
            output.WriteLine(pendingWrite
                ? "Stopped: HTTP, network, timeout, or acknowledgment failure during POST. The write outcome is uncertain; inspect the API before retrying."
                : "Stopped: HTTP, network, timeout, or invalid reference response. No write is pending.");
        }
        output.WriteLine(string.Create(CultureInfo.InvariantCulture,
            $"Summary (continuous): attempted={attempted}, accepted={accepted}, rejected={rejected}, errors={errors}, uncertain={uncertain}. No automatic retries were made."));
        return errors == 0 && rejected == 0 ? 0 : 1;
    }

    private sealed record ServerReference(string? AsOf);
}
