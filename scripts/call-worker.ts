/**
 * Call Worker Script
 * 
 * Utility script to call the Cloudflare Worker for validating skills.
 * Used by GitHub Actions and for local testing.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const SKILLS_DIR = join(ROOT_DIR, 'skills');
const OPENAGENTSKILLS_DIR = join(ROOT_DIR, 'openagentskills');

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
 * Validate a single skill via the worker
 */
async function validateSkill(
  workerUrl: string,
  skillPath: string,
  yamlContent: string
): Promise<ValidationResult> {
  const localSkillMd = getLocalSkillMd(skillPath);
  
  const response = await fetch(`${workerUrl}/api/validate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      skillPath,
      yamlContent,
      localSkillMd,
    }),
  });
  
  if (!response.ok) {
    throw new Error(`Worker returned ${response.status}: ${await response.text()}`);
  }
  
  return response.json();
}

/**
 * Update skill.yaml with enriched metadata
 */
function updateSkillYaml(filePath: string, enrichedMeta: ValidationResult['enrichedMeta']): void {
  if (!enrichedMeta) return;
  
  const content = readFileSync(filePath, 'utf-8');
  const yaml = parseYaml(content) as Record<string, unknown>;
  
  // Update _meta section
  yaml._meta = enrichedMeta;
  
  // Write back with preserved formatting
  const newContent = stringifyYaml(yaml, {
    lineWidth: 0,
    defaultKeyType: 'PLAIN',
    defaultStringType: 'PLAIN',
  });
  
  writeFileSync(filePath, newContent);
}

/**
 * Main function
 */
async function main(): Promise<void> {
  const workerUrl = process.env.WORKER_URL;
  const changedFiles = process.argv.slice(2);
  
  if (!workerUrl) {
    console.error('Error: WORKER_URL environment variable not set');
    console.log('\nUsage: WORKER_URL=https://your-worker.workers.dev npx tsx scripts/call-worker.ts [files...]');
    process.exit(1);
  }
  
  if (changedFiles.length === 0) {
    console.log('No files to validate');
    return;
  }
  
  console.log(`Validating ${changedFiles.length} skill(s) via ${workerUrl}\n`);
  
  let hasErrors = false;
  
  for (const file of changedFiles) {
    // Handle JSON array from GitHub Actions
    let filePath = file;
    if (file.startsWith('[')) {
      const files = JSON.parse(file) as string[];
      for (const f of files) {
        await processFile(workerUrl, f);
      }
      continue;
    }
    
    await processFile(workerUrl, filePath);
  }
  
  if (hasErrors) {
    process.exit(1);
  }
  
  async function processFile(workerUrl: string, filePath: string): Promise<void> {
    if (!filePath.endsWith('skill.yaml')) {
      console.log(`Skipping non-skill file: ${filePath}`);
      return;
    }
    
    const fullPath = filePath.startsWith('/') ? filePath : join(ROOT_DIR, filePath);
    
    if (!existsSync(fullPath)) {
      console.error(`File not found: ${fullPath}`);
      hasErrors = true;
      return;
    }
    
    const skillPath = parseSkillPath(fullPath);
    console.log(`Validating: ${skillPath}`);
    
    try {
      const yamlContent = readFileSync(fullPath, 'utf-8');
      const result = await validateSkill(workerUrl, skillPath, yamlContent);
      
      if (result.success) {
        console.log(`  ✓ Valid`);
        
        if (result.warnings && result.warnings.length > 0) {
          for (const warning of result.warnings) {
            console.log(`  ⚠ Warning: ${warning}`);
          }
        }
        
        // Update yaml with enriched metadata if provided
        if (result.enrichedMeta) {
          updateSkillYaml(fullPath, result.enrichedMeta);
          console.log(`  ↻ Updated metadata`);
        }
      } else {
        console.error(`  ✗ Error: ${result.error}`);
        hasErrors = true;
      }
    } catch (error) {
      console.error(`  ✗ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      hasErrors = true;
    }
    
    console.log('');
  }
}

main().catch(console.error);
