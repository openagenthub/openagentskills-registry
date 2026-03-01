/**
 * Validate Changed Skills
 *
 * Used by the PR validation GitHub Action. Reads the list of changed files
 * from the CHANGED_FILES environment variable (JSON array produced by
 * dorny/paths-filter), then calls POST /api/validate on the Cloudflare
 * Worker for each changed skill.yaml.
 *
 * persist is always false here -- PR checks only validate, they never write
 * to KV. That happens post-merge via sync-registry.ts.
 *
 * For internal skills the corresponding SKILL.md is read from
 * openagentskills/{skill-name}/SKILL.md and sent along in the request so
 * the worker can validate it without hitting GitHub.
 *
 * Exit codes:
 *   0 - all skills valid
 *   1 - one or more skills failed validation
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
  warnings?: string[];
  error?: string;
}

/**
 * Derive the registry skill path from a file path.
 * Strips the `skills/` prefix and the trailing `/skill.yaml`.
 *
 *   skills/anthropics/skills/pdf/skill.yaml  ->  anthropics/skills/pdf
 *   skills/openagentskills/git-workflow/skill.yaml  ->  openagentskills/git-workflow
 */
function toSkillPath(filePath: string): string {
  return filePath
    .replace(/^skills\//, '')
    .replace(/\/skill\.yaml$/, '');
}

/** Read SKILL.md for an internal skill, or return null. */
function readLocalSkillMd(skillPath: string): string | null {
  if (!skillPath.startsWith('openagentskills/')) return null;

  const skillName = skillPath.replace('openagentskills/', '');
  const mdPath = join(INTERNAL_SKILLS_DIR, skillName, 'SKILL.md');

  if (existsSync(mdPath)) {
    return readFileSync(mdPath, 'utf-8');
  }
  return null;
}

async function main(): Promise<void> {
  const workerUrl = process.env.WORKER_URL;
  const changedFilesRaw = process.env.CHANGED_FILES;

  if (!workerUrl) {
    console.error('WORKER_URL environment variable is required');
    process.exit(1);
  }

  if (!changedFilesRaw) {
    console.log('No CHANGED_FILES provided -- nothing to validate');
    return;
  }

  let changedFiles: string[];
  try {
    changedFiles = JSON.parse(changedFilesRaw);
  } catch {
    changedFiles = changedFilesRaw.split(',').map((f) => f.trim());
  }

  const skillFiles = changedFiles.filter((f) => f.endsWith('skill.yaml'));

  if (skillFiles.length === 0) {
    console.log('No skill.yaml files in changed set');
    return;
  }

  console.log(`Validating ${skillFiles.length} changed skill(s)...\n`);

  let hasErrors = false;

  for (const file of skillFiles) {
    const fullPath = join(ROOT_DIR, file);

    if (!existsSync(fullPath)) {
      console.error(`File not found: ${file}`);
      hasErrors = true;
      continue;
    }

    const skillPath = toSkillPath(file);
    const yamlContent = readFileSync(fullPath, 'utf-8');
    const localSkillMd = readLocalSkillMd(skillPath);

    console.log(`  Validating: ${skillPath}`);

    try {
      const response = await fetch(`${workerUrl}/api/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skillPath,
          yamlContent,
          localSkillMd,
          persist: false,
        }),
      });

      if (!response.ok) {
        console.error(`    FAIL: Worker returned ${response.status}`);
        hasErrors = true;
        continue;
      }

      const result = (await response.json()) as ValidationResult;

      if (result.success) {
        console.log(`    PASS`);
        if (result.warnings) {
          for (const w of result.warnings) {
            console.log(`    WARN: ${w}`);
          }
        }
      } else {
        console.error(`    FAIL: ${result.error}`);
        hasErrors = true;
      }
    } catch (error) {
      console.error(`    FAIL: ${error instanceof Error ? error.message : 'Unknown error'}`);
      hasErrors = true;
    }
  }

  console.log(
    `\nDone: ${skillFiles.length} checked, ${hasErrors ? 'ERRORS FOUND' : 'all passed'}`,
  );

  if (hasErrors) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
