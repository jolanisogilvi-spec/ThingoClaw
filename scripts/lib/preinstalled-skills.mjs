import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { isAbsolute, normalize, relative, resolve } from 'node:path';

export function expandPreinstalledSkillSpecs(manifest) {
  const standalone = Array.isArray(manifest?.skills) ? manifest.skills : [];
  const collections = Array.isArray(manifest?.collections) ? manifest.collections : [];
  const expanded = [...standalone];

  for (const collection of collections) {
    if (!Array.isArray(collection?.skills)) continue;
    for (const skill of collection.skills) {
      expanded.push({
        ...skill,
        version: skill.version ?? collection.version,
        category: skill.category ?? collection.category,
        autoEnable: skill.autoEnable ?? collection.autoEnable,
        sourceType: collection.sourceType,
      });
    }
  }

  return expanded;
}

export function validateExpandedSkillSpecs(skills) {
  const slugs = new Set();
  for (const skill of skills) {
    const slug = typeof skill?.slug === 'string' ? skill.slug.trim() : '';
    if (!slug || !/^[a-z0-9][a-z0-9._-]*$/i.test(slug)) {
      throw new Error(`Invalid preinstalled skill slug: ${JSON.stringify(skill?.slug)}`);
    }
    if (slugs.has(slug)) {
      throw new Error(`Duplicate preinstalled skill slug: ${slug}`);
    }
    slugs.add(slug);
  }
  return skills;
}

export function isSafeArchiveEntryName(entryName) {
  if (typeof entryName !== 'string' || entryName.includes('\0')) return false;
  const portable = entryName.replace(/\\/g, '/');
  if (!portable || portable.startsWith('/') || /^[a-zA-Z]:\//.test(portable)) return false;
  const parts = portable.split('/').filter(Boolean);
  return !parts.includes('..');
}

export function resolveInside(root, relativePath) {
  if (typeof relativePath !== 'string' || !relativePath.trim() || isAbsolute(relativePath)) {
    throw new Error(`Unsafe relative path: ${relativePath}`);
  }
  const rootPath = resolve(root);
  const targetPath = resolve(rootPath, normalize(relativePath));
  const relation = relative(rootPath, targetPath);
  if (!relation || relation === '..' || relation.startsWith(`..\\`) || relation.startsWith('../') || isAbsolute(relation)) {
    throw new Error(`Path escapes root: ${relativePath}`);
  }
  return targetPath;
}

export function sha256File(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex').toUpperCase();
}

export function sha256Text(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex').toUpperCase();
}
