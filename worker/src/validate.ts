/**
 * Skill YAML schema validation.
 *
 * Validates contributor-submitted skill.yaml files against the registry schema.
 * Categories must match the canonical list in categories.yaml at the repo root.
 * Source types: "external" (points to another GitHub repo) or "internal"
 * (SKILL.md lives inside this registry under openagentskills/).
 */

import { parse as parseYaml } from 'yaml';
import type { SkillYaml } from './types';

/**
 * Canonical category IDs -- kept in sync with categories.yaml.
 * If a new category is added there, it must be added here too.
 */
const VALID_CATEGORIES = [
  'development',
  'databases',
  'cloud-services',
  'productivity',
  'marketing',
  'creativity',
  'data-analytics',
  'integrations',
  'communication',
  'documents',
];

const TAG_PATTERN = /^[a-z][a-z0-9-]*$/;
const MAX_TAG_LENGTH = 30;

/**
 * Validates the skill YAML content against our schema
 */
export function validateSkillSchema(yamlContent: string): SkillYaml {
  let parsed: unknown;
  
  try {
    parsed = parseYaml(yamlContent);
  } catch (e) {
    throw new Error(`Invalid YAML syntax: ${e instanceof Error ? e.message : 'Unknown error'}`);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('YAML must be an object');
  }

  const skill = parsed as Record<string, unknown>;

  // Validate source
  if (!skill.source || typeof skill.source !== 'object') {
    throw new Error('Missing required field: source');
  }

  const source = skill.source as Record<string, unknown>;
  
  if (!source.type || (source.type !== 'external' && source.type !== 'internal')) {
    throw new Error('source.type must be "external" or "internal"');
  }

  if (source.type === 'external') {
    if (!source.url || typeof source.url !== 'string') {
      throw new Error('External skills require source.url (GitHub repository URL)');
    }
    if (!/^https:\/\/github\.com\/[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(source.url)) {
      throw new Error('source.url must be a valid GitHub repository URL (https://github.com/{org}/{repo})');
    }
    if (!source.path || typeof source.path !== 'string') {
      throw new Error('External skills require source.path');
    }
    if (!/^[a-zA-Z0-9._/-]+$/.test(source.path)) {
      throw new Error('source.path contains invalid characters');
    }
  }

  // Validate categories
  if (!Array.isArray(skill.categories)) {
    throw new Error('Missing required field: categories (must be an array)');
  }

  if (skill.categories.length < 1 || skill.categories.length > 3) {
    throw new Error('categories must have 1-3 items');
  }

  for (const cat of skill.categories) {
    if (typeof cat !== 'string') {
      throw new Error('Each category must be a string');
    }
    if (!VALID_CATEGORIES.includes(cat)) {
      throw new Error(`Invalid category: "${cat}". Valid categories: ${VALID_CATEGORIES.join(', ')}`);
    }
  }

  // Check for duplicates
  if (new Set(skill.categories).size !== skill.categories.length) {
    throw new Error('categories must not contain duplicates');
  }

  // Validate tags
  if (!Array.isArray(skill.tags)) {
    throw new Error('Missing required field: tags (must be an array)');
  }

  if (skill.tags.length < 1 || skill.tags.length > 5) {
    throw new Error('tags must have 1-5 items');
  }

  for (const tag of skill.tags) {
    if (typeof tag !== 'string') {
      throw new Error('Each tag must be a string');
    }
    if (!TAG_PATTERN.test(tag)) {
      throw new Error(`Invalid tag format: "${tag}". Must be lowercase alphanumeric with hyphens, starting with a letter`);
    }
    if (tag.length > MAX_TAG_LENGTH) {
      throw new Error(`Tag "${tag}" exceeds maximum length of ${MAX_TAG_LENGTH}`);
    }
  }

  // Check for duplicates
  if (new Set(skill.tags).size !== skill.tags.length) {
    throw new Error('tags must not contain duplicates');
  }

  return {
    source: {
      type: source.type as 'external' | 'internal',
      url: source.url as string | undefined,
      path: source.path as string | undefined,
      ref: (source.ref as string) || 'main',
    },
    categories: skill.categories as string[],
    tags: skill.tags as string[],
  };
}
