#!/usr/bin/env zx

import 'zx/globals';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const lockPath = join(ROOT, 'resources', 'preinstalled-skills', '.preinstalled-lock.json');
const manifestPath = join(ROOT, 'resources', 'skills', 'preinstalled-manifest.json');
const bundleScript = join(ROOT, 'scripts', 'bundle-preinstalled-skills.mjs');

if (process.env.CLAWX_SKIP_PREINSTALLED_SKILLS_PREPARE === '1') {
  echo`Skipping preinstalled skills prepare (CLAWX_SKIP_PREINSTALLED_SKILLS_PREPARE=1).`;
  process.exit(0);
}

if (existsSync(lockPath) && existsSync(manifestPath)) {
  try {
    const manifestSha256 = createHash('sha256')
      .update(readFileSync(manifestPath, 'utf8'), 'utf8')
      .digest('hex')
      .toUpperCase();
    const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
    if (lock.manifestSha256 === manifestSha256) {
      echo`Preinstalled skills bundle is current, skipping prepare.`;
      process.exit(0);
    }
  } catch {
    // Rebuild malformed or legacy lock files below.
  }
}

echo`Preinstalled skills bundle missing, preparing for dev startup...`;

try {
  await $`zx ${bundleScript}`;
} catch (error) {
  // Dev startup should remain available even if network-based skill fetching fails.
  echo`Warning: failed to prepare preinstalled skills for dev startup: ${error?.message || error}`;
  process.exit(0);
}
