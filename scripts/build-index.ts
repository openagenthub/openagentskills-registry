/**
 * Build Index Script
 * 
 * Generates dist/index.json from all skill.yaml files in the skills/ directory.
 * This creates the full registry manifest that the website consumes.
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';
import matter from 'gray-matter';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const SKILLS_DIR = join(ROOT_DIR, 'skills');
const INTERNAL_SKILLS_DIR = join(ROOT_DIR, 'openagentskills');
const DIST_DIR = join(ROOT_DIR, 'dist');
const CATEGORIES_FILE = join(ROOT_DIR, 'categories.yaml');

// Registry repo URL for internal skills
const REGISTRY_REPO_URL = 'https://github.com/openagenthub/openagentskills-registry';

interface SkillYaml {
  source: {
    type: 'external' | 'local';
    path?: string;
    ref?: string;
  };
  categories: string[];
  tags: string[];
  _meta?: {
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
}

interface IndexSkill {
  id: string;
  path: string;
  name: string;
  description: string;
  categories: string[];
  tags: string[];
  source: {
    type: 'external' | 'local';
    org?: string;
    repo?: string;
    path?: string;
    ref?: string;
  };
  license: string | null;
  repoUrl: string | null;
  lastCommit: string | null;
  lastValidated: string | null;
  status: 'active' | 'deprecated' | 'broken';
}

interface Category {
  id: string;
  name: string;
  description: string;
  icon?: string;
  count: number;
}

interface RegistryIndex {
  version: string;
  generatedAt: string;
  totalSkills: number;
  categories: Category[];
  skills: IndexSkill[];
}

/**
 * Recursively find all skill.yaml files
 */
function findSkillYamls(dir: string, basePath = ''): string[] {
  const files: string[] = [];
  
  if (!existsSync(dir)) {
    return files;
  }
  
  const entries = readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;
    
    if (entry.isDirectory()) {
      files.push(...findSkillYamls(fullPath, relativePath));
    } else if (entry.name === 'skill.yaml') {
      files.push(fullPath);
    }
  }
  
  return files;
}

/**
 * Parse skill path from file path
 * 
 * skills/anthropics/skills/pdf/skill.yaml -> anthropics/skills/pdf
 * skills/openagentskills/frontend-design/skill.yaml -> openagentskills/frontend-design
 */
function parseSkillPath(filePath: string): string {
  const relativePath = filePath.replace(SKILLS_DIR + '/', '');
  return relativePath.replace('/skill.yaml', '');
}

/**
 * Load and parse categories.yaml
 */
function loadCategories(): Map<string, { name: string; description: string; icon?: string }> {
  const content = readFileSync(CATEGORIES_FILE, 'utf-8');
  const data = parseYaml(content) as { categories: Array<{ id: string; name: string; description: string; icon?: string }> };
  
  const map = new Map();
  for (const cat of data.categories) {
    map.set(cat.id, { name: cat.name, description: cat.description, icon: cat.icon });
  }
  return map;
}

/**
 * Parse SKILL.md frontmatter for local skills
 * Returns name, description, license, compatibility from frontmatter
 */
interface SkillFrontmatter {
  name: string;
  description: string;
  license?: string;
  compatibility?: string;
  version?: string;
}

function parseSkillMd(skillName: string): SkillFrontmatter | null {
  const skillMdPath = join(INTERNAL_SKILLS_DIR, skillName, 'SKILL.md');
  
  if (!existsSync(skillMdPath)) {
    console.warn(`  ⚠ SKILL.md not found: ${skillMdPath}`);
    return null;
  }
  
  try {
    const content = readFileSync(skillMdPath, 'utf-8');
    const { data } = matter(content);
    
    if (!data.name || !data.description) {
      console.warn(`  ⚠ SKILL.md missing required frontmatter (name/description)`);
      return null;
    }
    
    return {
      name: String(data.name),
      description: String(data.description),
      license: data.license ? String(data.license) : undefined,
      compatibility: data.compatibility ? String(data.compatibility) : undefined,
      version: data.version ? String(data.version) : undefined,
    };
  } catch (error) {
    console.warn(`  ⚠ Error parsing SKILL.md: ${error instanceof Error ? error.message : 'Unknown'}`);
    return null;
  }
}

/**
 * Main build function
 */
async function buildIndex(): Promise<void> {
  console.log('Building registry index...\n');
  
  // Load categories
  const categoriesMap = loadCategories();
  
  // Find all skill.yaml files
  const skillFiles = findSkillYamls(SKILLS_DIR);
  console.log(`Found ${skillFiles.length} skill(s)\n`);
  
  const skills: IndexSkill[] = [];
  const categoryCounts = new Map<string, number>();
  
  for (const filePath of skillFiles) {
    const skillPath = parseSkillPath(filePath);
    console.log(`Processing: ${skillPath}`);
    
    try {
      const content = readFileSync(filePath, 'utf-8');
      const yaml = parseYaml(content) as SkillYaml;
      
      // Parse skill path components
      const parts = skillPath.split('/');
      const org = parts[0];
      const isInternal = org === 'openagentskills';
      const skillName = parts.slice(1).join('/'); // e.g., "frontend-design" or deeper paths
      
      // For internal skills, read SKILL.md frontmatter to get name/description
      let frontmatter: SkillFrontmatter | null = null;
      if (isInternal) {
        frontmatter = parseSkillMd(skillName);
      }
      
      // Build index entry
      const skill: IndexSkill = {
        id: skillPath,
        path: skillPath,
        name: yaml._meta?.name || frontmatter?.name || parts[parts.length - 1],
        description: yaml._meta?.description || frontmatter?.description || '',
        categories: yaml.categories,
        tags: yaml.tags,
        source: isInternal 
          ? { type: 'local' }
          : {
              type: 'external',
              org,
              repo: parts[1],
              path: yaml.source.path,
              ref: yaml.source.ref || 'main',
            },
        license: yaml._meta?.license || frontmatter?.license || null,
        repoUrl: isInternal ? REGISTRY_REPO_URL : (yaml._meta?.repoUrl || null),
        lastCommit: yaml._meta?.lastCommit || null,
        lastValidated: yaml._meta?.lastValidated || null,
        status: yaml._meta?.status || 'active',
      };
      
      skills.push(skill);
      
      // Count categories
      for (const cat of yaml.categories) {
        categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
      }
      
      console.log(`  ✓ ${skill.name}`);
    } catch (error) {
      console.error(`  ✗ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  // Build categories with counts
  const categories: Category[] = [];
  for (const [id, count] of categoryCounts) {
    const catInfo = categoriesMap.get(id);
    if (catInfo) {
      categories.push({
        id,
        name: catInfo.name,
        description: catInfo.description,
        icon: catInfo.icon,
        count,
      });
    }
  }
  
  // Sort categories by count (descending)
  categories.sort((a, b) => b.count - a.count);
  
  // Sort skills by name
  skills.sort((a, b) => a.name.localeCompare(b.name));
  
  // Build final index
  const index: RegistryIndex = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    totalSkills: skills.length,
    categories,
    skills,
  };
  
  // Write index.json
  const indexPath = join(DIST_DIR, 'index.json');
  writeFileSync(indexPath, JSON.stringify(index, null, 2));
  console.log(`\n✓ Written: ${indexPath}`);
  
  // Write stats.json
  const stats = {
    totalSkills: skills.length,
    totalCategories: categories.length,
    byCategory: Object.fromEntries(categoryCounts),
    byStatus: {
      active: skills.filter(s => s.status === 'active').length,
      deprecated: skills.filter(s => s.status === 'deprecated').length,
      broken: skills.filter(s => s.status === 'broken').length,
    },
    lastUpdated: new Date().toISOString(),
  };
  
  const statsPath = join(DIST_DIR, 'stats.json');
  writeFileSync(statsPath, JSON.stringify(stats, null, 2));
  console.log(`✓ Written: ${statsPath}`);
  
  console.log(`\n📊 Registry Stats:`);
  console.log(`   Skills: ${skills.length}`);
  console.log(`   Categories: ${categories.length}`);
}

// Run
buildIndex().catch(console.error);
