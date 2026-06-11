import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateTxId } from './txId';

describe('generateTxId', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('generates a readable transaction id with prefix, local timestamp, and 8 random characters', () => {
    const txId = generateTxId('run', new Date(2026, 5, 10, 14, 25, 30));

    expect(txId).toMatch(/^RUN-20260610-142530-[A-Z0-9]{8}$/);
  });

  it('uses the service type prefix for each transaction type', () => {
    const now = new Date(2026, 5, 10, 14, 25, 30);

    expect(generateTxId('run', now)).toMatch(/^RUN-/);
    expect(generateTxId('sort', now)).toMatch(/^SORT-/);
    expect(generateTxId('ext', now)).toMatch(/^EXT-/);
  });

  it('produces distinct ids for repeated calls in the same second', () => {
    let value = 0;
    vi.stubGlobal('crypto', {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.fill(value);
        value += 1;
        return bytes;
      },
    });
    const now = new Date(2026, 5, 10, 14, 25, 30);
    const first = generateTxId('ext', now);
    const second = generateTxId('ext', now);

    expect(first).not.toBe(second);
    expect(first.split('-')[3]).toHaveLength(8);
    expect(second.split('-')[3]).toHaveLength(8);
  });
});
