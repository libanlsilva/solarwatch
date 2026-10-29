using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using SolarWatch.Application;
using SolarWatch.Domain;

namespace SolarWatch.Simulator;

public static class SimulatorRunner
{
    public static async Task<int> RunAsync(SimulatorOptions options, HttpClient client, TextWriter output,
        CancellationToken cancellationToken = default, TimeProvider? clock = null)
    {
        if (options.Continuous)
            return await ContinuousSimulator.RunAsync(options, client, output, clock ?? TimeProvider.System, cancellationToken);
        var accepted = 0;
        var rejected = 0;
        var errors = 0;
        var attempted = 0;
        try
        {
            // Always obtain server time: controlled future batches fail before any POST.
            using var referenceResponse = await client.GetAsync("/api/readings/latest", cancellationToken);
            referenceResponse.EnsureSuccessStatusCode();
            var reference = await referenceResponse.Content.ReadFromJsonAsync<LatestReadingResponse>(cancellationToken)
                ?? throw new JsonException();
            if (reference.AsOf == default) throw new JsonException();
            var end = options.EndAt ?? reference.AsOf;
            if (end > reference.AsOf) throw new ArgumentException("Ending timestamp is after server asOf.");
            var readings = ReadingGenerator.Generate(options.Count, options.Seed, end);
            foreach (var reading in readings)
            {
                attempted++;
                using var response = await client.PostAsJsonAsync("/api/readings", reading, cancellationToken);
                if (response.StatusCode == HttpStatusCode.Created)
                {
                    var acknowledgment = await response.Content.ReadFromJsonAsync<LatestReadingResponse>(cancellationToken);
                    if (acknowledgment?.Reading != reading || acknowledgment.AsOf < reading.MeasuredAt)
                        throw new JsonException();
                    accepted++;
                    output.WriteLine(FormattableString.Invariant($"Accepted {reading.MeasuredAt:O}: solar={reading.SolarPowerW} W, consumption={reading.ConsumptionPowerW} W, battery={reading.BatteryStateOfChargePercent}%"));
                }
                else if (response.StatusCode is HttpStatusCode.BadRequest or HttpStatusCode.Conflict)
                {
                    rejected++;
                    output.WriteLine($"Rejected {reading.MeasuredAt:O}: HTTP {(int)response.StatusCode}.");
                }
                else
                {
                    errors++;
                    output.WriteLine($"Stopped: unexpected HTTP {(int)response.StatusCode}; the current submission is not counted as accepted or rejected.");
                    break;
                }
            }
        }
        catch (ArgumentException)
        {
            errors++;
            output.WriteLine("Stopped: ending timestamp is invalid for this batch or later than server asOf. No readings were submitted.");
        }
        catch (Exception exception) when (exception is HttpRequestException or OperationCanceledException or JsonException)
        {
            errors++;
            output.WriteLine("Stopped: HTTP, network, timeout, cancellation, or acknowledgment failure. The current request may have persisted; check the API before retrying. No automatic retries were made.");
        }
        output.WriteLine(string.Create(CultureInfo.InvariantCulture,
            $"Summary: requested={options.Count}, attempted={attempted}, accepted={accepted}, rejected={rejected}, errors={errors}, unattempted={options.Count - attempted}."));
        return errors == 0 && rejected == 0 ? 0 : 1;
    }
}
