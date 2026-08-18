import { describe, expect, it } from 'vitest';
// @ts-expect-error The packaging helper is intentionally a Node ESM script.
import {
  expandPreinstalledSkillSpecs,
  isSafeArchiveEntryName,
  resolveInside,
  validateExpandedSkillSpecs,
} from '../../scripts/lib/preinstalled-skills.mjs';

describe('preinstalled skills bundler guards', () => {
  it('inherits collection category, version and default-enabled state', () => {
    const expanded = expandPreinstalledSkillSpecs({
      skills: [{ slug: 'standalone', category: 'thingo', autoEnable: true }],
      collections: [{
        sourceType: 'localZip',
        version: '1.2.3',
        category: 'thingo',
        autoEnable: true,
        skills: [{ slug: 'collection-skill' }],
      }],
    });

    expect(validateExpandedSkillSpecs(expanded)).toEqual([
      { slug: 'standalone', category: 'thingo', autoEnable: true },
      {
        slug: 'collection-skill',
        sourceType: 'localZip',
        version: '1.2.3',
        category: 'thingo',
        autoEnable: true,
      },
    ]);
  });

  it('rejects ZIP-slip paths and paths escaping the extraction root', () => {
    expect(isSafeArchiveEntryName('dbskill-main/skills/dbs/SKILL.md')).toBe(true);
    expect(isSafeArchiveEntryName('../outside.txt')).toBe(false);
    expect(isSafeArchiveEntryName('dbskill-main/../../outside.txt')).toBe(false);
    expect(isSafeArchiveEntryName('C:/outside.txt')).toBe(false);
    expect(() => resolveInside('C:/safe-root', '../outside.txt')).toThrow(/escapes root/i);
  });

  it('rejects duplicate output slugs', () => {
    expect(() => validateExpandedSkillSpecs([{ slug: 'same' }, { slug: 'same' }]))
      .toThrow(/duplicate preinstalled skill slug/i);
  });
});
