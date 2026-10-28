export type Reading = {
  installationId: 'residential-demo'
  measuredAt: string
  solarPowerW: number
  consumptionPowerW: number
  batteryStateOfChargePercent: number
}

export type LatestReadingResponse = { asOf: string; reading: Reading | null }

function isUtcTimestamp(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /(?:Z|\+00:00)$/.test(value) &&
    Number.isFinite(Date.parse(value))
  )
}

export function parseLatestReading(value: unknown): LatestReadingResponse {
  if (
    !value ||
    typeof value !== 'object' ||
    !('asOf' in value) ||
    !isUtcTimestamp(value.asOf) ||
    !('reading' in value)
  ) {
    throw new Error('Invalid reading response')
  }
  if (value.reading === null) return { asOf: value.asOf, reading: null }
  const reading = value.reading as Partial<Reading> | undefined
  if (
    !reading ||
    reading.installationId !== 'residential-demo' ||
    !isUtcTimestamp(reading.measuredAt) ||
    Date.parse(reading.measuredAt) > Date.parse(value.asOf) ||
    ![
      reading.solarPowerW,
      reading.consumptionPowerW,
      reading.batteryStateOfChargePercent,
    ].every(
      (metric) =>
        typeof metric === 'number' && Number.isFinite(metric) && metric >= 0,
    ) ||
    reading.batteryStateOfChargePercent! > 100
  ) {
    throw new Error('Invalid reading response')
  }
  return { asOf: value.asOf, reading: reading as Reading }
}

export function isStale(snapshot: LatestReadingResponse): boolean {
  return (
    snapshot.reading !== null &&
    Date.parse(snapshot.asOf) - Date.parse(snapshot.reading.measuredAt) >
      5 * 60 * 1000
  )
}
