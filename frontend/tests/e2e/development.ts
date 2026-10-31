import { execFileSync } from 'node:child_process'

export function command(...args: string[]) {
  // Credentials stay in the environment, never arguments or command output.
  try {
    execFileSync('dotnet', [
      '../backend/src/SolarWatch.Api/bin/Release/net10.0/SolarWatch.Api.dll', ...args,
    ], {
      env: { ...process.env, ASPNETCORE_ENVIRONMENT: 'Development', ConnectionStrings__SolarWatch: process.env.SOLARWATCH_E2E_CONNECTION },
      stdio: 'pipe', timeout: 60_000,
    })
  } catch {
    throw new Error(`Development command failed: ${args[0]}. Check the dedicated E2E database and migration setup.`)
  }
}
