import { describe, it, expect } from 'vitest';
import { parseSkillPath, computeHash, delay } from '../utils';

describe('parseSkillPath', () => {
  it('parses external skill path (3 segments)', () => {
    const result = parseSkillPath('anthropics/skills/pdf');
    expect(result).toEqual({
      org: 'anthropics',
      repo: 'skills',
      skillName: 'pdf',
      isInternal: false,
    });
  });

  it('parses external skill path with nested skill name', () => {
    const result = parseSkillPath('vercel-labs/agent-skills/react-best-practices');
    expect(result).toEqual({
      org: 'vercel-labs',
      repo: 'agent-skills',
      skillName: 'react-best-practices',
      isInternal: false,
    });
  });

  it('parses internal skill path', () => {
    const result = parseSkillPath('openagentskills/frontend-design');
    expect(result).toEqual({
      org: 'openagentskills',
      repo: null,
      skillName: 'frontend-design',
      isInternal: true,
    });
  });

  it('rejects single-segment path', () => {
    expect(() => parseSkillPath('invalid')).toThrow('Invalid skill path');
  });

  it('rejects two-segment external path', () => {
    expect(() => parseSkillPath('org/repo')).toThrow('{org}/{repo}/{skill-name}');
  });
});

describe('computeHash', () => {
  it('produces a 64-char hex string', async () => {
    const hash = await computeHash('hello world');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('produces consistent results', async () => {
    const a = await computeHash('test content');
    const b = await computeHash('test content');
    expect(a).toBe(b);
  });

  it('produces different hashes for different content', async () => {
    const a = await computeHash('content-a');
    const b = await computeHash('content-b');
    expect(a).not.toBe(b);
  });
});

describe('delay', () => {
  it('resolves after the specified time', async () => {
    const start = Date.now();
    await delay(50);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(40);
  });
});
