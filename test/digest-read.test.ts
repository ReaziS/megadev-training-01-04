import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

describe('readNight', () => {
  it('reads 2026-10-28: 5 jobs, 1 bad line', () => {
    const d = readNight('runs', '2026-10-28')!;
    expect(d.rows.map((r) => r.job)).toEqual([
      'digest/render', 'fixtures/refresh', 'lane/sync', 'notes/backup', 'rig/rotate-logs',
    ]);
    expect(d.badLines).toBe(1);
    const fx = d.rows.find((r) => r.job === 'fixtures/refresh')!;
    expect(fx).toMatchObject({ runs: 4, retries: 3, lastStatus: 'ok' });
    expect(d.rows.find((r) => r.job === 'digest/render')!.owner).toBeNull();
    expect(d.rows.find((r) => r.job === 'notes/backup')).toMatchObject({ lastStatus: 'fail', lastError: 'quota exceeded' });
  });
  it('returns null for a night with no file', () => {
    expect(readNight('runs', '1999-01-01')).toBeNull();
  });
});
