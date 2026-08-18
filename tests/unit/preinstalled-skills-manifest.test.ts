import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

interface PreinstalledSkill {
  slug: string;
  repo?: string;
  repoPath?: string;
  ref?: string;
  version?: string;
  licenseRepoPath?: string;
  category?: string;
  autoEnable?: boolean;
}

interface PreinstalledCollection {
  sourceType: 'git' | 'localZip';
  repo?: string;
  ref?: string;
  archivePath?: string;
  archiveSha256?: string;
  version?: string;
  category?: string;
  autoEnable?: boolean;
  adapter?: string;
  skills: PreinstalledSkill[];
}

const manifest = JSON.parse(
  readFileSync(join(process.cwd(), 'resources', 'skills', 'preinstalled-manifest.json'), 'utf8'),
) as { skills: PreinstalledSkill[]; collections: PreinstalledCollection[] };

const expanded = [
  ...manifest.skills,
  ...manifest.collections.flatMap((collection) => collection.skills.map((skill) => ({
    ...skill,
    category: skill.category ?? collection.category,
    autoEnable: skill.autoEnable ?? collection.autoEnable,
  }))),
];

describe('preinstalled skills manifest', () => {
  it('defines exactly 36 unique, auto-enabled Thingo skills', () => {
    const thingoSkills = expanded.filter((skill) => skill.category === 'thingo');
    const slugs = thingoSkills.map((skill) => skill.slug);

    expect(thingoSkills).toHaveLength(36);
    expect(new Set(slugs).size).toBe(36);
    expect(thingoSkills.every((skill) => skill.autoEnable === true)).toBe(true);
    expect(slugs).toEqual(expect.arrayContaining([
      'dashi-ppt',
      'qingyun-cine-skill',
      'chengfeng-cut',
      'chengfeng-subtitle',
      'chengfeng-visual',
      'chengfeng-export',
      'dbs',
      'dbs-update',
      'dbs-xhs-title',
    ]));
  });

  it('pins Qingyun and Chengfeng sources and limits Chengfeng to four business skills', () => {
    const dashi = manifest.skills.find((skill) => skill.slug === 'dashi-ppt');
    const qingyun = manifest.skills.find((skill) => skill.slug === 'qingyun-cine-skill');
    const chengfeng = manifest.collections.find((collection) => collection.repo === 'Agentchengfeng/chengfeng-videocut-skills');

    expect(dashi).toMatchObject({
      repo: 'chuspeeism/dashi-ppt-skill',
      licenseRepoPath: 'LICENSE',
      version: '0.4.11',
      category: 'thingo',
    });
    expect(qingyun).toMatchObject({
      repo: 'qingyunAGI/qingyun-cine-skill',
      repoPath: '.',
      ref: '7104a5b3be6fc832e25ed4beb352556c52242573',
      version: '7104a5b3be6fc832e25ed4beb352556c52242573',
      category: 'thingo',
      autoEnable: true,
    });
    expect(chengfeng).toMatchObject({
      sourceType: 'git',
      ref: '2e51611965af6e6b8baea3bfc82995b5c9e8f5ef',
      version: '0.10.8',
      adapter: 'chengfeng-videocut',
    });
    expect(chengfeng?.skills.map((skill) => skill.slug)).toEqual([
      'chengfeng-cut',
      'chengfeng-subtitle',
      'chengfeng-visual',
      'chengfeng-export',
    ]);
  });

  it('pins the authorized DBSkill archive and all 30 entries', () => {
    const dbskill = manifest.collections.find((collection) => collection.sourceType === 'localZip');

    expect(dbskill).toMatchObject({
      archivePath: 'tools/dbskill-v2.18.15.zip',
      archiveSha256: '6ABF7C460D1510473B3C90D5074163A1254011BF126DBAB945F4624EDC16746D',
      version: '2.18.15',
      category: 'thingo',
      autoEnable: true,
    });
    expect(dbskill?.skills).toHaveLength(30);
    expect(dbskill?.skills.some((skill) => skill.slug === 'dbs-update')).toBe(true);
  });
});
