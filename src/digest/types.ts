export type RunStatus = 'ok' | 'retry' | 'fail';

// One row per job in a night's run log.
export type DigestRow = {
  job: string;
  owner: string | null; // null in the log; the views show "—"
  runs: number;
  retries: number;
  lastStatus: RunStatus;
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

export type Digest = {
  night: string;
  rows: DigestRow[]; // sorted by job
  badLines: number; // lines that did not parse, counted and never thrown
};

// Returns null when runs/<night>.jsonl does not exist. Never throws on a bad line.
export type ReadNight = (runsDir: string, night: string) => Digest | null;
