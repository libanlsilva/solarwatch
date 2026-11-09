# Live readings hub (v0.2)

`/hubs/readings` is an ASP.NET Core SignalR hub. After an ingested reading is **committed** to
PostgreSQL, `SubmitReading` hands the acknowledged `LatestReadingResponse` (`asOf` + `reading`, the
same JSON as `/api/readings/latest`) to `IReadingPublisher`; the API implements it with
`IHubContext<ReadingsHub>` and sends the `reading` event to all clients.

* **Server → client only.** The hub declares no invocable methods. Data is the same as the public
  read endpoints; writes still exist only through the loopback-restricted, Development-only POST.
* **Best effort.** Duplicates (409) and invalid submissions (400) publish nothing. A publisher
  failure or a 2-second timeout never fails or rolls back the committed ingestion.
* **Resynchronization.** Clients must call `/api/readings/latest` (and History) after connecting
  and after every reconnect; events missed while offline are not replayed.
* **Transport.** SignalR negotiates WebSockets with fallbacks. The Vite dev/preview server proxies
  `/hubs` with `ws: true`.
* **Tests.** Unit tests cover commit-only publishing and publisher failure; PostgreSQL
  integration tests connect a real SignalR client and assert the pushed value equals the
  acknowledgment and that duplicates/invalid submissions are not pushed.
