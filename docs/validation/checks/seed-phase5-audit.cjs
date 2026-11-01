// Audit-only data preparation through the existing Development-local POST.
// Configure a separate empty disposable _e2e database on the audit API first.
// No deletes/overwrites; refuses an already populated installation.
const fs = require('node:fs');
const path = require('node:path');
const repo = path.resolve(__dirname, '../../..');
const api = process.env.SOLARWATCH_AUDIT_API || 'http://127.0.0.1:5191';
if (!['127.0.0.1','localhost'].includes(new URL(api).hostname)) throw new Error('Use a loopback audit API.');
(async () => {
  const response = await fetch(`${api}/api/readings/latest`);
  if (!response.ok) throw new Error(`Audit reference failed: ${response.status}`);
  const initial = await response.json();
  if (initial.reading) throw new Error('Audit installation is populated; preserve its data. Use an empty disposable database.');
  const reference = Date.parse(initial.asOf);
  const rows = [[1380,0,0,0],[1080,900,350,20],[720,1500,750,50],[720,1500,750,50],[6,3000,1200,80],[1,1200,800,65]];
  const readings = [];
  for (let index=0; index<rows.length; index++) {
    const [minutes,solarPowerW,consumptionPowerW,batteryStateOfChargePercent] = rows[index];
    const fraction = index === 2 ? '000001' : index === 3 ? '000002' : '123456';
    const measuredAt = new Date(Math.floor((reference-minutes*60000)/60000)*60000).toISOString().slice(0,19)+'.'+fraction+'Z';
    const result = await fetch(`${api}/api/readings`, { method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({installationId:'residential-demo',measuredAt,solarPowerW,consumptionPowerW,batteryStateOfChargePercent}) });
    if (result.status !== 201) throw new Error(`Audit POST ${index+1} failed (${result.status}); earlier accepted rows remain. Inspect before retrying.`);
    readings.push((await result.json()).reading);
  }
  const output = path.join(repo,'artifacts/phase5-audit'); fs.mkdirSync(output,{recursive:true});
  fs.writeFileSync(path.join(output,'seed.json'),JSON.stringify({initialReference:initial.asOf,readings},null,2));
  console.log(`Persisted ${readings.length} audit observations through the real API.`);
})().catch(error=>{console.error(error.message);process.exitCode=1;});
