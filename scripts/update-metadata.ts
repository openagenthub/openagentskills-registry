/**
 * Update Metadata Script
 * 
 * Updates metadata for changed skill files after validation.
 * Called by the build-index workflow.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const SKILLS_DIR = join(ROOT_DIR, 'skills');
const OPENAGENTSKILLS_DIR = join(ROOT_DIR, 'openagentskills');

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
  const changedFilesArg = process.argv[2];
  
  if (!workerUrl) {
    console.error('Error: WORKER_URL environment variable not set');
    process.exit(1);
  }
  
  if (!changedFilesArg) {
    console.log('No changed files specified');
    return;
  }
  
  // Parse changed files (could be JSON array from GitHub Actions)
  let changedFiles: string[];
  try {
    changedFiles = JSON.parse(changedFilesArg);
  } catch {
    changedFiles = changedFilesArg.split(',').map(f => f.trim());
  }
  
  // Filter to only skill.yaml files
  const skillFiles = changedFiles.filter(f => f.endsWith('skill.yaml'));
  
  if (skillFiles.length === 0) {
    console.log('No skill.yaml files in changed files');
    return;
  }
  
  console.log(`Updating metadata for ${skillFiles.length} skill(s)\n`);
  
  for (const file of skillFiles) {
    const fullPath = file.startsWith('/') ? file : join(ROOT_DIR, file);
    
    if (!existsSync(fullPath)) {
      console.log(`Skipping (not found): ${file}`);
      continue;
    }
    
    const skillPath = parseSkillPath(fullPath);
    console.log(`Processing: ${skillPath}`);
    
    try {
      const yamlContent = readFileSync(fullPath, 'utf-8');
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
        console.error(`  ✗ Worker error: ${response.status}`);
        continue;
      }
      
      const result = await response.json() as {
        success: boolean;
        enrichedMeta?: Record<string, unknown>;
        error?: string;
      };
      
      if (result.success && result.enrichedMeta) {
        const yaml = parseYaml(yamlContent) as Record<string, unknown>;
        yaml._meta = result.enrichedMeta;
        
        const newContent = stringifyYaml(yaml, {
          lineWidth: 0,
          defaultKeyType: 'PLAIN',
          defaultStringType: 'PLAIN',
        });
        
        writeFileSync(fullPath, newContent);
        console.log(`  ✓ Updated`);
      } else if (!result.success) {
        console.error(`  ✗ ${result.error}`);
      }
    } catch (error) {
      console.error(`  ✗ ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

main().catch(console.error);
