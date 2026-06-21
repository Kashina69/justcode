import path from 'path';

export type ToolClass = 'safe' | 'write' | 'dangerous';

export interface ClassificationResult {
  classification: ToolClass;
  reason?: string;
}

export class SafetyGate {
  private projectRoot: string;
  private denylist: RegExp[] = [
    /rm\s+-rf\b/,
    /\bDROP\b/i,
    /\bTRUNCATE\b/i,
    /\bDELETE\s+FROM\b/i,
    /git\s+push\s+.*--force/,
    /(curl|wget).*\b(sh|bash)\b/
  ];

  /**
   * Initializes the safety gate with a project root.
   * 
   * @param projectRoot The root directory of the project, defaulting to current working directory.
   */
  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = path.resolve(projectRoot);
  }

  /**
   * Classifies a tool call execution payload into 'safe', 'write', or 'dangerous'.
   * 
   * @param name The name of the tool being called.
   * @param input The arguments passed to the tool.
   * @returns ClassificationResult containing the classification and optionally a reason.
   */
  classifyToolCall(name: string, input: any): ClassificationResult {
    // 1. Filesystem Sandbox Verification
    // Check if the input contains a path parameter and if it attempts to escape the root
    if (input && typeof input === 'object') {
      for (const [key, value] of Object.entries(input)) {
        if (typeof value === 'string' && (key === 'path' || key === 'filePath' || key === 'dir')) {
          const resolvedPath = path.resolve(this.projectRoot, value);
          // If the resolved path does not start with the project root, it's dangerous
          if (!resolvedPath.startsWith(this.projectRoot)) {
            return {
              classification: 'dangerous',
              reason: `Path "${value}" resolves outside the project root directory: "${this.projectRoot}"`,
            };
          }
        }
      }
    }

    // 2. Tool-specific rules
    if (name === 'bash') {
      const command = input?.command || '';
      for (const regex of this.denylist) {
        if (regex.test(command)) {
          return {
            classification: 'dangerous',
            reason: `Bash command matches denylist pattern: ${regex.toString()}`,
          };
        }
      }
      // General bash command is dangerous by default
      return {
        classification: 'dangerous',
        reason: 'All bash executions require manual confirmation.',
      };
    }

    if (name === 'write_file' || name === 'edit_file') {
      return { classification: 'write' };
    }

    // Default safe tools (provided path checks passed)
    if (name === 'read_file' || name === 'grep' || name === 'glob' || name === 'list_dir') {
      return { classification: 'safe' };
    }

    // Any unrecognized tool is dangerous by default
    return {
      classification: 'dangerous',
      reason: `Unrecognized tool "${name}"`,
    };
  }
}
