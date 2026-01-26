import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { validateSkillSchema } from './validate';
import { fetchSkillMd, fetchLastCommit } from './github';
import { parseFrontmatter } from './frontmatter';
import { computeHash, parseSkillPath, delay } from './utils';
import type { 
  Env, 
  ValidateRequest, 
  ValidateBatchRequest, 
  ValidationResult,
  SkillMeta 
} from './types';

const app = new Hono<{ Bindings: Env }>();

// Enable CORS for all routes
app.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Health check endpoint
app.get('/', (c) => {
  return c.json({
    service: 'OpenAgentSkills Validation Worker',
    version: '1.0.0',
    status: 'healthy',
    environment: c.env.ENVIRONMENT,
  });
});

// Single skill validation endpoint (used by PR workflow)
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
    return c.json(result);
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// Batch validation endpoint (used by daily cron)
app.post('/api/validate-batch', async (c) => {
  try {
    const body = await c.req.json<ValidateBatchRequest>();
    
    if (!Array.isArray(body.skills)) {
      return c.json({
        success: false,
        error: 'skills must be an array',
      }, 400);
    }

    const results: ValidationResult[] = [];
    
    for (const skill of body.skills) {
      // Rate limiting: 100ms between requests to avoid GitHub API limits
      await delay(100);
      const result = await validateSingleSkill(skill, c.env);
      results.push(result);
    }
    
    return c.json({ 
      success: true,
      totalProcessed: results.length,
      successCount: results.filter(r => r.success).length,
      failedCount: results.filter(r => !r.success).length,
      results 
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * Validate a single skill and return enriched metadata
 */
async function validateSingleSkill(
  { skillPath, yamlContent, localSkillMd }: ValidateRequest,
  env: Env
): Promise<ValidationResult> {
  const warnings: string[] = [];

  try {
    // 1. Parse and validate YAML schema
    const skill = validateSkillSchema(yamlContent);
    
    // 2. Parse skill path to get org/repo/skillName
    const { org, repo, skillName, isInternal } = parseSkillPath(skillPath);
    
    // 3. Fetch SKILL.md content
    let skillMdContent: string;
    let repoUrl: string;
    let lastCommit: string | null = null;
    
    if (isInternal) {
      // Internal skill - content provided in request or fetch from registry repo
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
      // External skill - fetch from source repo
      if (!repo) {
        throw new Error('External skills require repo in path');
      }
      
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
      
      repoUrl = `https://github.com/${org}/${repo}`;
    }
    
    // 4. Parse frontmatter
    const frontmatter = parseFrontmatter(skillMdContent);
    
    // 5. Validate name matches directory (warning only)
    const dirName = skillPath.split('/').pop();
    const normalizedFmName = frontmatter.name.toLowerCase().replace(/\s+/g, '-');
    const nameMatch = frontmatter.name === dirName || normalizedFmName === dirName;
    
    if (!nameMatch) {
      warnings.push(
        `Directory "${dirName}" differs from SKILL.md name "${frontmatter.name}"`
      );
    }
    
    // 6. Compute content hash
    const contentHash = await computeHash(
      frontmatter.name + frontmatter.description
    );
    
    // 7. Build enriched metadata
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
    
    return {
      success: true,
      skillPath,
      enrichedMeta,
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
