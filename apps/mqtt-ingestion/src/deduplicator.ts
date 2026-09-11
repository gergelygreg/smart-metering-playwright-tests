export class MessageDeduplicator {
  private readonly completed = new Map<string, number>();
  private readonly inFlight = new Set<string>();

  constructor(
    private readonly ttlMs = 10 * 60 * 1000,
    private readonly now: () => number = () => Date.now(),
  ) {}

  begin(messageId: string): boolean {
    this.evictExpired();

    if (this.completed.has(messageId) || this.inFlight.has(messageId)) {
      return false;
    }

    this.inFlight.add(messageId);
    return true;
  }

  complete(messageId: string): void {
    this.inFlight.delete(messageId);
    this.completed.set(messageId, this.now() + this.ttlMs);
  }

  release(messageId: string): void {
    this.inFlight.delete(messageId);
  }

  private evictExpired(): void {
    const current = this.now();

    for (const [messageId, expiresAt] of this.completed) {
      if (expiresAt <= current) {
        this.completed.delete(messageId);
      }
    }
  }
}