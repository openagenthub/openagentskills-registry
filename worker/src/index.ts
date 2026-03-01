/**
 * OpenAgentSkills Registry Worker
 *
 * This Cloudflare Worker serves two roles:
 *
 * 1. **Validation API** (POST endpoints) -- called by GitHub Actions to
 *    validate skill.yaml submissions. When `persist: true` is set in the
 *    request, validated results are written to Cloudflare KV.
 *
 * 2. **Registry API** (GET endpoints) -- consumed by the website
 *    (openagentskills.org) and the CLI (`openskills`). Returns skill data
 *    from KV so consumers always get fresh metadata without depending on
 *    a static JSON file in the git repo.
 *
 * Data flow:
 *   PR check   → POST /api/validate (persist=false) → validation only
 *   Post-merge → POST /api/validate (persist=true)  → writes to KV
 *   Daily cron → POST /api/validate-batch            → re-validates all, writes to KV
 *   Website    → GET  /api/skills                    → reads pre-built manifest from KV
 *   CLI        → GET  /api/skills/:path              → reads single skill from KV
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { validateSkillSchema } from './validate';
import { fetchSkillMd, fetchLastCommit } from './github';
import { parseFrontmatter } from './frontmatter';
import { computeHash, parseSkillPath, delay } from './utils';
import {
  writeSkill,
  readSkill,
  readManifest,
  readCategories,
  writeCategories,
  rebuildManifest,
} from './kv';
import type {
  Env,
  ValidateRequest,
  ValidateBatchRequest,
  ValidationResult,
  SkillMeta,
  SkillEntry,
  CategoryEntry,
} from './types';

const app = new Hono<{ Bindings: Env }>();

app.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// ── Health check ────────────────────────────────────────────────────────────

app.get('/', (c) => {
  return c.json({
    service: 'OpenAgentSkills Registry Worker',
    version: '2.0.0',
    status: 'healthy',
    environment: c.env.ENVIRONMENT,
  });
});

// ── Registry API (GET) ─────────────────────────────────────────────────────

/**
 * GET /api/skills
 * Returns the full registry manifest from KV.
 * This is the primary endpoint consumed by the website and CLI.
 */
app.get('/api/skills', async (c) => {
  const manifest = await readManifest(c.env.SKILLS_KV);
  if (!manifest) {
    return c.json({ version: '2.0.0', generatedAt: null, totalSkills: 0, categories: [], skills: [] });
  }
  return c.json(manifest);
});

/**
 * GET /api/skills/:path+
 * Returns a single skill entry from KV.
 * The :path+ param captures nested segments (e.g. anthropics/skills/pdf).
 */
app.get('/api/skills/:path{.+}', async (c) => {
  const skillPath = c.req.param('path');
  const entry = await readSkill(c.env.SKILLS_KV, skillPath);

  if (!entry) {
    return c.json({ error: `Skill not found: ${skillPath}` }, 404);
  }

  return c.json(entry);
});

/** GET /api/categories -- returns category definitions from KV. */
app.get('/api/categories', async (c) => {
  const categories = await readCategories(c.env.SKILLS_KV);
  return c.json({ categories });
});

// ── Categories sync (POST) ─────────────────────────────────────────────────

/**
 * POST /api/categories
 * Receives the categories array (from categories.yaml) and writes it to KV.
 * Called by the sync-registry GitHub Action whenever categories.yaml changes.
 */
app.post('/api/categories', async (c) => {
  try {
    const body = await c.req.json<{ categories: CategoryEntry[] }>();

    if (!Array.isArray(body.categories)) {
      return c.json({ success: false, error: 'categories must be an array' }, 400);
    }

    await writeCategories(c.env.SKILLS_KV, body.categories);
    return c.json({ success: true, count: body.categories.length });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// ── Manifest rebuild (POST) ────────────────────────────────────────────────

/**
 * POST /api/rebuild-manifest
 * Rebuilds the manifest from all individual skill entries in KV.
 * Called at the end of a sync-registry run to ensure GET /api/skills is current.
 */
app.post('/api/rebuild-manifest', async (c) => {
  try {
    const manifest = await rebuildManifest(c.env.SKILLS_KV);
    return c.json({
      success: true,
      totalSkills: manifest.totalSkills,
      categories: manifest.categories.length,
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// ── Validation API (POST) ──────────────────────────────────────────────────

/**
 * POST /api/validate
 * Validates a single skill.yaml against the schema, fetches its SKILL.md,
 * and returns enriched metadata. If `persist: true`, writes the result to KV.
 */
app.post('/api/validate', async (c) => {
  try {
    const body = await c.req.json<ValidateRequest>();

    if (!body.skillPath || !body.yamlContent) {
      return c.json({
        success: false,
        error: 'Missing required fields: skillPath, yamlContent',
      }, 400);
    }

    const result = await validateSingleSkill(body, c.env);

    if (result.success && body.persist && result.skillEntry) {
      await writeSkill(c.env.SKILLS_KV, body.skillPath, result.skillEntry);
    }

    return c.json(result);
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * POST /api/validate-batch
 * Validates multiple skills in sequence (with rate limiting).
 * If `persist: true`, writes all successful results to KV and rebuilds the manifest.
 */
app.post('/api/validate-batch', async (c) => {
  try {
    const body = await c.req.json<ValidateBatchRequest>();

    if (!Array.isArray(body.skills)) {
      return c.json({ success: false, error: 'skills must be an array' }, 400);
    }

    const results: ValidationResult[] = [];

    for (const skill of body.skills) {
      await delay(100);
      const result = await validateSingleSkill(skill, c.env);
      results.push(result);

      if (body.persist && result.success && result.skillEntry) {
        await writeSkill(c.env.SKILLS_KV, skill.skillPath, result.skillEntry);
      }
    }

    if (body.persist) {
      await rebuildManifest(c.env.SKILLS_KV);
    }

    return c.json({
      success: true,
      totalProcessed: results.length,
      successCount: results.filter((r) => r.success).length,
      failedCount: results.filter((r) => !r.success).length,
      results,
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// ── Internal helpers ────────────────────────────────────────────────────────

/**
 * Core validation logic shared by single and batch endpoints.
 *
 * Steps:
 * 1. Parse and validate the YAML against the schema
 * 2. Determine org/repo from the skill path
 * 3. Fetch SKILL.md (from GitHub for external, from request body for internal)
 * 4. Parse SKILL.md frontmatter for name, description, license, etc.
 * 5. Compute a content hash for change detection
 * 6. Build the full SkillEntry (static YAML data + dynamic metadata)
 */
async function validateSingleSkill(
  { skillPath, yamlContent, localSkillMd }: ValidateRequest,
  env: Env,
): Promise<ValidationResult> {
  const warnings: string[] = [];

  try {
    const skill = validateSkillSchema(yamlContent);
    const { org, repo, skillName, isInternal } = parseSkillPath(skillPath);

    let skillMdContent: string;
    let repoUrl: string;
    let lastCommit: string | null = null;

    if (isInternal) {
      if (localSkillMd) {
        skillMdContent = localSkillMd;
      } else {
        skillMdContent = await fetchSkillMd({
          org: 'openagenthub',
          repo: 'openagentskills-registry',
          path: `openagentskills/${skillName}/SKILL.md`,
          ref: 'main',
        }, env);
      }
      repoUrl = 'https://github.com/openagenthub/openagentskills-registry';
    } else {
      if (!repo) {
        throw new Error('External skills require repo in path');
      }

      // Use the explicit url from the YAML when available
      repoUrl = skill.source.url || `https://github.com/${org}/${repo}`;
      const sourcePath = skill.source.path || skillName;

      skillMdContent = await fetchSkillMd({
        org,
        repo,
        path: `${sourcePath}/SKILL.md`,
        ref: skill.source.ref || 'main',
      }, env);

      lastCommit = await fetchLastCommit({
        org,
        repo,
        path: sourcePath,
        ref: skill.source.ref || 'main',
      }, env);
    }

    const frontmatter = parseFrontmatter(skillMdContent);

    // Warn if SKILL.md name diverges from directory name
    const dirName = skillPath.split('/').pop();
    const normalizedFmName = frontmatter.name.toLowerCase().replace(/\s+/g, '-');
    if (frontmatter.name !== dirName && normalizedFmName !== dirName) {
      warnings.push(
        `Directory "${dirName}" differs from SKILL.md name "${frontmatter.name}"`,
      );
    }

    const contentHash = await computeHash(
      frontmatter.name + frontmatter.description,
    );

    const enrichedMeta: SkillMeta = {
      name: frontmatter.name,
      description: frontmatter.description,
      license: frontmatter.license || null,
      compatibility: frontmatter.compatibility || null,
      repoUrl,
      lastCommit,
      lastValidated: new Date().toISOString(),
      contentHash: `sha256:${contentHash}`,
      status: 'active',
    };

    // Build the full entry that gets stored in KV
    const parts = skillPath.split('/');
    const skillEntry: SkillEntry = {
      id: skillPath,
      path: skillPath,
      name: enrichedMeta.name,
      description: enrichedMeta.description,
      categories: skill.categories,
      tags: skill.tags,
      source: isInternal
        ? { type: 'internal' }
        : {
            type: 'external',
            url: skill.source.url,
            org,
            repo: repo!,
            path: skill.source.path,
            ref: skill.source.ref || 'main',
          },
      license: enrichedMeta.license,
      repoUrl: enrichedMeta.repoUrl,
      lastCommit: enrichedMeta.lastCommit,
      lastValidated: enrichedMeta.lastValidated,
      contentHash: enrichedMeta.contentHash,
      status: enrichedMeta.status,
    };

    return {
      success: true,
      skillPath,
      enrichedMeta,
      skillEntry,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    return {
      success: false,
      skillPath,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export default app;
