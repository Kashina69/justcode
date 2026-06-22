import path from 'path';
/**
 * Canonical list of all tool names that can be dispatched.
 * Both the safety classifier and the executor derive from this single source.
 * If a tool isn't listed here, classifyToolCall returns 'dangerous' and executeTool returns an error.
 */
export const KNOWN_TOOLS = new Set([
    'read_file',
    'write_file',
    'edit_file',
    'bash',
    'grep',
    'glob',
    'search_memory',
    'recall_memory',
    'record_memory',
    'get_memory_node',
    'start_process',
    'check_process',
    'wait_process',
]);
/**
 * Bash commands that are read-only and safe to run with zero confirmation prompt.
 * Grow this list conservatively — only commands with no filesystem mutation or
 * network egress beyond package resolution.
 */
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
/**
 * Bash commands that are known to be dangerous and always require explicit confirmation.
 */
const DANGEROUS_BASH_PATTERNS = [
    /\brm\s+-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*/, // rm -rf, rm -rvf, etc (r and f in same flag)
    /\brm\s+-[a-zA-Z]*f[a-zA-Z]*r[a-zA-Z]*/, // rm -fr variant
    /\brm\s+(-\w+\s+)*-\w*r\w*\s+(-\w+\s+)*-\w*f\w*/, // rm -r -f (split flags)
    /\brm\s+(-\w+\s+)*-\w*f\w*\s+(-\w+\s+)*-\w*r\w*/, // rm -f -r (split flags)
    /\brm\s+--recursive\b/,
    /\bDROP\b/i,
    /\bTRUNCATE\b/i,
    /\bDELETE\s+FROM\b/i,
    /git\s+push\s+.*--force/,
    /git\s+push\s+.*-f\b/,
    /(curl|wget).*\|\s*(sh|bash|zsh|fish)/, // pipe URL content into shell
    /\bformat\s+(c:|d:|e:|\/.)/i, // disk format
    /\bdd\s+if=/, // raw disk write
    /\bchmod\s+-R\s+777\b/, // recursive world-writable
    /\bsudo\s+rm\b/,
    /\bpoweroff\b|\breboot\b|\bshutdown\b/,
    />\s*\/dev\/sd[a-z]\b/, // overwrite raw block device
];
/**
 * Checks whether a bash command is in the conservative safe allowlist.
 */
function isBashCommandSafe(command) {
    const trimmed = command.trim().toLowerCase();
    return SAFE_BASH_PREFIXES.some((prefix) => {
        // Match exactly or as first word(s) of the command
        return trimmed === prefix || trimmed.startsWith(prefix + ' ') || trimmed.startsWith(prefix + '\t');
    });
}
/**
 * Checks whether a bash command matches any dangerous denylist pattern.
 */
function isBashCommandDangerous(command) {
    for (const pattern of DANGEROUS_BASH_PATTERNS) {
        if (pattern.test(command)) {
            return { dangerous: true, pattern };
        }
    }
    return { dangerous: false };
}
export class SafetyGate {
    projectRoot;
    /**
     * Initializes the safety gate with a project root.
     *
     * @param projectRoot The root directory of the project, defaulting to current working directory.
     */
    constructor(projectRoot = process.cwd()) {
        this.projectRoot = path.resolve(projectRoot);
    }
    /**
     * Classifies a tool call into 'safe', 'write', or 'dangerous' using a three-tier model:
     *  - safe: execute immediately, no prompt
     *  - write: execute immediately, log the action (no blocking prompt)
     *  - dangerous: block and require explicit (y/N) confirmation
     *
     * Both the classification logic and the dispatcher share KNOWN_TOOLS as the single
     * source of truth for what tools exist.
     *
     * @param name The name of the tool being called.
     * @param input The arguments passed to the tool.
     * @returns ClassificationResult containing the classification and optionally a reason.
     */
    classifyToolCall(name, input) {
        // 0. Reject unknown tools outright — they must not execute.
        if (!KNOWN_TOOLS.has(name)) {
            return {
                classification: 'dangerous',
                reason: `Unknown tool "${name}" — not in the registered tool list. Execution blocked.`,
            };
        }
        // 1. Filesystem sandbox verification for path-accepting tools
        if (input && typeof input === 'object') {
            for (const [key, value] of Object.entries(input)) {
                if (typeof value === 'string' && (key === 'path' || key === 'filePath' || key === 'dir')) {
                    const resolvedPath = path.resolve(this.projectRoot, value);
                    if (!resolvedPath.startsWith(this.projectRoot)) {
                        return {
                            classification: 'dangerous',
                            reason: `Path "${value}" resolves outside the project root: "${this.projectRoot}"`,
                        };
                    }
                }
            }
        }
        // 2. Bash three-tier classification
        if (name === 'bash' || name === 'start_process') {
            const command = input?.command || '';
            // 2a. Check denylist first — these always require confirmation
            const dangerCheck = isBashCommandDangerous(command);
            if (dangerCheck.dangerous) {
                return {
                    classification: 'dangerous',
                    reason: `Command matches dangerous pattern: ${dangerCheck.pattern?.toString()}`,
                };
            }
            // 2b. Check safe allowlist — these run immediately with no prompt
            if (isBashCommandSafe(command)) {
                return { classification: 'safe' };
            }
            // 2c. Everything else is 'write' — runs immediately, but is logged
            return {
                classification: 'write',
                reason: `Bash command "${command.substring(0, 60)}" will execute without prompting and be logged.`,
            };
        }
        // 3. Process polling tools — always safe (read-only status checks)
        if (name === 'check_process' || name === 'wait_process') {
            return { classification: 'safe' };
        }
        // 4. File mutation tools
        if (name === 'write_file' || name === 'edit_file') {
            return { classification: 'write' };
        }
        // 5. Memory write tools
        if (name === 'record_memory') {
            return { classification: 'write' };
        }
        // 6. Safe read-only tools
        if (name === 'read_file' ||
            name === 'grep' ||
            name === 'glob' ||
            name === 'search_memory' ||
            name === 'recall_memory' ||
            name === 'get_memory_node') {
            return { classification: 'safe' };
        }
        // Fallback — shouldn't be reached given KNOWN_TOOLS check above, but be safe
        return {
            classification: 'dangerous',
            reason: `Unclassified tool "${name}" — requires manual approval.`,
        };
    }
}
