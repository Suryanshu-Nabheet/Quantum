// FILE: productVoice.ts
// Purpose: Canonical Quantum Agent Manager branding, copy, and outbound links.
// Layer: Web product constants

export const QUANTUM_APP_NAME = "Quantum Agent Manager";

export const QUANTUM_TAGLINE = "parallel agents, one workspace.";

export const QUANTUM_POSITIONING = `${QUANTUM_APP_NAME} — ${QUANTUM_TAGLINE}`;

export const QUANTUM_META_DESCRIPTION =
  "Quantum Agent Manager — parallel agents, one workspace. Orchestrate Codex, Claude, Cursor, and more with Spaces, Activity, worktrees, and MCP.";

export const QUANTUM_GITHUB_REPO = "https://github.com/Suryanshu-Nabheet/Quantum";

export const QUANTUM_DOCS_URL = `${QUANTUM_GITHUB_REPO}/blob/main/agent/README.md`;

export const QUANTUM_ISSUES_URL = `${QUANTUM_GITHUB_REPO}/issues/new`;

/** User-facing label for envMode `local` (repo checkout, not a worktree). */
export const QUANTUM_CHECKOUT_SHORT_LABEL = "Checkout";

export const QUANTUM_CHECKOUT_OPTION_LABEL = "Project checkout";

export const QUANTUM_WORKTREE_SHORT_LABEL = "Worktree";

export const QUANTUM_WORKTREE_PENDING_LABEL = "Worktree pending";

export const QUANTUM_COMPOSER_WORKSPACE_MENTION = "@workspace";

export const QUANTUM_WORKSPACE_MENTION_NAME = "workspace";

export const QUANTUM_HANDOFF_TO_CHECKOUT_LABEL = "Hand off to checkout";

export const QUANTUM_DEV_SERVERS_LABEL = "Dev servers";

export const QUANTUM_SURFACE_THREADS = {
  title: "Quantum",
  description: "Parallel agents across your repos",
} as const;

export const QUANTUM_SURFACE_STUDIO = {
  title: "Studio",
  description: "Open-ended agent work",
} as const;

export const QUANTUM_EMPTY_HOME_HEADING = "What should we work on?";

export const QUANTUM_EMPTY_PROJECT_HEADING_PREFIX = "What should we do in";

export const QUANTUM_EMPTY_HERO_TITLE = "Let's build";

export const QUANTUM_NO_PROJECTS_YET = "No projects yet";

export const QUANTUM_VOID_EMPTY_TITLE = "Void is empty";

export const QUANTUM_VOID_EMPTY_HINT = "New and unassigned projects appear here.";

export function quantumSpaceEmptyTitle(spaceName: string): string {
  return `${spaceName} is empty`;
}

export const QUANTUM_SPACE_EMPTY_HINT =
  "Move projects here, or right-click a project to file it.";

export const QUANTUM_ACTIVITY_ONBOARDING = {
  title: "Activity",
  description:
    "See running tasks, completed work, and anything that needs your attention.",
} as const;
