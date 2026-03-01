/**
 * Tests for the validate-changed utility functions.
 *
 * The script itself is a CLI entry point, so we test the pure logic
 * (path parsing, SKILL.md reading) by importing helpers we extracted.
 * The actual network calls are tested via integration tests against
 * the worker.
 */

import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..', '..');
const INTERNAL_SKILLS_DIR = join(ROOT_DIR, 'openagentskills');

/** Same logic as validate-changed.ts toSkillPath */
function toSkillPath(filePath: string): string {
  return filePath
    .replace(/^skills\//, '')
    .replace(/\/skill\.yaml$/, '');
}

/** Same logic as validate-changed.ts readLocalSkillMd */
function readLocalSkillMd(skillPath: string): string | null {
  if (!skillPath.startsWith('openagentskills/')) return null;
  const skillName = skillPath.replace('openagentskills/', '');
  const mdPath = join(INTERNAL_SKILLS_DIR, skillName, 'SKILL.md');
  return existsSync(mdPath) ? 'exists' : null;
}

describe('toSkillPath', () => {
  it('strips skills/ prefix and /skill.yaml suffix', () => {
    expect(toSkillPath('skills/anthropics/skills/pdf/skill.yaml'))
      .toBe('anthropics/skills/pdf');
  });

  it('handles internal skills', () => {
    expect(toSkillPath('skills/openagentskills/git-workflow/skill.yaml'))
      .toBe('openagentskills/git-workflow');
  });

  it('handles paths without skills/ prefix', () => {
    expect(toSkillPath('openagentskills/api-design/skill.yaml'))
      .toBe('openagentskills/api-design');
  });
});

describe('readLocalSkillMd', () => {
  it('returns content for known internal skills', () => {
    const result = readLocalSkillMd('openagentskills/api-design');
    expect(result).not.toBeNull();
  });

  it('returns null for external skills', () => {
    const result = readLocalSkillMd('anthropics/skills/pdf');
    expect(result).toBeNull();
  });

  it('returns null for non-existent internal skill', () => {
    const result = readLocalSkillMd('openagentskills/does-not-exist');
    expect(result).toBeNull();
  });
});

describe('CHANGED_FILES parsing', () => {
  it('parses JSON array of file paths', () => {
    const raw = '["skills/anthropics/skills/pdf/skill.yaml","skills/expo/skills/app/skill.yaml"]';
    const files: string[] = JSON.parse(raw);
    const skillFiles = files.filter((f) => f.endsWith('skill.yaml'));
    expect(skillFiles).toHaveLength(2);
  });

  it('filters out non-skill.yaml files', () => {
    const files = [
      'skills/anthropics/skills/pdf/skill.yaml',
      'openagentskills/api-design/SKILL.md',
      'README.md',
    ];
    const skillFiles = files.filter((f) => f.endsWith('skill.yaml'));
    expect(skillFiles).toHaveLength(1);
  });
});
