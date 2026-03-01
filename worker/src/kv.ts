/**
 * Cloudflare KV utilities for the skill registry.
 *
 * KV key layout:
 *   skill:{path}           → SkillEntry   (one per skill, e.g. "skill:anthropics/skills/pdf")
 *   registry:manifest      → RegistryManifest  (pre-built full list for GET /api/skills)
 *   registry:categories    → CategoryEntry[]    (category definitions with counts)
 *
 * The manifest is rebuilt after every validation run so GET /api/skills is a
 * single KV read. Individual skill keys exist so GET /api/skills/:path can
 * serve a single entry without deserialising the entire manifest.
 */

import type { SkillEntry, RegistryManifest, CategoryEntry } from './types';

const SKILL_PREFIX = 'skill:';
const MANIFEST_KEY = 'registry:manifest';
const CATEGORIES_KEY = 'registry:categories';
const MANIFEST_VERSION = '2.0.0';

/** Write a single skill entry to KV. */
export async function writeSkill(
  kv: KVNamespace,
  skillPath: string,
  entry: SkillEntry,
): Promise<void> {
  await kv.put(`${SKILL_PREFIX}${skillPath}`, JSON.stringify(entry));
}

/** Read a single skill entry from KV. Returns null if not found. */
export async function readSkill(
  kv: KVNamespace,
  skillPath: string,
): Promise<SkillEntry | null> {
  const raw = await kv.get(`${SKILL_PREFIX}${skillPath}`);
  return raw ? (JSON.parse(raw) as SkillEntry) : null;
}

/** Delete a skill entry from KV. */
export async function deleteSkill(
  kv: KVNamespace,
  skillPath: string,
): Promise<void> {
  await kv.delete(`${SKILL_PREFIX}${skillPath}`);
}

/**
 * List all skill entries from KV.
 * Uses the KV list API with prefix scanning. KV list returns keys in
 * pages of up to 1 000, so we paginate until done.
 */
export async function listAllSkills(
  kv: KVNamespace,
): Promise<SkillEntry[]> {
  const entries: SkillEntry[] = [];
  let cursor: string | undefined;

  do {
    const list = await kv.list<undefined>({
      prefix: SKILL_PREFIX,
      cursor,
    });

    for (const key of list.keys) {
      const raw = await kv.get(key.name);
      if (raw) {
        entries.push(JSON.parse(raw) as SkillEntry);
      }
    }

    cursor = list.list_complete ? undefined : list.cursor;
  } while (cursor);

  return entries;
}

/** Write the categories array to KV. */
export async function writeCategories(
  kv: KVNamespace,
  categories: CategoryEntry[],
): Promise<void> {
  await kv.put(CATEGORIES_KEY, JSON.stringify(categories));
}

/** Read categories from KV. Returns empty array if not found. */
export async function readCategories(
  kv: KVNamespace,
): Promise<CategoryEntry[]> {
  const raw = await kv.get(CATEGORIES_KEY);
  return raw ? (JSON.parse(raw) as CategoryEntry[]) : [];
}

/** Write the pre-built manifest to KV. */
export async function writeManifest(
  kv: KVNamespace,
  manifest: RegistryManifest,
): Promise<void> {
  await kv.put(MANIFEST_KEY, JSON.stringify(manifest));
}

/** Read the pre-built manifest from KV. Returns null if not found. */
export async function readManifest(
  kv: KVNamespace,
): Promise<RegistryManifest | null> {
  const raw = await kv.get(MANIFEST_KEY);
  return raw ? (JSON.parse(raw) as RegistryManifest) : null;
}

/**
 * Rebuild the manifest from all individual skill entries + categories.
 * Called after validation completes to ensure GET /api/skills is up to date.
 */
export async function rebuildManifest(
  kv: KVNamespace,
): Promise<RegistryManifest> {
  const skills = await listAllSkills(kv);
  const storedCategories = await readCategories(kv);

  // Count skills per category
  const categoryCounts = new Map<string, number>();
  for (const skill of skills) {
    for (const cat of skill.categories) {
      categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
    }
  }

  // Merge counts into category definitions
  const categories: CategoryEntry[] = storedCategories
    .map((cat) => ({
      ...cat,
      count: categoryCounts.get(cat.id) || 0,
    }))
    .filter((cat) => cat.count > 0)
    .sort((a, b) => b.count - a.count);

  skills.sort((a, b) => a.name.localeCompare(b.name));

  const manifest: RegistryManifest = {
    version: MANIFEST_VERSION,
    generatedAt: new Date().toISOString(),
    totalSkills: skills.length,
    categories,
    skills,
  };

  await writeManifest(kv, manifest);
  return manifest;
}
