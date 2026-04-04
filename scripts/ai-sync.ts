/**
 * Agent configuration for syncing .agents/ contents to agent-specific folders.
 * Each agent has different folder structures and file formats for commands and skills.
 *
 * Run with: pnpm ai-sync [agent-key]
 */

import fs from 'fs';
import path from 'path';

interface AgentConfig {
  /** Name of the agent */
  name: string;
  /** Folder name for this agent (e.g., .windsurf, .cursor) */
  folder: string;
  /** Where slash commands/workflows should be copied to (relative to agent folder) */
  commandsPath: string;
  /** Where skills should be copied to (relative to agent folder) */
  skillsPath: string;
  /** File extension/format for commands (e.g., .md) */
  commandsFormat: string;
  /** Whether commands need YAML frontmatter */
  requiresFrontmatter: boolean;
  /** Additional notes about this agent's configuration */
  notes?: string;
}

const AGENT_CONFIGS: Record<string, AgentConfig> = {
  windsurf: {
    name: 'Windsurf',
    folder: '.windsurf',
    commandsPath: 'workflows',
    skillsPath: 'skills',
    commandsFormat: '.md',
    requiresFrontmatter: true,
    notes:
      'Workflows are markdown files with YAML frontmatter (description field). Invoked via /workflow-name',
  },
  cursor: {
    name: 'Cursor',
    folder: '.cursor',
    commandsPath: 'commands',
    skillsPath: 'skills',
    commandsFormat: '.md',
    requiresFrontmatter: false,
    notes:
      'Commands are markdown files, no frontmatter required. Also supports ~/.cursor/commands for global commands',
  },
  claude: {
    name: 'Claude Code',
    folder: '.claude',
    commandsPath: 'commands',
    skillsPath: 'skills',
    commandsFormat: '.md',
    requiresFrontmatter: true,
    notes:
      'Skills are directories with SKILL.md file containing frontmatter (name, description). Also supports ~/.claude/skills/ globally',
  },
  codex: {
    name: 'Codex (OpenAI)',
    folder: '.codex',
    commandsPath: 'commands',
    skillsPath: 'skills',
    commandsFormat: '.md',
    requiresFrontmatter: true,
    notes:
      'Skills loaded from .agents/skills/ scanning up to repo root, or ~/.agents/skills/ globally. Uses SKILL.md with frontmatter',
  },
  kilo: {
    name: 'Kilo Code',
    folder: '.kilo',
    commandsPath: 'commands',
    skillsPath: 'skills',
    commandsFormat: '.md',
    requiresFrontmatter: true,
    notes:
      'Also compatible with .claude/skills/ and .agents/skills/ for interoperability',
  },
  antigravity: {
    name: 'Antigravity (Google)',
    folder: '.agent',
    commandsPath: 'commands',
    skillsPath: 'skills',
    commandsFormat: '.md',
    requiresFrontmatter: true,
    notes:
      'Uses .agent/skills/ (workspace) or ~/.gemini/antigravity/skills/ (global). Skills are directory-based with SKILL.md',
  },
  copilot: {
    name: 'GitHub Copilot',
    folder: '.github',
    commandsPath: 'commands',
    skillsPath: 'skills',
    commandsFormat: '.md',
    requiresFrontmatter: true,
    notes:
      'Supports .github/skills/, .claude/skills/, or .agents/skills/. Global: ~/.copilot/skills/, ~/.claude/skills/, or ~/.agents/skills/',
  },
};

// The source of truth paths
const SOURCE_PATHS = {
  commands: '.agents/commands',
  skills: '.agents/skills',
} as const;

/**
 * Ensure a directory exists, creating it if necessary
 */
function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Copy a file from source to destination
 */
function copyFile(src: string, dest: string): void {
  fs.copyFileSync(src, dest);
}

/**
 * Recursively copy a directory
 */
function copyDir(src: string, dest: string): void {
  ensureDir(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFile(srcPath, destPath);
    }
  }
}

/**
 * Sync commands for a specific agent
 */
function syncCommands(config: AgentConfig): void {
  const sourceDir = path.resolve(SOURCE_PATHS.commands);
  const destDir = path.resolve(path.join(config.folder, config.commandsPath));

  if (!fs.existsSync(sourceDir)) {
    console.log(`  No commands directory found at ${SOURCE_PATHS.commands}`);
    return;
  }

  ensureDir(destDir);

  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(sourceDir, entry.name);

    if (entry.isDirectory()) {
      // Skip directories in commands
      continue;
    }

    // Only copy files with matching format
    if (!entry.name.endsWith(config.commandsFormat)) {
      continue;
    }

    const destPath = path.join(destDir, entry.name);
    copyFile(srcPath, destPath);
    console.log(`  Copied command: ${entry.name}`);
  }
}

/**
 * Sync skills for a specific agent
 */
function syncSkills(config: AgentConfig): void {
  const sourceDir = path.resolve(SOURCE_PATHS.skills);
  const destDir = path.resolve(path.join(config.folder, config.skillsPath));

  if (!fs.existsSync(sourceDir)) {
    console.log(`  No skills directory found at ${SOURCE_PATHS.skills}`);
    return;
  }

  ensureDir(destDir);

  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(sourceDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      // Skills are directory-based
      copyDir(srcPath, destPath);
      console.log(`  Copied skill: ${entry.name}/`);
    } else if (entry.name === 'SKILL.md') {
      // Top-level SKILL.md file
      copyFile(srcPath, destPath);
      console.log(`  Copied skill file: ${entry.name}`);
    }
  }
}

/**
 * Sync files for a specific agent
 */
function syncAgent(agentKey: string): void {
  const config = AGENT_CONFIGS[agentKey];
  if (!config) {
    throw new Error(`Unknown agent: ${agentKey}`);
  }

  console.log(`\nSyncing for ${config.name} (${agentKey})...`);
  console.log(`  Target folder: ${config.folder}/`);

  syncCommands(config);
  syncSkills(config);

  console.log(`  Done!`);
}

/**
 * Main function
 */
function main(): void {
  const args = process.argv.slice(2);
  const agentArg = args[0];

  if (agentArg) {
    // Single agent mode
    if (!AGENT_CONFIGS[agentArg]) {
      console.error(`Error: Agent "${agentArg}" is not supported.`);
      console.error(`You're welcome to extend scripts/ai-sync.ts for it.`);
      console.error(
        `\nSupported agents: ${Object.keys(AGENT_CONFIGS).join(', ')}`,
      );
      process.exit(1);
    }

    syncAgent(agentArg);
  } else {
    // All agents mode
    console.log('Syncing for all supported agents...');

    for (const agentKey of Object.keys(AGENT_CONFIGS)) {
      syncAgent(agentKey);
    }

    console.log('\nAll done!');
  }
}

main();
