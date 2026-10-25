type Subscriber = { revision: number; changed: () => void; ping: () => void };

/** One timer per process. SQLite data_version gates remote invalidation scans. */
export class StreamRegistry {
  private games = new Map<string, Set<Subscriber>>();
  private timer?: ReturnType<typeof setInterval>;
  private ticks = 0;
  private count = 0;
  private dataVersion: number | null = null;
  constructor(private readRevision: (id: string) => number | null, private limit = 2000,
    private readDataVersion?: () => number) {}

  subscribe(id: string, subscriber: Subscriber): (() => void) | null {
    const group = this.games.get(id) ?? new Set<Subscriber>();
    // Bound memory and accidental tabs; a rejected phone can still use HTTP fallback.
    if (this.count >= this.limit || group.size >= 8) return null;
    group.add(subscriber);
    this.games.set(id, group);
    this.count++;
    if (!this.timer) {
      this.timer = setInterval(() => this.tick(), this.readDataVersion ? 500 : 3000);
      this.timer.unref?.();
    }
    let removed = false;
    return () => {
      if (removed) return;
      removed = true;
      group.delete(subscriber);
      this.count--;
      if (!group.size) this.games.delete(id);
      if (!this.count) { clearInterval(this.timer); this.timer = undefined; this.ticks = 0; this.dataVersion = null; }
    };
  }

  tick(): void {
    ++this.ticks;
    const heartbeat = this.ticks % (this.readDataVersion ? 18 : 3) === 0;
    let scan = true;
    if (this.readDataVersion) {
      try {
        // Two constant-cost metadata reads per second, independent of player count.
        // This changes for commits from OTHER SQLite connections. Local commits push directly.
        const version = this.readDataVersion();
        scan = this.dataVersion === null || version !== this.dataVersion || this.ticks % 12 === 0;
        this.dataVersion = version;
      } catch { /* Retain the ordinary indexed scan as a safe fallback. */ }
    }
    if (!scan && !heartbeat) return;
    for (const [id, group] of this.games) {
      let revision: number | null | undefined;
      if (scan) {
        try { revision = this.readRevision(id); }
        catch { /* A transient writer lock must not suppress heartbeat delivery. */ }
      }
      for (const client of Array.from(group)) {
        try {
          if (scan && revision !== undefined && (revision === null || revision !== client.revision)) client.changed();
          if (heartbeat) client.ping();
        } catch { /* One closed stream cannot interrupt the other tables. */ }
      }
    }
  }

  get activeConnections(): number { return this.count; }
  get activeGames(): number { return this.games.size; }
}
