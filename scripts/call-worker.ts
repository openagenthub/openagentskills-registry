/**
 * Call Worker -- manual CLI utility
 *
 * Validates specific skill.yaml files by calling the Cloudflare Worker and
 * printing the results. This is a developer tool for local testing -- it
 * does NOT persist to KV or modify any files.
 *
 * Usage:
 *   WORKER_URL=https://your-worker.workers.dev \
 *     npx tsx scripts/call-worker.ts skills/anthropics/skills/pdf/skill.yaml
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const SKILLS_DIR = join(ROOT_DIR, 'skills');
const INTERNAL_SKILLS_DIR = join(ROOT_DIR, 'openagentskills');

interface ValidationResult {
  success: boolean;
  skillPath: string;
  enrichedMeta?: Record<string, unknown>;
  warnings?: string[];
  error?: string;
}

function toSkillPath(filePath: string): string {
  return filePath
    .replace(SKILLS_DIR + '/', '')
    .replace(/^skills\//, '')
    .replace(/\/skill\.yaml$/, '');
}

function readLocalSkillMd(skillPath: string): string | null {
  if (!skillPath.startsWith('openagentskills/')) return null;
  const skillName = skillPath.replace('openagentskills/', '');
  const mdPath = join(INTERNAL_SKILLS_DIR, skillName, 'SKILL.md');
  return existsSync(mdPath) ? readFileSync(mdPath, 'utf-8') : null;
}

async function main(): Promise<void> {
  const workerUrl = process.env.WORKER_URL;
  const files = process.argv.slice(2);

  if (!workerUrl) {
    console.error('WORKER_URL environment variable is required');
    console.log('\nUsage: WORKER_URL=https://... npx tsx scripts/call-worker.ts [files...]');
    process.exit(1);
  }

  if (files.length === 0) {
    console.log('No files specified');
    return;
  }

  console.log(`Validating ${files.length} skill(s) via ${workerUrl}\n`);

  let hasErrors = false;

  for (const file of files) {
    // Handle JSON arrays from CI
    let filePaths: string[];
    if (file.startsWith('[')) {
      filePaths = JSON.parse(file) as string[];
    } else {
      filePaths = [file];
    }

    for (const fp of filePaths) {
      if (!fp.endsWith('skill.yaml')) {
        console.log(`Skipping non-skill file: ${fp}`);
        continue;
      }

      const fullPath = fp.startsWith('/') ? fp : join(ROOT_DIR, fp);

      if (!existsSync(fullPath)) {
        console.error(`File not found: ${fullPath}`);
        hasErrors = true;
        continue;
      }

      const skillPath = toSkillPath(fullPath);
      const yamlContent = readFileSync(fullPath, 'utf-8');
      const localSkillMd = readLocalSkillMd(skillPath);

      console.log(`Validating: ${skillPath}`);

      try {
        const response = await fetch(`${workerUrl}/api/validate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ skillPath, yamlContent, localSkillMd, persist: false }),
        });

        if (!response.ok) {
          console.error(`  Worker error: ${response.status}`);
          hasErrors = true;
          continue;
        }

        const result = (await response.json()) as ValidationResult;

        if (result.success) {
          console.log(`  PASS`);
          if (result.enrichedMeta) {
            console.log(`  Meta: ${JSON.stringify(result.enrichedMeta, null, 2)}`);
          }
          if (result.warnings) {
            for (const w of result.warnings) console.log(`  WARN: ${w}`);
          }
        } else {
          console.error(`  FAIL: ${result.error}`);
          hasErrors = true;
        }
      } catch (error) {
        console.error(`  Error: ${error instanceof Error ? error.message : 'Unknown'}`);
        hasErrors = true;
      }

      console.log('');
    }
  }

  if (hasErrors) {
    process.exit(1);
  }
}

main().catch(console.error);
