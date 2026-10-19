import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';

export function validateCiRun(run, repository, workflowId) {
  if (run.repository?.full_name !== repository || run.workflow_id !== workflowId ||
      !['push', 'workflow_dispatch'].includes(run.event) ||
      run.status !== 'completed' || run.conclusion !== 'success' ||
      typeof run.head_branch !== 'string' || !run.head_branch ||
      !/^[a-f0-9]{40}$/.test(run.head_sha) || !Number.isInteger(run.run_attempt)) {
    throw new Error('Choose a successful branch run of the Container workflow in this repository.');
  }
  return { sha: run.head_sha, branch: run.head_branch, attempt: run.run_attempt };
}

export function validateMetadata(saved, expected) {
  // SemVer without build metadata: valid as both a Git tag and a Docker tag.
  const semver = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
  if (saved.repository !== expected.repository || saved.sha !== expected.sha ||
      saved.branch !== expected.branch || saved.runId !== expected.runId ||
      saved.attempt !== expected.attempt || typeof saved.version !== 'string' ||
      !semver.test(saved.version) || saved.version.length > 128 ||
      (expected.branch === 'main' && saved.version.includes('-')) ||
      !/^[a-f0-9]{64}$/.test(saved.archiveSha256)) {
    throw new Error('Release metadata does not match the verified CI run or SemVer.');
  }
  return saved.version;
}

export async function sha256(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}
