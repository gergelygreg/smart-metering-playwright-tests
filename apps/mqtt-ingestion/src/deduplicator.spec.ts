import { describe, expect, it } from 'vitest';
import { MessageDeduplicator } from './deduplicator.js';

describe('MessageDeduplicator', () => {
  it('reserves an unseen message', () => {
    const dedupe = new MessageDeduplicator();
    expect(dedupe.begin('message-1')).toBe(true);
  });

  it('rejects a message while it is in flight', () => {
    const dedupe = new MessageDeduplicator();

    expect(dedupe.begin('message-1')).toBe(true);
    expect(dedupe.begin('message-1')).toBe(false);
  });

  it('rejects a completed duplicate inside the TTL', () => {
    const dedupe = new MessageDeduplicator();

    expect(dedupe.begin('message-1')).toBe(true);
    dedupe.complete('message-1');

    expect(dedupe.begin('message-1')).toBe(false);
  });

  it('allows retry after a failed ingestion releases the reservation', () => {
    const dedupe = new MessageDeduplicator();

    expect(dedupe.begin('message-1')).toBe(true);
    dedupe.release('message-1');

    expect(dedupe.begin('message-1')).toBe(true);
  });

  it('accepts a completed id after its TTL expires', () => {
    let now = 1_000;
    const dedupe = new MessageDeduplicator(100, () => now);

    expect(dedupe.begin('message-1')).toBe(true);
    dedupe.complete('message-1');

    now = 1_101;

    expect(dedupe.begin('message-1')).toBe(true);
  });
});