import { describe, it, expect, beforeEach } from 'vitest';
import {
  writeSkill,
  readSkill,
  deleteSkill,
  listAllSkills,
  writeCategories,
  readCategories,
  writeManifest,
  readManifest,
  rebuildManifest,
} from '../kv';
import type { SkillEntry, CategoryEntry, RegistryManifest } from '../types';

/**
 * In-memory mock of the Cloudflare KVNamespace interface.
 * Provides get/put/delete/list for testing without a real KV store.
 */
function createMockKV(): KVNamespace {
  const store = new Map<string, string>();

  return {
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => { store.set(key, value); },
    delete: async (key: string) => { store.delete(key); },
    list: async (opts?: { prefix?: string; cursor?: string }) => {
      const prefix = opts?.prefix ?? '';
      const keys = [...store.keys()]
        .filter((k) => k.startsWith(prefix))
        .map((name) => ({ name, expiration: undefined, metadata: undefined }));
      return { keys, list_complete: true, cursor: '' };
    },
    getWithMetadata: async () => ({ value: null, metadata: null, cacheStatus: null }),
  } as unknown as KVNamespace;
}

const sampleEntry = (id: string, categories: string[] = ['development']): SkillEntry => ({
  id,
  path: id,
  name: id.split('/').pop()!,
  description: `Description for ${id}`,
  categories,
  tags: ['test'],
  source: { type: 'internal' },
  license: 'MIT',
  repoUrl: 'https://github.com/test/repo',
  lastCommit: null,
  lastValidated: '2026-01-01T00:00:00Z',
  contentHash: 'sha256:abc123',
  status: 'active',
});

describe('KV skill operations', () => {
  let kv: KVNamespace;

  beforeEach(() => {
    kv = createMockKV();
  });

  it('writes and reads a skill entry', async () => {
    const entry = sampleEntry('openagentskills/api-design');
    await writeSkill(kv, 'openagentskills/api-design', entry);

    const read = await readSkill(kv, 'openagentskills/api-design');
    expect(read).toEqual(entry);
  });

  it('returns null for non-existent skill', async () => {
    const read = await readSkill(kv, 'does/not/exist');
    expect(read).toBeNull();
  });

  it('deletes a skill entry', async () => {
    const entry = sampleEntry('openagentskills/to-delete');
    await writeSkill(kv, 'openagentskills/to-delete', entry);
    await deleteSkill(kv, 'openagentskills/to-delete');

    const read = await readSkill(kv, 'openagentskills/to-delete');
    expect(read).toBeNull();
  });

  it('lists all skill entries', async () => {
    await writeSkill(kv, 'a/b/c', sampleEntry('a/b/c'));
    await writeSkill(kv, 'x/y/z', sampleEntry('x/y/z'));

    const all = await listAllSkills(kv);
    expect(all).toHaveLength(2);
    expect(all.map((s) => s.id).sort()).toEqual(['a/b/c', 'x/y/z']);
  });
});

describe('KV categories', () => {
  let kv: KVNamespace;

  beforeEach(() => {
    kv = createMockKV();
  });

  it('writes and reads categories', async () => {
    const cats: CategoryEntry[] = [
      { id: 'development', name: 'Development', description: 'Dev stuff', count: 0 },
    ];
    await writeCategories(kv, cats);

    const read = await readCategories(kv);
    expect(read).toEqual(cats);
  });

  it('returns empty array when no categories exist', async () => {
    const read = await readCategories(kv);
    expect(read).toEqual([]);
  });
});

describe('KV manifest', () => {
  let kv: KVNamespace;

  beforeEach(() => {
    kv = createMockKV();
  });

  it('returns null when no manifest exists', async () => {
    const read = await readManifest(kv);
    expect(read).toBeNull();
  });

  it('writes and reads a manifest', async () => {
    const manifest: RegistryManifest = {
      version: '2.0.0',
      generatedAt: '2026-01-01T00:00:00Z',
      totalSkills: 1,
      categories: [],
      skills: [sampleEntry('test/skill/one')],
    };
    await writeManifest(kv, manifest);

    const read = await readManifest(kv);
    expect(read).toEqual(manifest);
  });
});

describe('rebuildManifest', () => {
  let kv: KVNamespace;

  beforeEach(() => {
    kv = createMockKV();
  });

  it('builds manifest from individual skill entries', async () => {
    await writeSkill(kv, 'a/b/skill-a', sampleEntry('a/b/skill-a', ['development']));
    await writeSkill(kv, 'x/y/skill-b', sampleEntry('x/y/skill-b', ['databases']));

    const cats: CategoryEntry[] = [
      { id: 'development', name: 'Development', description: 'Dev', count: 0 },
      { id: 'databases', name: 'Databases', description: 'DB', count: 0 },
    ];
    await writeCategories(kv, cats);

    const manifest = await rebuildManifest(kv);
    expect(manifest.totalSkills).toBe(2);
    expect(manifest.categories).toHaveLength(2);
    expect(manifest.version).toBe('2.0.0');

    const devCat = manifest.categories.find((c) => c.id === 'development');
    expect(devCat?.count).toBe(1);
  });

  it('excludes categories with zero skills', async () => {
    await writeSkill(kv, 'a/b/c', sampleEntry('a/b/c', ['development']));

    const cats: CategoryEntry[] = [
      { id: 'development', name: 'Development', description: 'Dev', count: 0 },
      { id: 'marketing', name: 'Marketing', description: 'Mkt', count: 0 },
    ];
    await writeCategories(kv, cats);

    const manifest = await rebuildManifest(kv);
    expect(manifest.categories).toHaveLength(1);
    expect(manifest.categories[0].id).toBe('development');
  });

  it('persists the manifest to KV', async () => {
    await writeSkill(kv, 'a/b/c', sampleEntry('a/b/c'));
    await writeCategories(kv, [{ id: 'development', name: 'Dev', description: 'D', count: 0 }]);

    await rebuildManifest(kv);

    const stored = await readManifest(kv);
    expect(stored).not.toBeNull();
    expect(stored!.totalSkills).toBe(1);
  });
});
