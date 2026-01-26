/**
 * Environment bindings for the Cloudflare Worker
 */
export interface Env {
  GITHUB_TOKEN: string;
  ENVIRONMENT: string;
}

/**
 * Request payload for single skill validation
 */
export interface ValidateRequest {
  skillPath: string;        // e.g., "anthropics/skills/pdf"
  yamlContent: string;      // Raw YAML content
  localSkillMd?: string;    // For internal skills, SKILL.md content from PR
}

/**
 * Request payload for batch validation
 */
export interface ValidateBatchRequest {
  skills: ValidateRequest[];
}

/**
 * Parsed skill YAML structure
 */
export interface SkillYaml {
  source: {
    type: 'external' | 'local';
    path?: string;
    ref?: string;
  };
  categories: string[];
  tags: string[];
  _meta?: SkillMeta;
}

/**
 * Auto-populated metadata
 */
export interface SkillMeta {
  name: string;
  description: string;
  license: string | null;
  compatibility: string | null;
  repoUrl: string;
  lastCommit: string | null;
  lastValidated: string;
  contentHash: string;
  status: 'active' | 'deprecated' | 'broken';
}

/**
 * Validation result
 */
export interface ValidationResult {
  success: boolean;
  skillPath: string;
  enrichedMeta?: SkillMeta;
  warnings?: string[];
  error?: string;
}

/**
 * SKILL.md frontmatter structure
 */
export interface SkillFrontmatter {
  name: string;
  description: string;
  version?: string;
  license?: string;
  compatibility?: string;
  metadata?: Record<string, unknown>;
}
