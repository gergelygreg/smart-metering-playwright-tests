export class EventDeduplicator {
  private readonly completed = new Map<string, number>();
  private readonly inFlight = new Set<string>();

  constructor(
    private readonly ttlMs = 10 * 60 * 1000,
    private readonly now: () => number = () => Date.now(),
  ) {}

  begin(eventId: string): boolean {
    this.evictExpired();

    if (this.completed.has(eventId) || this.inFlight.has(eventId)) {
      return false;
    }

    this.inFlight.add(eventId);
    return true;
  }

  complete(eventId: string): void {
    this.inFlight.delete(eventId);
    this.completed.set(eventId, this.now() + this.ttlMs);
  }

  release(eventId: string): void {
    this.inFlight.delete(eventId);
  }

  private evictExpired(): void {
    const current = this.now();

    for (const [eventId, expiresAt] of this.completed) {
      if (expiresAt <= current) {
        this.completed.delete(eventId);
      }
    }
  }
}
