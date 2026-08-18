import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  homeDir: '',
  openclawDir: '',
  resourcesDir: '',
}));

vi.mock('node:os', async () => {
  const actual = await vi.importActual<typeof import('node:os')>('node:os');
  return {
    ...actual,
    homedir: () => state.homeDir,
  };
});

vi.mock('@electron/utils/paths', () => ({
  getOpenClawDir: () => state.openclawDir,
  getOpenClawResolvedDir: () => state.openclawDir,
  getOpenClawSkillsDir: () => join(state.homeDir, '.openclaw', 'skills'),
  getResourcesDir: () => state.resourcesDir,
}));

describe('bundled OpenClaw skill trimming', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('physically trims non-allowlisted bundled skills from a bundled skills root', async () => {
    const root = mkdtempSync(join(tmpdir(), 'clawx-bundled-skills-'));
    mkdirSync(join(root, 'skill-creator'), { recursive: true });
    mkdirSync(join(root, 'browser-use'), { recursive: true });
    writeFileSync(join(root, 'skill-creator', 'SKILL.md'), '---\nname: skill-creator\ndescription: keep\n---\n');
    writeFileSync(join(root, 'browser-use', 'SKILL.md'), '---\nname: browser-use\ndescription: remove\n---\n');

    const { trimBundledOpenClawSkills } = await import('@electron/utils/skill-config');
    const result = await trimBundledOpenClawSkills({ bundledSkillsRoot: root });

    expect(result).toMatchObject({ removed: 1, removedSlugs: ['browser-use'], kept: ['skill-creator'] });
    expect(existsSync(join(root, 'skill-creator'))).toBe(true);
    expect(existsSync(join(root, 'browser-use'))).toBe(false);
  });
});

describe('preinstalled skill category migration', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('adds the Thingo marker category without overwriting existing or user-managed skills', async () => {
    const root = mkdtempSync(join(tmpdir(), 'clawx-preinstalled-category-'));
    state.homeDir = join(root, 'home');
    state.openclawDir = join(root, 'openclaw-runtime');
    state.resourcesDir = join(root, 'resources');

    const manifestDir = join(state.resourcesDir, 'skills');
    const sourceRoot = join(state.resourcesDir, 'preinstalled-skills');
    const targetRoot = join(state.homeDir, '.openclaw', 'skills');
    mkdirSync(manifestDir, { recursive: true });
    mkdirSync(join(sourceRoot, 'dashi-ppt'), { recursive: true });
    mkdirSync(join(sourceRoot, 'qingyun-cine-skill'), { recursive: true });
    mkdirSync(join(targetRoot, 'dashi-ppt'), { recursive: true });
    mkdirSync(join(targetRoot, 'qingyun-cine-skill'), { recursive: true });

    writeFileSync(join(manifestDir, 'preinstalled-manifest.json'), JSON.stringify({
      skills: [
        { slug: 'dashi-ppt', version: '1.0.0', category: 'thingo', autoEnable: true },
        { slug: 'qingyun-cine-skill', version: '1.0.0', category: 'thingo', autoEnable: true },
      ],
      collections: [],
    }));
    writeFileSync(join(sourceRoot, 'dashi-ppt', 'SKILL.md'), 'source dashi');
    writeFileSync(join(sourceRoot, 'qingyun-cine-skill', 'SKILL.md'), 'source qingyun');
    writeFileSync(join(targetRoot, 'dashi-ppt', 'SKILL.md'), 'locally retained dashi');
    writeFileSync(join(targetRoot, 'dashi-ppt', '.clawx-preinstalled.json'), JSON.stringify({
      source: 'clawx-preinstalled',
      slug: 'dashi-ppt',
      version: '1.0.0',
      installedAt: '2026-01-01T00:00:00.000Z',
    }));
    writeFileSync(join(targetRoot, 'qingyun-cine-skill', 'SKILL.md'), 'user-managed qingyun');

    const { ensurePreinstalledSkillsInstalled } = await import('@electron/utils/skill-config');
    await ensurePreinstalledSkillsInstalled();

    expect(readFileSync(join(targetRoot, 'dashi-ppt', 'SKILL.md'), 'utf8')).toBe('locally retained dashi');
    expect(JSON.parse(readFileSync(join(targetRoot, 'dashi-ppt', '.clawx-preinstalled.json'), 'utf8')))
      .toMatchObject({
        slug: 'dashi-ppt',
        version: '1.0.0',
        installedAt: '2026-01-01T00:00:00.000Z',
        category: 'thingo',
      });
    expect(readFileSync(join(targetRoot, 'qingyun-cine-skill', 'SKILL.md'), 'utf8')).toBe('user-managed qingyun');
    expect(existsSync(join(targetRoot, 'qingyun-cine-skill', '.clawx-preinstalled.json'))).toBe(false);
  });
});
