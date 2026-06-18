#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const rl = readline.createInterface({ input, output });

const run = (cmd, args, opts = {}) => {
  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    shell: false,
    ...opts,
  });

  if (result.status !== 0) {
    if (cmd === 'npx') {
      console.error('\nDeployment failed. If this is a certificate error, fix the local CA or proxy configuration; TLS verification will not be disabled.');
    }
    process.exit(result.status ?? 1);
  }
};

const gitStatus = spawnSync('git', ['status', '--short'], { encoding: 'utf8' });

if (gitStatus.status !== 0) {
  console.error('Git is not available or the repository is not initialized.');
  process.exit(gitStatus.status ?? 1);
}

if (!gitStatus.stdout.trim()) {
  console.log('No local changes to deploy.');
  process.exit(0);
}

console.log('\nChanges detected:');
console.log(gitStatus.stdout.trim());

const answer = await rl.question('\nSave these changes to Git and deploy to Vercel? [y/N] ');
if (!/^y(es)?$/i.test(answer.trim())) {
  console.log('Deployment cancelled.');
  rl.close();
  process.exit(0);
}

rl.close();

run('git', ['add', '.']);
run('git', ['commit', '-m', 'chore: deploy updates']);
run('git', ['push']);
run('npx', ['vercel', '--prod']);

console.log('\nDeployment complete.');
