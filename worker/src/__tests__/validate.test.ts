import { describe, it, expect } from 'vitest';
import { validateSkillSchema } from '../validate';

describe('validateSkillSchema', () => {
  // ── Valid inputs ────────────────────────────────────────────────────────

  it('accepts a valid external skill', () => {
    const yaml = `
source:
  type: external
  url: https://github.com/anthropics/skills
  path: skills/pdf
  ref: main
categories:
  - documents
tags:
  - pdf
  - extraction
`;
    const result = validateSkillSchema(yaml);
    expect(result.source.type).toBe('external');
    expect(result.source.url).toBe('https://github.com/anthropics/skills');
    expect(result.source.path).toBe('skills/pdf');
    expect(result.categories).toEqual(['documents']);
    expect(result.tags).toEqual(['pdf', 'extraction']);
  });

  it('accepts a valid internal skill', () => {
    const yaml = `
source:
  type: internal
categories:
  - development
tags:
  - api
`;
    const result = validateSkillSchema(yaml);
    expect(result.source.type).toBe('internal');
    expect(result.source.url).toBeUndefined();
  });

  it('defaults ref to main when omitted', () => {
    const yaml = `
source:
  type: external
  url: https://github.com/org/repo
  path: some/path
categories:
  - development
tags:
  - test
`;
    const result = validateSkillSchema(yaml);
    expect(result.source.ref).toBe('main');
  });

  // ── Source type errors ─────────────────────────────────────────────────

  it('rejects source.type = "local" (old value)', () => {
    const yaml = `
source:
  type: local
categories:
  - development
tags:
  - test
`;
    expect(() => validateSkillSchema(yaml)).toThrow('source.type must be "external" or "internal"');
  });

  it('rejects missing source', () => {
    const yaml = `
categories:
  - development
tags:
  - test
`;
    expect(() => validateSkillSchema(yaml)).toThrow('Missing required field: source');
  });

  // ── External source validation ─────────────────────────────────────────

  it('rejects external skill without url', () => {
    const yaml = `
source:
  type: external
  path: skills/pdf
categories:
  - documents
tags:
  - pdf
`;
    expect(() => validateSkillSchema(yaml)).toThrow('source.url');
  });

  it('rejects external skill with invalid url', () => {
    const yaml = `
source:
  type: external
  url: https://gitlab.com/org/repo
  path: skills/pdf
categories:
  - documents
tags:
  - pdf
`;
    expect(() => validateSkillSchema(yaml)).toThrow('valid GitHub repository URL');
  });

  it('rejects external skill without path', () => {
    const yaml = `
source:
  type: external
  url: https://github.com/org/repo
categories:
  - documents
tags:
  - pdf
`;
    expect(() => validateSkillSchema(yaml)).toThrow('source.path');
  });

  it('rejects path with invalid characters', () => {
    const yaml = `
source:
  type: external
  url: https://github.com/org/repo
  path: "skills/p@th with spaces"
categories:
  - documents
tags:
  - pdf
`;
    expect(() => validateSkillSchema(yaml)).toThrow('invalid characters');
  });

  // ── Category validation ────────────────────────────────────────────────

  it('rejects unknown category', () => {
    const yaml = `
source:
  type: internal
categories:
  - made-up-category
tags:
  - test
`;
    expect(() => validateSkillSchema(yaml)).toThrow('Invalid category: "made-up-category"');
  });

  it('rejects old category names', () => {
    const yaml = `
source:
  type: internal
categories:
  - document-processing
tags:
  - test
`;
    expect(() => validateSkillSchema(yaml)).toThrow('Invalid category');
  });

  it('rejects more than 3 categories', () => {
    const yaml = `
source:
  type: internal
categories:
  - development
  - databases
  - productivity
  - creativity
tags:
  - test
`;
    expect(() => validateSkillSchema(yaml)).toThrow('1-3 items');
  });

  it('rejects zero categories', () => {
    const yaml = `
source:
  type: internal
categories: []
tags:
  - test
`;
    expect(() => validateSkillSchema(yaml)).toThrow('1-3 items');
  });

  it('rejects duplicate categories', () => {
    const yaml = `
source:
  type: internal
categories:
  - development
  - development
tags:
  - test
`;
    expect(() => validateSkillSchema(yaml)).toThrow('duplicates');
  });

  // ── Tag validation ─────────────────────────────────────────────────────

  it('rejects tags with uppercase', () => {
    const yaml = `
source:
  type: internal
categories:
  - development
tags:
  - React
`;
    expect(() => validateSkillSchema(yaml)).toThrow('Invalid tag format');
  });

  it('rejects tags with special characters', () => {
    const yaml = `
source:
  type: internal
categories:
  - development
tags:
  - "c++"
`;
    expect(() => validateSkillSchema(yaml)).toThrow('Invalid tag format');
  });

  it('rejects more than 5 tags', () => {
    const yaml = `
source:
  type: internal
categories:
  - development
tags:
  - one
  - two
  - three
  - four
  - five
  - six
`;
    expect(() => validateSkillSchema(yaml)).toThrow('1-5 items');
  });

  it('rejects zero tags', () => {
    const yaml = `
source:
  type: internal
categories:
  - development
tags: []
`;
    expect(() => validateSkillSchema(yaml)).toThrow('1-5 items');
  });

  it('rejects duplicate tags', () => {
    const yaml = `
source:
  type: internal
categories:
  - development
tags:
  - api
  - api
`;
    expect(() => validateSkillSchema(yaml)).toThrow('duplicates');
  });

  it('rejects tag exceeding max length', () => {
    const longTag = 'a'.repeat(31);
    const yaml = `
source:
  type: internal
categories:
  - development
tags:
  - ${longTag}
`;
    expect(() => validateSkillSchema(yaml)).toThrow('maximum length');
  });

  // ── Malformed YAML ─────────────────────────────────────────────────────

  it('rejects invalid YAML syntax', () => {
    expect(() => validateSkillSchema('{ invalid yaml')).toThrow();
  });

  it('rejects non-object YAML', () => {
    expect(() => validateSkillSchema('"just a string"')).toThrow('YAML must be an object');
  });
});
