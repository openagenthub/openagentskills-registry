/**
 * Validate All Script
 * 
 * Validates all skills in the registry via the Cloudflare Worker.
 * Used by the daily cron job.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const SKILLS_DIR = join(ROOT_DIR, 'skills');
const OPENAGENTSKILLS_DIR = join(ROOT_DIR, 'openagentskills');

interface SkillYaml {
  source: {
    type: 'external' | 'local';
    path?: string;
    ref?: string;
  };
  categories: string[];
  tags: string[];
  _meta?: Record<string, unknown>;
}

interface ValidationResult {
  success: boolean;
  skillPath: string;
  enrichedMeta?: {
    name: string;
    description: string;
    license: string | null;
    compatibility: string | null;
    repoUrl: string;
    lastCommit: string | null;
    lastValidated: string;
    contentHash: string;
    status: 'active' | 'deprecated' | 'broken';
  };
  warnings?: string[];
  error?: string;
}

/**
 * Recursively find all skill.yaml files
 */
function findSkillYamls(dir: string): string[] {
  const files: string[] = [];
  
  if (!existsSync(dir)) {
    return files;
  }
  
  const entries = readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    
    if (entry.isDirectory()) {
      files.push(...findSkillYamls(fullPath));
    } else if (entry.name === 'skill.yaml') {
      files.push(fullPath);
    }
  }
  
  return files;
}

/**
 * Parse skill path from file path
 */
function parseSkillPath(filePath: string): string {
  const relativePath = filePath.replace(SKILLS_DIR + '/', '');
  return relativePath.replace('/skill.yaml', '');
}

/**
 * Check if skill is internal (openagentskills)
 */
function isInternalSkill(skillPath: string): boolean {
  return skillPath.startsWith('openagentskills/');
}

/**
 * Get SKILL.md content for internal skills
 */
function getLocalSkillMd(skillPath: string): string | null {
  if (!isInternalSkill(skillPath)) return null;
  
  const skillName = skillPath.replace('openagentskills/', '');
  const mdPath = join(OPENAGENTSKILLS_DIR, skillName, 'SKILL.md');
  
  if (existsSync(mdPath)) {
    return readFileSync(mdPath, 'utf-8');
  }
  return null;
}

/**
 * Main function
 */
async function main(): Promise<void> {
  const workerUrl = process.env.WORKER_URL;
  
  if (!workerUrl) {
    console.error('Error: WORKER_URL environment variable not set');
    process.exit(1);
  }
  
  // Find all skill files
  const skillFiles = findSkillYamls(SKILLS_DIR);
  console.log(`Found ${skillFiles.length} skill(s) to validate\n`);
  
  // Build batch request
  const skills = skillFiles.map(filePath => {
    const skillPath = parseSkillPath(filePath);
    const yamlContent = readFileSync(filePath, 'utf-8');
    const localSkillMd = getLocalSkillMd(skillPath);
    
    return {
      skillPath,
      yamlContent,
      localSkillMd,
      filePath, // Keep for updating
    };
  });
  
  // Call batch endpoint
  console.log(`Calling worker batch endpoint...`);
  
  const response = await fetch(`${workerUrl}/api/validate-batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      skills: skills.map(({ skillPath, yamlContent, localSkillMd }) => ({
        skillPath,
        yamlContent,
        localSkillMd,
      })),
    }),
  });
  
  if (!response.ok) {
    console.error(`Worker error: ${response.status} - ${await response.text()}`);
    process.exit(1);
  }
  
  const result = await response.json() as {
    results: ValidationResult[];
    successCount: number;
    failedCount: number;
  };
  
  console.log(`\nResults: ${result.successCount} valid, ${result.failedCount} failed\n`);
  
  // Process results
  let brokenCount = 0;
  
  for (let i = 0; i < result.results.length; i++) {
    const validationResult = result.results[i];
    const skill = skills[i];
    
    if (validationResult.success) {
      console.log(`✓ ${validationResult.skillPath}`);
      
      // Update yaml with new metadata
      if (validationResult.enrichedMeta) {
        const content = readFileSync(skill.filePath, 'utf-8');
        const yaml = parseYaml(content) as SkillYaml;
        yaml._meta = validationResult.enrichedMeta;
        
        const newContent = stringifyYaml(yaml, {
          lineWidth: 0,
          defaultKeyType: 'PLAIN',
          defaultStringType: 'PLAIN',
        });
        
        writeFileSync(skill.filePath, newContent);
      }
      
      if (validationResult.warnings) {
        for (const warning of validationResult.warnings) {
          console.log(`  ⚠ ${warning}`);
        }
      }
    } else {
      console.log(`✗ ${validationResult.skillPath}: ${validationResult.error}`);
      brokenCount++;
      
      // Mark as broken in yaml
      const content = readFileSync(skill.filePath, 'utf-8');
      const yaml = parseYaml(content) as SkillYaml;
      yaml._meta = yaml._meta || {};
      yaml._meta.status = 'broken';
      yaml._meta.lastValidated = new Date().toISOString();
      
      const newContent = stringifyYaml(yaml, {
        lineWidth: 0,
        defaultKeyType: 'PLAIN',
        defaultStringType: 'PLAIN',
      });
      
      writeFileSync(skill.filePath, newContent);
    }
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`   Total: ${skills.length}`);
  console.log(`   Valid: ${result.successCount}`);
  console.log(`   Broken: ${brokenCount}`);
  
  if (brokenCount > 0) {
    process.exit(1);
  }
}

main().catch(console.error);
