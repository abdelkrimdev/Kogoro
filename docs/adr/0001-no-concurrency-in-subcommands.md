# No concurrency in artwork, subtitle, and metadata subcommands

Kogoro's `artwork`, `subtitle`, and `metadata` subcommands process files sequentially — they accept `--concurrency` in the CLI definition but do not parallelize their work. The `scan` command already supports concurrent processing via `Scanner.scanBatch()`.

The trade-off: concurrency in `scan` is safe because it's CPU-bound filename parsing + API matching with rate-limited `HttpClient`. Concurrency in `artwork`/`subtitle`/`metadata` would mean multiple concurrent downloads or disk writes, which risks throttling, IP bans, and filesystem contention. The benefit (faster batch completion) doesn't outweigh the risk for the 0.1.0 release.

We deferred parallelization in these subcommands rather than add half-baked concurrency with fragile safeguards. It can be revisited when user demand or a distribution-friendly rate-limiting strategy emerges.
