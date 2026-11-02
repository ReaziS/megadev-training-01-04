import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Digest, DigestRow, ReadNight, RunStatus } from './types.js';

const STATUSES: readonly string[] = ['ok', 'retry', 'fail'];

export const readNight: ReadNight = (runsDir, night) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) return null;
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch {
    return null;
  }

  const byJob = new Map<string, DigestRow>();
  let badLines = 0;
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === '') continue;
    let e: any;
    try {
      e = JSON.parse(line);
    } catch {
      badLines++;
      continue;
    }
    if (!e || typeof e.job !== 'string' || typeof e.at !== 'string' || !STATUSES.includes(e.status)) {
      badLines++;
      continue;
    }
    const status = e.status as RunStatus;
    const owner = typeof e.owner === 'string' ? e.owner : null;
    const error = typeof e.error === 'string' ? e.error : null;
    const row = byJob.get(e.job);
    if (!row) {
      byJob.set(e.job, {
        job: e.job, owner, runs: 1, retries: status === 'retry' ? 1 : 0,
        lastStatus: status, lastError: error, firstAt: e.at, lastAt: e.at,
      });
    } else {
      row.runs++;
      if (status === 'retry') row.retries++;
      row.owner = owner ?? row.owner;
      row.lastStatus = status;
      row.lastError = error ?? row.lastError;
      if (e.at < row.firstAt) row.firstAt = e.at;
      if (e.at > row.lastAt) row.lastAt = e.at;
    }
  }
  const rows = [...byJob.values()].sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  return { night, rows, badLines } satisfies Digest;
};
