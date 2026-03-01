/**
 * Shared type definitions for the OpenAgentSkills validation worker.
 *
 * Architecture note: skill.yaml files in the repo are static, contributor-owned
 * config. All dynamic metadata (name, description, timestamps, status) is
 * stored in Cloudflare KV via the worker. The types here reflect both sides:
 * - SkillYaml: what the contributor writes in skill.yaml
 * - SkillEntry: the full record persisted to KV after validation
 */

/**
 * Cloudflare Worker environment bindings.
 * GITHUB_TOKEN is set via `wrangler secret put`.
 * SKILLS_KV is bound in wrangler.toml.
 */
export interface Env {
  GITHUB_TOKEN: string;
  ENVIRONMENT: string;
  SKILLS_KV: KVNamespace;
}

/**
 * Request payload for single skill validation.
 * When persist=true the worker writes the result to KV (used post-merge).
 * When persist=false (default) it only validates (used in PR checks).
 */
export interface ValidateRequest {
  skillPath: string;
  yamlContent: string;
  localSkillMd?: string;
  persist?: boolean;
}

/** Request payload for batch validation. */
export interface ValidateBatchRequest {
  skills: ValidateRequest[];
  persist?: boolean;
}

/**
 * Parsed structure of a contributor's skill.yaml file.
 * Does NOT include dynamic metadata -- that lives in KV only.
 */
export interface SkillYaml {
  source: {
    type: 'external' | 'internal';
    url?: string;
    path?: string;
    ref?: string;
  };
  categories: string[];
  tags: string[];
}

/**
 * Dynamic metadata extracted from SKILL.md and GitHub APIs.
 * Stored in KV, never written back to the YAML files.
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
 * Full skill record stored in KV under key `skill:{path}`.
 * Merges the static YAML data with enriched metadata from validation.
 */
export interface SkillEntry {
  id: string;
  path: string;
  name: string;
  description: string;
  categories: string[];
  tags: string[];
  source: {
    type: 'external' | 'internal';
    url?: string;
    org?: string;
    repo?: string;
    path?: string;
    ref?: string;
  };
  license: string | null;
  repoUrl: string;
  lastCommit: string | null;
  lastValidated: string;
  contentHash: string;
  status: 'active' | 'deprecated' | 'broken';
}

/**
 * Pre-built manifest stored in KV under key `registry:manifest`.
 * Returned by GET /api/skills for website and CLI consumption.
 */
export interface RegistryManifest {
  version: string;
  generatedAt: string;
  totalSkills: number;
  categories: CategoryEntry[];
  skills: SkillEntry[];
}

/** Category definition stored in KV under key `registry:categories`. */
export interface CategoryEntry {
  id: string;
  name: string;
  description: string;
  icon?: string;
  count: number;
}

/** Validation result returned by POST /api/validate. */
export interface ValidationResult {
  success: boolean;
  skillPath: string;
  enrichedMeta?: SkillMeta;
  skillEntry?: SkillEntry;
  warnings?: string[];
  error?: string;
}

/**
 * SKILL.md frontmatter structure per the agentskills.io specification.
 * Required fields: name, description. All others are optional.
 */
export interface SkillFrontmatter {
  name: string;
  description: string;
  version?: string;
  license?: string;
  compatibility?: string;
  metadata?: Record<string, unknown>;
}
