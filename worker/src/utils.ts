/**
 * Shared utility functions for the registry worker.
 *
 * - computeHash: content-addressable hashing for change detection
 * - parseSkillPath: extracts org/repo/skillName from the registry path convention
 * - delay: simple rate-limit helper for GitHub API calls
 */

/** Compute a hex-encoded SHA-256 hash using the Web Crypto API. */
export async function computeHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Parse skill path into components
 * 
 * Examples:
 * - "anthropics/skills/pdf" -> { org: "anthropics", repo: "skills", skillName: "pdf" }
 * - "vercel-labs/agent-skills/react-best-practices" -> { org: "vercel-labs", repo: "agent-skills", skillName: "react-best-practices" }
 * - "openagentskills/frontend-design" -> { org: "openagentskills", repo: null, skillName: "frontend-design" }
 */
export function parseSkillPath(skillPath: string): {
  org: string;
  repo: string | null;
  skillName: string;
  isInternal: boolean;
} {
  const parts = skillPath.split('/');
  
  if (parts.length < 2) {
    throw new Error(`Invalid skill path: ${skillPath}`);
  }

  const org = parts[0];
  
  // Internal skills: openagentskills/{skill-name}
  if (org === 'openagentskills') {
    return {
      org,
      repo: null,
      skillName: parts.slice(1).join('/'),
      isInternal: true,
    };
  }
  
  // External skills: {org}/{repo}/{skill-name}
  if (parts.length < 3) {
    throw new Error(`External skill path must be {org}/{repo}/{skill-name}: ${skillPath}`);
  }
  
  return {
    org,
    repo: parts[1],
    skillName: parts.slice(2).join('/'),
    isInternal: false,
  };
}

/**
 * Delay execution for rate limiting
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
