# Live, animated UI (v0.2)

The Overview subscribes to the SignalR hub (`/hubs/readings`, event `reading`, see `live-readings-hub.md`).

- **Status**: the header toggle shows Connecting / Live / Reconnecting / Offline / Paused (`aria-pressed`). The preference is stored in `localStorage` (`solarwatch.live`, on by default; storage failures are ignored).
- **Resilience**: reconnect backoff 0, 1, 2, 4 s … capped at 10 s, never gives up. After every (re)connect the app resynchronizes over HTTP (Latest + History), because missed events are not replayed.
- **Ordering**: an older reading (slow HTTP response, replayed event) never overwrites a newer one (`mergeLatest`).
- **Live chart**: rolling 5-minute solar/home SVG chart, hover crosshair and tooltip, keyboard Left/Right/Home/End/Esc.
- **Power flow**: derived from solar minus home with a 50 W deadband. Battery power is *derived*, not measured, and the diagram says so. W labels carry the same information as the flow animation.
- **Electrical panel**: grid voltage/frequency, inverter temperature and battery voltage when the reading has them.
- **Motion**: numbers ease, cards pulse and flow dashes animate; `prefers-reduced-motion` disables all of it.
- **E2E**: the Playwright config pauses live and reduces motion so existing specs keep manual-refresh semantics; `live-readings.spec.ts` opts back in.
