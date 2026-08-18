#!/usr/bin/env zx

import 'zx/globals';
import JSZip from 'jszip';
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  expandPreinstalledSkillSpecs,
  isSafeArchiveEntryName,
  resolveInside,
  sha256File,
  sha256Text,
  validateExpandedSkillSpecs,
} from './lib/preinstalled-skills.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const MANIFEST_PATH = join(ROOT, 'resources', 'skills', 'preinstalled-manifest.json');
// electron-builder copies this generated directory through the resources filter.
// build/ cannot be used because electron-builder clears it before afterPack.
const OUTPUT_ROOT = join(ROOT, 'resources', 'preinstalled-skills');
const TMP_ROOT = join(ROOT, 'build', '.tmp-preinstalled-skills');

function normalizeRepoPath(repoPath) {
  return repoPath.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '') || '.';
}

function assertRepoPath(repoPath, label) {
  if (typeof repoPath !== 'string') {
    throw new Error(`Invalid ${label}: expected a string`);
  }
  const normalized = normalizeRepoPath(repoPath.trim());
  if (normalized !== '.' && normalized.split('/').includes('..')) {
    throw new Error(`Invalid ${label}: ${repoPath}`);
  }
  return normalized;
}

function loadManifest() {
  if (!existsSync(MANIFEST_PATH)) throw new Error(`Missing manifest: ${MANIFEST_PATH}`);
  const raw = readFileSync(MANIFEST_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  if (!parsed || !Array.isArray(parsed.skills) || !Array.isArray(parsed.collections)) {
    throw new Error('Invalid preinstalled-skills manifest format');
  }

  for (const item of parsed.skills) {
    if (!item.slug || !item.repo || !item.repoPath) {
      throw new Error(`Invalid standalone manifest entry: ${JSON.stringify(item)}`);
    }
    assertRepoPath(item.repoPath, `repoPath for ${item.slug}`);
  }
  for (const collection of parsed.collections) {
    if (!['git', 'localZip'].includes(collection?.sourceType) || !Array.isArray(collection.skills)) {
      throw new Error(`Invalid preinstalled skill collection: ${JSON.stringify(collection)}`);
    }
    if (collection.sourceType === 'git' && (!collection.repo || !collection.rootPath)) {
      throw new Error(`Invalid git skill collection: ${JSON.stringify(collection)}`);
    }
    if (collection.sourceType === 'localZip' && (!collection.archivePath || !collection.archiveSha256 || !collection.archiveRoot)) {
      throw new Error(`Invalid local ZIP skill collection: ${JSON.stringify(collection)}`);
    }
  }

  validateExpandedSkillSpecs(expandPreinstalledSkillSpecs(parsed));
  return { parsed, raw };
}

function groupByRepoRef(entries) {
  const grouped = new Map();
  for (const entry of entries) {
    const ref = entry.ref || 'main';
    const key = `${entry.repo}#${ref}`;
    if (!grouped.has(key)) grouped.set(key, { repo: entry.repo, ref, entries: [] });
    grouped.get(key).entries.push(entry);
  }
  return [...grouped.values()];
}

function createRepoDirName(repo, ref) {
  return `${repo.replace(/[\\/]/g, '__')}__${ref.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
}

function normalizeOptionalRepoPath(value, label) {
  if (value === undefined) return null;
  const normalized = assertRepoPath(value, label);
  if (normalized === '.') throw new Error(`Invalid ${label}: ${value}`);
  return normalized;
}

function shouldCopySkillFile(srcPath) {
  const base = basename(srcPath);
  return base !== '.git' && base !== '.subset.tar' && base !== '.clawx-preinstalled.json';
}

function copyPath(sourcePath, targetPath) {
  if (!existsSync(sourcePath)) throw new Error(`Missing source path: ${sourcePath}`);
  mkdirSync(dirname(targetPath), { recursive: true });
  cpSync(sourcePath, targetPath, {
    recursive: statSync(sourcePath).isDirectory(),
    dereference: true,
    force: true,
    filter: shouldCopySkillFile,
  });
}

function flattenSingleNestedSkillDir(targetDir) {
  if (existsSync(join(targetDir, 'SKILL.md'))) return;
  const nestedSkillDirs = readdirSync(targetDir)
    .map((name) => join(targetDir, name))
    .filter((candidate) => {
      try {
        return statSync(candidate).isDirectory() && existsSync(join(candidate, 'SKILL.md'));
      } catch {
        return false;
      }
    });
  if (nestedSkillDirs.length !== 1) return;

  const tempDir = `${targetDir}.flatten`;
  rmSync(tempDir, { recursive: true, force: true });
  cpSync(nestedSkillDirs[0], tempDir, { recursive: true, dereference: true, filter: shouldCopySkillFile });
  rmSync(targetDir, { recursive: true, force: true });
  renameSync(tempDir, targetDir);
}

async function extractTarArchive(archivePath, cwd) {
  const previousCwd = $.cwd;
  $.cwd = cwd;
  try {
    await $`tar -xf ${archivePath}`;
  } finally {
    $.cwd = previousCwd;
  }
}

async function fetchSparseRepo(repo, ref, paths, checkoutDir) {
  const remote = `https://github.com/${repo}.git`;
  rmSync(checkoutDir, { recursive: true, force: true });
  mkdirSync(checkoutDir, { recursive: true });
  const archiveFileName = '.subset.tar';
  const archivePath = join(checkoutDir, archiveFileName);
  const archivePaths = [...new Set(paths.map((path) => assertRepoPath(path, `archive path for ${repo}`)))];

  const previousCwd = $.cwd;
  $.cwd = checkoutDir;
  try {
    await $`git -c core.longpaths=true init`;
    await $`git remote add origin ${remote}`;
    let fetchError;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        await $`git -c core.longpaths=true fetch --depth 1 origin ${ref}`;
        fetchError = null;
        break;
      } catch (error) {
        fetchError = error;
        if (attempt < 3) {
          echo`   fetch attempt ${attempt} failed; retrying...`;
          await new Promise((resolvePromise) => setTimeout(resolvePromise, attempt * 1_000));
        }
      }
    }
    if (fetchError) throw fetchError;
    // Avoid checkout on Windows: upstream repositories can contain paths that
    // are invalid or exceed MAX_PATH. Export only the requested subset.
    await $`git -c core.longpaths=true archive --format=tar --output ${archiveFileName} FETCH_HEAD ${archivePaths}`;
    await extractTarArchive(archiveFileName, checkoutDir);
    rmSync(archivePath, { force: true });
    return (await $`git rev-parse FETCH_HEAD`).stdout.trim();
  } finally {
    $.cwd = previousCwd;
  }
}

function resolvedVersion(requestedVersion, commit) {
  const requested = (requestedVersion || '').trim();
  return !requested || requested === 'main' ? commit : requested;
}

function writeSourceNotice(targetDir, sourceNotice, sourceDetails = {}) {
  if (!sourceNotice) return;
  const lines = [`# ${sourceNotice.title || 'Third-party skill'}`, '', `Source: ${sourceNotice.source}`];
  if (sourceDetails.commit) lines.push(`Commit: ${sourceDetails.commit}`);
  if (sourceDetails.archiveSha256) lines.push(`Archive SHA-256: ${sourceDetails.archiveSha256}`);
  if (sourceDetails.version) lines.push(`Version: ${sourceDetails.version}`);
  if (sourceNotice.note) lines.push('', sourceNotice.note);
  lines.push('');
  writeFileSync(join(targetDir, 'THIRD_PARTY_NOTICE.md'), lines.join('\n'), 'utf8');
}

function assertSkillOutput(targetDir, slug) {
  if (!existsSync(join(targetDir, 'SKILL.md'))) {
    throw new Error(`Skill ${slug} is missing SKILL.md after copy`);
  }
}

function adaptChengfengSkill(targetDir) {
  const manifestPath = join(targetDir, 'SKILL.md');
  const original = readFileSync(manifestPath, 'utf8');
  const integrationNote = [
    '## ThingoClaw 内置适配',
    '',
    '本安装包中 `<插件根>` 指当前技能目录。首次使用时，先按上游流程运行：',
    '',
    '```bash',
    'node "<插件根>/scripts/ensure-runtime.cjs" --install-if-missing --json',
    '```',
    '',
    '该命令会从乘风官方 Release 下载并校验 Runtime；Runtime、Bun、FFmpeg 与 Chrome 不随 ThingoClaw 安装包分发。',
    '',
  ].join('\n');
  const pathAdjusted = original.replaceAll('../../references/', 'references/');
  const adapted = pathAdjusted.replace(/^(---\r?\n[\s\S]*?\r?\n---\r?\n)/, `$1\n${integrationNote}`);
  if (adapted === pathAdjusted) throw new Error(`Unable to adapt Chengfeng skill frontmatter: ${manifestPath}`);
  writeFileSync(manifestPath, adapted, 'utf8');
}

async function extractZipSafely(archivePath, destination) {
  const zip = await JSZip.loadAsync(readFileSync(archivePath));
  for (const entry of Object.values(zip.files)) {
    const originalName = entry.unsafeOriginalName || entry.name;
    if (!isSafeArchiveEntryName(originalName) || !isSafeArchiveEntryName(entry.name)) {
      throw new Error(`Unsafe ZIP entry: ${originalName}`);
    }
    const unixType = typeof entry.unixPermissions === 'number' ? entry.unixPermissions & 0o170000 : 0;
    if (unixType === 0o120000) throw new Error(`ZIP symlinks are not allowed: ${originalName}`);

    const relativePath = entry.name.replace(/\\/g, '/').replace(/\/+$/, '');
    if (!relativePath) continue;
    const targetPath = resolveInside(destination, relativePath);
    if (entry.dir || entry.name.endsWith('/') || entry.name.endsWith('\\')) {
      mkdirSync(targetPath, { recursive: true });
      continue;
    }
    mkdirSync(dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, await entry.async('nodebuffer'));
    if (process.platform !== 'win32' && typeof entry.unixPermissions === 'number') {
      chmodSync(targetPath, entry.unixPermissions & 0o777);
    }
  }
}

async function bundleStandaloneGitSkills(entries, lock) {
  for (const group of groupByRepoRef(entries)) {
    const repoDir = join(TMP_ROOT, createRepoDirName(group.repo, group.ref));
    const sparsePaths = [...new Set(group.entries.flatMap((entry) => {
      const licenseRepoPath = normalizeOptionalRepoPath(entry.licenseRepoPath, `licenseRepoPath for ${entry.slug}`);
      return licenseRepoPath ? [entry.repoPath, licenseRepoPath] : [entry.repoPath];
    }))];

    echo`Fetching ${group.repo} @ ${group.ref}`;
    const commit = await fetchSparseRepo(group.repo, group.ref, sparsePaths, repoDir);
    echo`   commit ${commit}`;

    for (const entry of group.entries) {
      const targetDir = join(OUTPUT_ROOT, entry.slug);
      rmSync(targetDir, { recursive: true, force: true });
      copyPath(join(repoDir, entry.repoPath), targetDir);
      flattenSingleNestedSkillDir(targetDir);

      const licenseRepoPath = normalizeOptionalRepoPath(entry.licenseRepoPath, `licenseRepoPath for ${entry.slug}`);
      if (licenseRepoPath) copyPath(join(repoDir, licenseRepoPath), join(targetDir, 'LICENSE'));
      writeSourceNotice(targetDir, entry.sourceNotice, { commit });
      assertSkillOutput(targetDir, entry.slug);

      lock.skills.push({
        slug: entry.slug,
        version: resolvedVersion(entry.version, commit),
        category: entry.category,
        sourceType: 'git',
        repo: entry.repo,
        repoPath: entry.repoPath,
        ref: group.ref,
        commit,
        ...(licenseRepoPath ? { licenseRepoPath } : {}),
      });
      echo`   OK ${entry.slug}`;
    }
  }
}

async function bundleGitCollection(collection, lock) {
  const ref = collection.ref || 'main';
  const rootPath = assertRepoPath(collection.rootPath, `rootPath for ${collection.repo}`);
  const licenseRepoPath = normalizeOptionalRepoPath(collection.licenseRepoPath, `licenseRepoPath for ${collection.repo}`);
  const noticeRepoPath = normalizeOptionalRepoPath(collection.noticeRepoPath, `noticeRepoPath for ${collection.repo}`);
  const sharedPaths = (collection.sharedPaths || []).map((path) => assertRepoPath(path, `sharedPath for ${collection.repo}`));
  const requestedPaths = [
    ...collection.skills.map((skill) => posix.join(rootPath, assertRepoPath(skill.repoPath, `repoPath for ${skill.slug}`))),
    ...sharedPaths.map((path) => posix.join(rootPath, path)),
    ...(licenseRepoPath ? [licenseRepoPath] : []),
    ...(noticeRepoPath ? [noticeRepoPath] : []),
  ];
  const repoDir = join(TMP_ROOT, createRepoDirName(collection.repo, ref));

  echo`Fetching ${collection.repo} @ ${ref}`;
  const commit = await fetchSparseRepo(collection.repo, ref, requestedPaths, repoDir);
  echo`   commit ${commit}`;

  for (const skill of collection.skills) {
    const targetDir = join(OUTPUT_ROOT, skill.slug);
    rmSync(targetDir, { recursive: true, force: true });
    copyPath(join(repoDir, rootPath, skill.repoPath), targetDir);
    for (const sharedPath of sharedPaths) {
      copyPath(join(repoDir, rootPath, sharedPath), join(targetDir, sharedPath));
    }
    if (licenseRepoPath) copyPath(join(repoDir, licenseRepoPath), join(targetDir, 'LICENSE'));
    if (noticeRepoPath) copyPath(join(repoDir, noticeRepoPath), join(targetDir, 'NOTICE.md'));
    if (collection.adapter === 'chengfeng-videocut') adaptChengfengSkill(targetDir);
    writeSourceNotice(targetDir, collection.sourceNotice, { commit, version: collection.version });
    assertSkillOutput(targetDir, skill.slug);

    lock.skills.push({
      slug: skill.slug,
      version: skill.version || collection.version || commit,
      category: skill.category || collection.category,
      sourceType: 'git',
      repo: collection.repo,
      repoPath: posix.join(rootPath, skill.repoPath),
      ref,
      commit,
      adapter: collection.adapter,
    });
    echo`   OK ${skill.slug}`;
  }
}

async function bundleLocalZipCollection(collection, lock) {
  const archivePath = resolveInside(ROOT, collection.archivePath);
  if (!existsSync(archivePath)) throw new Error(`Missing local skill archive: ${archivePath}`);
  const actualSha256 = sha256File(archivePath);
  const expectedSha256 = String(collection.archiveSha256).trim().toUpperCase();
  if (actualSha256 !== expectedSha256) {
    throw new Error(`Archive SHA-256 mismatch for ${collection.archivePath}: expected ${expectedSha256}, got ${actualSha256}`);
  }

  const extractRoot = join(TMP_ROOT, `zip__${basename(collection.archivePath, '.zip')}`);
  rmSync(extractRoot, { recursive: true, force: true });
  mkdirSync(extractRoot, { recursive: true });
  echo`Extracting ${collection.archivePath}`;
  await extractZipSafely(archivePath, extractRoot);

  const archiveRoot = resolveInside(extractRoot, collection.archiveRoot);
  const versionPath = resolveInside(archiveRoot, collection.versionFile || 'VERSION');
  const actualVersion = readFileSync(versionPath, 'utf8').trim();
  if (actualVersion !== collection.version) {
    throw new Error(`Archive version mismatch for ${collection.archivePath}: expected ${collection.version}, got ${actualVersion}`);
  }
  const licensePath = collection.licensePath ? resolveInside(archiveRoot, collection.licensePath) : null;

  for (const skill of collection.skills) {
    const targetDir = join(OUTPUT_ROOT, skill.slug);
    rmSync(targetDir, { recursive: true, force: true });
    copyPath(resolveInside(archiveRoot, skill.archivePath), targetDir);
    if (licensePath) copyPath(licensePath, join(targetDir, 'LICENSE'));
    writeSourceNotice(targetDir, collection.sourceNotice, {
      archiveSha256: actualSha256,
      version: collection.version,
    });
    assertSkillOutput(targetDir, skill.slug);

    lock.skills.push({
      slug: skill.slug,
      version: skill.version || collection.version,
      category: skill.category || collection.category,
      sourceType: 'localZip',
      archivePath: collection.archivePath,
      archiveSkillPath: posix.join(collection.archiveRoot, skill.archivePath.replace(/\\/g, '/')),
      archiveSha256: actualSha256,
    });
    echo`   OK ${skill.slug}`;
  }
}

async function main() {
  echo`Bundling preinstalled skills...`;
  if (process.env.SKIP_PREINSTALLED_SKILLS === '1') {
    echo`Skipping preinstalled skills fetch (SKIP_PREINSTALLED_SKILLS=1).`;
    return;
  }

  const { parsed: manifest, raw: manifestRaw } = loadManifest();
  rmSync(OUTPUT_ROOT, { recursive: true, force: true });
  mkdirSync(OUTPUT_ROOT, { recursive: true });
  rmSync(TMP_ROOT, { recursive: true, force: true });
  mkdirSync(TMP_ROOT, { recursive: true });

  const lock = {
    generatedAt: new Date().toISOString(),
    manifestSha256: sha256Text(manifestRaw),
    skills: [],
  };

  try {
    await bundleStandaloneGitSkills(manifest.skills, lock);
    for (const collection of manifest.collections) {
      if (collection.sourceType === 'git') await bundleGitCollection(collection, lock);
      else await bundleLocalZipCollection(collection, lock);
    }
    validateExpandedSkillSpecs(lock.skills);
    writeFileSync(join(OUTPUT_ROOT, '.preinstalled-lock.json'), `${JSON.stringify(lock, null, 2)}\n`, 'utf8');
  } finally {
    rmSync(TMP_ROOT, { recursive: true, force: true });
  }

  echo`Preinstalled skills ready: ${OUTPUT_ROOT}`;
}

await main();
