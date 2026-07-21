import path from 'path';

export type ToolClass = 'safe' | 'write' | 'dangerous';

export interface ClassificationResult {
  classification: ToolClass;
  reason?: string;
}

export const KNOWN_TOOLS = new Set([
  'read_file', 'write_file', 'edit_file', 'bash', 'grep', 'glob',
  'search_memory', 'recall_memory', 'record_memory', 'get_memory_node',
  'start_process', 'check_process', 'wait_process', 'ask_user',
]);

const SAFE_BASH_PREFIXES = [
  'ls', 'dir', 'cat', 'head', 'tail', 'echo',
  'pwd', 'node -v', 'node --version',
  'npm --version', 'npm -v', 'npm ls', 'npm list',
  'npx --version', 'npx -v',
  'git status', 'git log', 'git diff', 'git branch', 'git remote',
  'git show', 'git stash list',
  'which', 'where', 'type',
  'wc', 'sort', 'uniq', 'grep',
  'find', 'stat', 'file',
  'env', 'printenv', 'set',
  'ping', 'curl --head', 'curl -I',
];

const DANGEROUS_BASH_PATTERNS: RegExp[] = [
  /\brm\s+-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*/,
  /\brm\s+-[a-zA-Z]*f[a-zA-Z]*r[a-zA-Z]*/,
  /\brm\s+(-\w+\s+)*-\w*r\w*\s+(-\w+\s+)*-\w*f\w*/,
  /\brm\s+(-\w+\s+)*-\w*f\w*\s+(-\w+\s+)*-\w*r\w*/,
  /\brm\s+--recursive\b/,
  /\bDROP\b/i,
  /\bTRUNCATE\b/i,
  /\bDELETE\s+FROM\b/i,
  /git\s+push\s+.*--force/,
  /git\s+push\s+.*-f\b/,
  /(curl|wget).*\|\s*(sh|bash|zsh|fish)/,
  /\bformat\s+(c:|d:|e:|\/.)/i,
  /\bdd\s+if=/,
  /\bchmod\s+-R\s+777\b/,
  /\bsudo\s+rm\b/,
  /\bpoweroff\b|\breboot\b|\bshutdown\b/,
  />\s*\/dev\/sd[a-z]\b/,
];

function isBashCommandSafe(command: string): boolean {
  const trimmed = command.trim().toLowerCase();
  return SAFE_BASH_PREFIXES.some((prefix) =>
    trimmed === prefix || trimmed.startsWith(prefix + ' ') || trimmed.startsWith(prefix + '\t')
  );
}

function isBashCommandDangerous(command: string): { dangerous: boolean; pattern?: RegExp } {
  for (const pattern of DANGEROUS_BASH_PATTERNS) {
    if (pattern.test(command)) return { dangerous: true, pattern };
  }
  return { dangerous: false };
}

export function classifyToolCall(name: string, input: any, projectRoot: string = process.cwd()): ClassificationResult {
  if (!KNOWN_TOOLS.has(name)) {
    return { classification: 'dangerous', reason: `Unknown tool "${name}" — not in the registered tool list. Execution blocked.` };
  }

  const resolvedRoot = path.resolve(projectRoot);
  if (input && typeof input === 'object') {
    for (const [key, value] of Object.entries(input)) {
      if (typeof value === 'string' && (key === 'path' || key === 'filePath' || key === 'dir')) {
        const resolvedPath = path.resolve(resolvedRoot, value);
        if (!resolvedPath.startsWith(resolvedRoot)) {
          return { classification: 'dangerous', reason: `Path "${value}" resolves outside the project root: "${resolvedRoot}"` };
        }
      }
    }
  }

  if (name === 'bash' || name === 'start_process') {
    const command: string = input?.command || '';
    const dangerCheck = isBashCommandDangerous(command);
    if (dangerCheck.dangerous) {
      return { classification: 'dangerous', reason: `Command matches dangerous pattern: ${dangerCheck.pattern?.toString()}` };
    }
    if (isBashCommandSafe(command)) return { classification: 'safe' };
    return { classification: 'write', reason: `Bash command "${command.substring(0, 60)}" will execute without prompting and be logged.` };
  }

  if (name === 'check_process' || name === 'wait_process') return { classification: 'safe' };
  if (name === 'write_file' || name === 'edit_file' || name === 'record_memory') return { classification: 'write' };
  if (['read_file', 'grep', 'glob', 'search_memory', 'recall_memory', 'get_memory_node', 'ask_user'].includes(name)) return { classification: 'safe' };

  return { classification: 'dangerous', reason: `Unclassified tool "${name}" — requires manual approval.` };
}
