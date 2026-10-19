import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sha256, validateCiRun, validateMetadata } from '../.github/scripts/release-utils.mjs';

const sha = 'a'.repeat(40);
const run = {
  repository: { full_name: 'family/santa' }, workflow_id: 42,
  head_branch: 'feature/snow', head_sha: sha, run_attempt: 2,
  event: 'push', status: 'completed', conclusion: 'success'
};
const expected = { repository: 'family/santa', sha, branch: 'feature/snow', runId: '123', attempt: 2 };
const metadata = { ...expected, version: '0.2.0-snow.1', archiveSha256: 'b'.repeat(64) };

describe('manual publication provenance', () => {
  it('accepts successful branch runs, including manual CI runs', () => {
    expect(validateCiRun(run, 'family/santa', 42)).toEqual({ sha, branch: 'feature/snow', attempt: 2 });
    expect(validateCiRun({ ...run, event: 'workflow_dispatch' }, 'family/santa', 42).sha).toBe(sha);
  });

  it.each([
    { event: 'pull_request' }, { event: 'pull_request_target' },
    { conclusion: 'failure' }, { status: 'in_progress' },
    { workflow_id: 99 }, { repository: { full_name: 'other/santa' } },
    { head_branch: null }, { head_sha: 'invalid' }, { run_attempt: undefined }
  ])('rejects untrusted or unsuccessful runs: %j', (change) => {
    expect(() => validateCiRun({ ...run, ...change }, 'family/santa', 42)).toThrow();
  });

  it('preserves stable main and branch SemVer exactly', () => {
    expect(validateMetadata(metadata, expected)).toBe('0.2.0-snow.1');
    expect(validateMetadata({ ...metadata, branch: 'main', version: '0.2.0' }, { ...expected, branch: 'main' })).toBe('0.2.0');
    expect(() => validateMetadata({ ...metadata, branch: 'main', version: '0.2.0-1' }, { ...expected, branch: 'main' })).toThrow();
  });

  it.each([
    { sha: 'c'.repeat(40) }, { repository: 'other/santa' }, { branch: 'main' },
    { runId: '124' }, { attempt: 1 }, { archiveSha256: 'invalid' },
    { version: '0.2.0-snow.1+2' }, { version: '../../other' },
    { version: '0.2.0-' }, { version: '0.2.0\nlatest' }
  ])('rejects mismatched provenance and invalid tags: %j', (change) => {
    expect(() => validateMetadata({ ...metadata, ...change }, expected)).toThrow();
  });

  it('hashes the actual archive bytes so modified artifacts can be rejected', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'santa-archive-check-'));
    try {
      const archive = join(directory, 'image.tar');
      await writeFile(archive, 'abc');
      expect(await sha256(archive)).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
      await writeFile(archive, 'changed');
      expect(await sha256(archive)).not.toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
