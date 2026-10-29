using System.Globalization;
using System.Text.RegularExpressions;

namespace SolarWatch.Domain;

public static class ReadingTimestamp
{
    public static bool TryParse(string? value, out DateTimeOffset instant)
    {
        instant = default;
        return value is { Length: <= 40 } &&
            Regex.IsMatch(value, @"\A\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,7})?(Z|[+-]\d{2}:\d{2})\z", RegexOptions.CultureInvariant) &&
            DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.None, out instant);
    }

    // Match PostgreSQL/Npgsql microsecond storage precision before acknowledging or comparing keys.
    public static DateTimeOffset Normalize(DateTimeOffset value) =>
        new(value.UtcTicks - value.UtcTicks % 10, TimeSpan.Zero);
}
