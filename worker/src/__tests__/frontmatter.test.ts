import { describe, it, expect } from 'vitest';
import { parseFrontmatter } from '../frontmatter';

describe('parseFrontmatter', () => {
  it('parses valid frontmatter with all fields', () => {
    const content = `---
name: api-design
description: Design RESTful APIs with best practices.
version: 1.0.0
license: MIT
compatibility: Node.js 18+
---

# API Design

Instructions here.
`;

    const fm = parseFrontmatter(content);
    expect(fm.name).toBe('api-design');
    expect(fm.description).toBe('Design RESTful APIs with best practices.');
    expect(fm.version).toBe('1.0.0');
    expect(fm.license).toBe('MIT');
    expect(fm.compatibility).toBe('Node.js 18+');
  });

  it('parses frontmatter with only required fields', () => {
    const content = `---
name: minimal-skill
description: A minimal skill.
---

# Content
`;
    const fm = parseFrontmatter(content);
    expect(fm.name).toBe('minimal-skill');
    expect(fm.description).toBe('A minimal skill.');
    expect(fm.version).toBeUndefined();
    expect(fm.license).toBeUndefined();
  });

  it('handles double-quoted strings', () => {
    const content = `---
name: "quoted-name"
description: "A description with: colons"
---
`;
    const fm = parseFrontmatter(content);
    expect(fm.name).toBe('quoted-name');
    expect(fm.description).toBe('A description with: colons');
  });

  it('handles single-quoted strings', () => {
    const content = `---
name: 'single-quoted'
description: 'Another description'
---
`;
    const fm = parseFrontmatter(content);
    expect(fm.name).toBe('single-quoted');
  });

  it('handles multiline values with pipe', () => {
    const content = `---
name: multi
description: |
  Line one
  Line two
---
`;
    const fm = parseFrontmatter(content);
    expect(fm.name).toBe('multi');
    expect(fm.description).toContain('Line one');
    expect(fm.description).toContain('Line two');
  });

  it('throws on missing frontmatter markers', () => {
    const content = `# No frontmatter here

Just markdown.
`;
    expect(() => parseFrontmatter(content)).toThrow('YAML frontmatter');
  });

  it('throws on missing name', () => {
    const content = `---
description: Has description but no name
---
`;
    expect(() => parseFrontmatter(content)).toThrow('missing required "name"');
  });

  it('throws on missing description', () => {
    const content = `---
name: has-name
---
`;
    expect(() => parseFrontmatter(content)).toThrow('missing required "description"');
  });

  it('throws on empty frontmatter', () => {
    const content = `---
---
`;
    expect(() => parseFrontmatter(content)).toThrow();
  });
});
