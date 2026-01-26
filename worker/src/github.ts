import type { Env } from './types';

interface FetchParams {
  org: string;
  repo: string;
  path: string;
  ref: string;
}

/**
 * Fetch SKILL.md content from GitHub
 */
export async function fetchSkillMd(params: FetchParams, env: Env): Promise<string> {
  const { org, repo, path, ref } = params;
  
  const url = `https://api.github.com/repos/${org}/${repo}/contents/${path}?ref=${ref}`;
  
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/vnd.github.v3.raw',
      'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
      'User-Agent': 'OpenAgentSkills-Worker',
    },
  });
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`SKILL.md not found: ${org}/${repo}/${path}`);
    }
    throw new Error(`GitHub API error: ${response.status} - ${await response.text()}`);
  }
  
  return response.text();
}

/**
 * Fetch the last commit date for a path in a repo
 */
export async function fetchLastCommit(params: FetchParams, env: Env): Promise<string | null> {
  const { org, repo, path, ref } = params;
  
  const url = `https://api.github.com/repos/${org}/${repo}/commits?path=${path}&per_page=1&sha=${ref}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
      'User-Agent': 'OpenAgentSkills-Worker',
    },
  });
  
  if (!response.ok) {
    return null;
  }
  
  const commits = await response.json() as Array<{
    commit?: {
      committer?: {
        date?: string;
      };
    };
  }>;
  
  return commits[0]?.commit?.committer?.date || null;
}

/**
 * Check if a repository exists and is accessible
 */
export async function checkRepoExists(org: string, repo: string, env: Env): Promise<boolean> {
  const url = `https://api.github.com/repos/${org}/${repo}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
      'User-Agent': 'OpenAgentSkills-Worker',
    },
  });
  
  return response.ok;
}
