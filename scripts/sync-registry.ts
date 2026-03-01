/**
 * Sync Registry
 *
 * The main orchestration script that keeps Cloudflare KV in sync with the
 * skill.yaml files in this repository. Replaces the old build-index.ts
 * (which generated dist/index.json) and update-metadata.ts (which wrote
 * _meta back into YAML files).
 *
 * Two modes of operation:
 *
 * 1. Full sync (daily cron):
 *      npm run sync-registry
 *    Reads every skill.yaml, validates via the worker with persist=true,
 *    syncs categories, and rebuilds the manifest.
 *
 * 2. Changed-only sync (post-merge):
 *      npm run sync-registry -- --changed-only '["skills/anthropics/skills/pdf/skill.yaml"]'
 *    Only validates the changed files, then still rebuilds the full manifest
 *    so it stays consistent.
 *
 * Environment variables:
 *   WORKER_URL  - base URL of the deployed Cloudflare Worker
 *
 * Exit codes:
 *   0 - all skills valid
 *   1 - one or more skills broken (still persists results so status=broken is stored)
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const SKILLS_DIR = join(ROOT_DIR, 'skills');
const INTERNAL_SKILLS_DIR = join(ROOT_DIR, 'openagentskills');
const CATEGORIES_FILE = join(ROOT_DIR, 'categories.yaml');

interface Category {
  id: string;
  name: string;
  description: string;
  icon?: string;
}

interface SkillPayload {
  skillPath: string;
  yamlContent: string;
  localSkillMd: string | null;
}

interface BatchResult {
  success: boolean;
  totalProcessed: number;
  successCount: number;
  failedCount: number;
  results: Array<{
    success: boolean;
    skillPath: string;
    error?: string;
    warnings?: string[];
  }>;
}

/** Recursively find all skill.yaml files under a directory. */
function findSkillYamls(dir: string): string[] {
  const files: string[] = [];
  if (!existsSync(dir)) return files;

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findSkillYamls(full));
    } else if (entry.name === 'skill.yaml') {
      files.push(full);
    }
  }

  return files;
}

/**
 * Derive the registry skill path from a file path.
 * Works for both absolute paths and repo-relative paths.
 */
function toSkillPath(filePath: string): string {
  const rel = filePath.replace(SKILLS_DIR + '/', '').replace(/^skills\//, '');
  return rel.replace(/\/skill\.yaml$/, '');
}

/** Read SKILL.md for an internal skill, or return null. */
function readLocalSkillMd(skillPath: string): string | null {
  if (!skillPath.startsWith('openagentskills/')) return null;

  const skillName = skillPath.replace('openagentskills/', '');
  const mdPath = join(INTERNAL_SKILLS_DIR, skillName, 'SKILL.md');

  return existsSync(mdPath) ? readFileSync(mdPath, 'utf-8') : null;
}

/** Load and parse categories.yaml. */
function loadCategories(): Category[] {
  const raw = readFileSync(CATEGORIES_FILE, 'utf-8');
  const data = parseYaml(raw) as { categories: Category[] };
  return data.categories;
}

/** Build the list of skill payloads from file paths. */
function buildPayloads(filePaths: string[]): SkillPayload[] {
  return filePaths.map((fp) => {
    const fullPath = fp.startsWith('/') ? fp : join(ROOT_DIR, fp);
    const skillPath = toSkillPath(fullPath);
    const yamlContent = readFileSync(fullPath, 'utf-8');
    const localSkillMd = readLocalSkillMd(skillPath);
    return { skillPath, yamlContent, localSkillMd };
  });
}

/** Parse CLI args to determine mode. */
function parseArgs(): { changedOnly: boolean; files: string[] } {
  const args = process.argv.slice(2);
  const idx = args.indexOf('--changed-only');

  if (idx === -1) {
    return { changedOnly: false, files: [] };
  }

  const filesArg = args[idx + 1];
  if (!filesArg) {
    return { changedOnly: true, files: [] };
  }

  let files: string[];
  try {
    files = JSON.parse(filesArg);
  } catch {
    files = filesArg.split(',').map((f) => f.trim());
  }

  return {
    changedOnly: true,
    files: files.filter((f) => f.endsWith('skill.yaml')),
  };
}

async function main(): Promise<void> {
  const workerUrl = process.env.WORKER_URL;
  if (!workerUrl) {
    console.error('WORKER_URL environment variable is required');
    process.exit(1);
  }

  const { changedOnly, files } = parseArgs();

  // 1. Determine which skills to validate
  let skillFiles: string[];
  if (changedOnly && files.length > 0) {
    skillFiles = files;
    console.log(`Syncing ${skillFiles.length} changed skill(s)...\n`);
  } else {
    skillFiles = findSkillYamls(SKILLS_DIR);
    console.log(`Full sync: ${skillFiles.length} skill(s) found\n`);
  }

  const payloads = buildPayloads(skillFiles);

  // 2. Validate and persist via the worker batch endpoint
  console.log('Calling worker batch validation (persist=true)...');

  const batchResponse = await fetch(`${workerUrl}/api/validate-batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      skills: payloads.map(({ skillPath, yamlContent, localSkillMd }) => ({
        skillPath,
        yamlContent,
        localSkillMd,
      })),
      persist: true,
    }),
  });

  if (!batchResponse.ok) {
    console.error(`Worker error: ${batchResponse.status} - ${await batchResponse.text()}`);
    process.exit(1);
  }

  const batchResult = (await batchResponse.json()) as BatchResult;

  // 3. Report results
  let brokenCount = 0;
  for (const r of batchResult.results) {
    if (r.success) {
      console.log(`  PASS: ${r.skillPath}`);
      if (r.warnings) {
        for (const w of r.warnings) console.log(`    WARN: ${w}`);
      }
    } else {
      console.error(`  FAIL: ${r.skillPath} -- ${r.error}`);
      brokenCount++;
    }
  }

  // 4. Sync categories
  console.log('\nSyncing categories...');
  const categories = loadCategories();

  const catResponse = await fetch(`${workerUrl}/api/categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ categories }),
  });

  if (!catResponse.ok) {
    console.error(`Categories sync failed: ${catResponse.status}`);
  } else {
    console.log(`  ${categories.length} categories synced`);
  }

  // 5. Rebuild manifest (ensures it reflects both skill data and categories)
  console.log('\nRebuilding manifest...');

  const manifestResponse = await fetch(`${workerUrl}/api/rebuild-manifest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!manifestResponse.ok) {
    console.error(`Manifest rebuild failed: ${manifestResponse.status}`);
  } else {
    const manifestResult = (await manifestResponse.json()) as {
      success: boolean;
      totalSkills: number;
      categories: number;
    };
    console.log(`  Manifest rebuilt: ${manifestResult.totalSkills} skills, ${manifestResult.categories} categories`);
  }

  // 6. Summary
  console.log(`\n--- Summary ---`);
  console.log(`  Total:  ${batchResult.totalProcessed}`);
  console.log(`  Passed: ${batchResult.successCount}`);
  console.log(`  Failed: ${brokenCount}`);

  if (brokenCount > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
