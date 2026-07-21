export interface HostEnvironment {
  platform: NodeJS.Platform;
  shellHint: string;
}

export function detectHostEnvironment(): HostEnvironment {
  const platform = process.platform;
  const shellHint = platform === 'win32'
    ? 'Windows — use cmd-compatible commands (dir, del, if exist) or explicit `powershell -Command "..."` for anything else'
    : 'POSIX — use standard Unix commands (ls, rm, &&)';
  return { platform, shellHint };
}
