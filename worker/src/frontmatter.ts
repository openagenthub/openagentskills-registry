import type { SkillFrontmatter } from './types';

/**
 * Parse YAML frontmatter from SKILL.md content
 * 
 * Expects format:
 * ---
 * name: skill-name
 * description: Skill description
 * license: MIT
 * ---
 * 
 * # Skill Content
 */
export function parseFrontmatter(content: string): SkillFrontmatter {
  // Match frontmatter between --- markers
  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
  
  if (!frontmatterMatch) {
    throw new Error('SKILL.md must have YAML frontmatter between --- markers');
  }

  const frontmatterStr = frontmatterMatch[1];
  const data: Record<string, string | Record<string, unknown>> = {};

  // Simple YAML parsing for frontmatter
  const lines = frontmatterStr.split('\n');
  let currentKey = '';
  let inMultiline = false;
  let multilineValue = '';

  for (const line of lines) {
    // Skip empty lines
    if (!line.trim()) continue;

    // Check for multiline continuation
    if (inMultiline) {
      if (line.startsWith('  ') || line.startsWith('\t')) {
        multilineValue += '\n' + line.trim();
        continue;
      } else {
        data[currentKey] = multilineValue.trim();
        inMultiline = false;
      }
    }

    // Parse key: value
    const match = line.match(/^([a-zA-Z_-]+):\s*(.*)$/);
    if (match) {
      const [, key, value] = match;
      currentKey = key;
      
      if (value.startsWith('|') || value.startsWith('>')) {
        // Multiline value
        inMultiline = true;
        multilineValue = '';
      } else if (value.startsWith('"') && value.endsWith('"')) {
        // Quoted string
        data[key] = value.slice(1, -1);
      } else if (value.startsWith("'") && value.endsWith("'")) {
        // Single quoted string
        data[key] = value.slice(1, -1);
      } else if (value) {
        data[key] = value;
      }
    }
  }

  // Handle last multiline value
  if (inMultiline && currentKey) {
    data[currentKey] = multilineValue.trim();
  }

  // Validate required fields
  if (!data.name || typeof data.name !== 'string') {
    throw new Error('SKILL.md missing required "name" in frontmatter');
  }

  if (!data.description || typeof data.description !== 'string') {
    throw new Error('SKILL.md missing required "description" in frontmatter');
  }

  return {
    name: data.name,
    description: data.description,
    version: typeof data.version === 'string' ? data.version : undefined,
    license: typeof data.license === 'string' ? data.license : undefined,
    compatibility: typeof data.compatibility === 'string' ? data.compatibility : undefined,
    metadata: typeof data.metadata === 'object' ? data.metadata : undefined,
  };
}
