using System.Globalization;
using System.Net;
using SolarWatch.Domain;

namespace SolarWatch.Simulator;

public sealed record SimulatorOptions(Uri ApiUrl, int Count, int Seed, DateTimeOffset? EndAt,
    bool Continuous = false, bool History24h = false)
{
    public const int MaxCount = 120;
    public const string Usage = "Usage: [--api-url http://127.0.0.1:5171] [--seed <int32>] [--count 1..120] [--end-at <ISO timestamp with Z/offset>] | --continuous [--api-url <local HTTP origin>] [--seed <int32>] | --history-24h --end-at <ISO timestamp with Z/offset> [--seed <int32>] [--api-url <local HTTP origin>]. Defaults: finite count 10, seed 42, end-at server asOf. Continuous: immediate sample, then 60-second cadence. History: 1,441 readings over an inclusive 24-hour window. Ctrl+C stops continuous/history modes. --continuous and --history-24h are mutually exclusive; neither accepts --count; --continuous does not accept --end-at.";

    public static SimulatorOptions Parse(string[] args)
    {
        var values = new Dictionary<string, string>();
        var continuous = false;
        var history24h = false;
        for (var index = 0; index < args.Length; index++)
        {
            if (args[index] == "--continuous")
            {
                if (continuous) throw new ArgumentException("Duplicate continuous flag.");
                continuous = true;
                continue;
            }
            if (args[index] == "--history-24h")
            {
                if (history24h) throw new ArgumentException("Duplicate history flag.");
                history24h = true;
                continue;
            }
            if (index + 1 >= args.Length || args[index] is not ("--api-url" or "--count" or "--seed" or "--end-at") ||
                !values.TryAdd(args[index], args[index + 1])) throw new ArgumentException("Invalid options.");
            index++;
        }
        if (continuous && (values.ContainsKey("--count") || values.ContainsKey("--end-at")))
            throw new ArgumentException("Continuous mode cannot use count or end-at.");
        if (history24h && (continuous || values.ContainsKey("--count") || !values.ContainsKey("--end-at")))
            throw new ArgumentException("History requires end-at and cannot use continuous or count.");
        if (!Uri.TryCreate(values.GetValueOrDefault("--api-url", "http://127.0.0.1:5171"), UriKind.Absolute, out var url) ||
            url.Scheme != "http" || url.UserInfo.Length != 0 || url.AbsolutePath != "/" || url.Query.Length != 0 || url.Fragment.Length != 0 ||
            !(url.Host.Equals("localhost", StringComparison.OrdinalIgnoreCase) ||
                (IPAddress.TryParse(url.Host.Trim('[', ']'), out var address) && IPAddress.IsLoopback(address))))
            throw new ArgumentException("Use a credential-free loopback HTTP base URL.");
        if (!int.TryParse(values.GetValueOrDefault("--count", "10"), NumberStyles.Integer, CultureInfo.InvariantCulture, out var count) || count is < 1 or > MaxCount ||
            !int.TryParse(values.GetValueOrDefault("--seed", "42"), NumberStyles.Integer, CultureInfo.InvariantCulture, out var seed))
            throw new ArgumentException("Invalid count or seed.");
        DateTimeOffset? endAt = null;
        if (values.TryGetValue("--end-at", out var value))
        {
            if (!ReadingTimestamp.TryParse(value, out var parsed)) throw new ArgumentException("Invalid ending timestamp.");
            endAt = parsed.ToUniversalTime();
        }
        if (history24h && endAt!.Value.UtcTicks < TimeSpan.TicksPerDay)
            throw new ArgumentException("History reference must allow a complete preceding 24-hour window.");
        return new(url, count, seed, endAt, continuous, history24h);
    }
}
