import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const line = (o: Record<string, unknown>) => JSON.stringify(o);

let dir: string;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'digest-routes-'));
  // Jobs deliberately written out of alphabetical order; owner is absent (null).
  writeFileSync(
    join(dir, '2030-01-01.jsonl'),
    [
      line({ job: 'zeta-sync', at: '2030-01-01T01:00:00Z', status: 'ok' }),
      line({ job: 'alpha-build', at: '2030-01-01T01:05:00Z', status: 'retry', error: 'timeout' }),
      line({ job: 'alpha-build', at: '2030-01-01T01:10:00Z', status: 'ok' }),
      line({ job: 'mid-report', at: '2030-01-01T02:00:00Z', status: 'fail', error: 'boom' }),
    ].join('\n') + '\n',
  );
  writeFileSync(join(dir, '2030-01-02.jsonl'), '');
  writeFileSync(
    join(dir, '2030-01-03.jsonl'),
    [
      line({ job: 'good-job', at: '2030-01-03T01:00:00Z', status: 'ok' }),
      'this is not json {',
    ].join('\n') + '\n',
  );
  app = createApp({ adapter: 'shim', installed: 'x', beatEverySeconds: 60, runsDir: dir });
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('GET /digest/:night', () => {
  it('shows job names and renders a null owner as a dash', async () => {
    const res = await app.request('/digest/2030-01-01');
    const html = await res.text();
    expect(res.status).toBe(200);
    for (const job of ['alpha-build', 'mid-report', 'zeta-sync']) expect(html).toContain(job);
    expect(html).toContain('—');
  });

  it('returns 404 for a night with no file', async () => {
    const res = await app.request('/digest/2030-02-02');
    expect(res.status).toBe(404);
  });

  it('says nothing ran for an empty file', async () => {
    const res = await app.request('/digest/2030-01-02');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html.toLowerCase()).toContain('nothing ran');
  });

  it('still renders when a line is bad', async () => {
    const res = await app.request('/digest/2030-01-03');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('good-job');
  });
});

describe('GET /api/digest/:night', () => {
  it('returns {night, rows, badLines} as JSON', async () => {
    const res = await app.request('/api/digest/2030-01-01');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    const body = (await res.json()) as any;
    expect(Object.keys(body).sort()).toEqual(['badLines', 'night', 'rows']);
    expect(body.night).toBe('2030-01-01');
    expect(body.badLines).toBe(0);
    expect(body.rows.map((r: any) => r.job)).toEqual(['alpha-build', 'mid-report', 'zeta-sync']);
    expect(body.rows[0]).toMatchObject({ owner: null, runs: 2, retries: 1, lastStatus: 'ok' });
  });

  it('counts bad lines', async () => {
    const body = (await (await app.request('/api/digest/2030-01-03')).json()) as any;
    expect(body.badLines).toBe(1);
    expect(body.rows).toHaveLength(1);
  });

  it('returns empty rows for an empty file', async () => {
    const res = await app.request('/api/digest/2030-01-02');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ night: '2030-01-02', rows: [], badLines: 0 });
  });

  it('returns 404 JSON for a missing night', async () => {
    const res = await app.request('/api/digest/2030-02-02');
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.json()).toBeTypeOf('object');
  });

  it('lists rows in the same order as the jobs appear in the page', async () => {
    const html = await (await app.request('/digest/2030-01-01')).text();
    const body = (await (await app.request('/api/digest/2030-01-01')).json()) as any;
    const jobs: string[] = body.rows.map((r: any) => r.job);
    const positions = jobs.map((j) => html.indexOf(j));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });
});
