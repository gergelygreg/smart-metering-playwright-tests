import { describe, expect, it } from 'vitest';
import { EventStore } from './event-store.js';

function stored(eventId: string, correlationId: string) {
  return {
    topic: 'smart-metering.reading.persisted.v1',
    partition: 0,
    offset: '1',
    receivedAt: '2026-09-11T18:00:01.000Z',
    event: {
      eventId,
      eventType: 'smart-metering.reading.persisted' as const,
      eventVersion: 1 as const,
      occurredAt: '2026-09-11T18:00:00.000Z',
      correlationId,
      causationId: '89140b57-1929-445c-8a64-5f3750038454',
      meterId: 'd2719db7-013b-4bb0-a56d-3793dc6be90f',
      payload: {
        readingId: 'reading-1',
        timestamp: '2026-09-11T18:00:00.000Z',
        voltage: 230,
        current: 4.2,
        activePower: 917.7,
        energyKwh: 12543.8,
        sourceSequence: 1,
      },
    },
  };
}

describe('EventStore', () => {
  it('stores unique events and rejects duplicates', () => {
    const store = new EventStore();
    const item = stored(
      '11111111-1111-4111-8111-111111111111',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    );

    expect(store.append(item)).toBe(true);
    expect(store.append(item)).toBe(false);
    expect(store.size()).toBe(1);
  });

  it('filters by correlation id', () => {
    const store = new EventStore();
    store.append(
      stored(
        '11111111-1111-4111-8111-111111111111',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      ),
    );
    store.append(
      stored(
        '22222222-2222-4222-8222-222222222222',
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      ),
    );

    expect(
      store.list({
        correlationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      }),
    ).toHaveLength(1);
  });

  it('evicts oldest events at capacity', () => {
    const store = new EventStore(1);
    store.append(
      stored(
        '11111111-1111-4111-8111-111111111111',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      ),
    );
    store.append(
      stored(
        '22222222-2222-4222-8222-222222222222',
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      ),
    );

    expect(store.size()).toBe(1);
  });
});
