import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { handleInitCommand } from '../../src/cli/init.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('/init command', () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'init-test-'));
    vi.spyOn(process, 'cwd').mockReturnValue(tmpRoot);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  function touch(files: Record<string, string>) {
    for (const [rel, content] of Object.entries(files)) {
      const full = path.join(tmpRoot, rel);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, content, 'utf-8');
    }
  }

  it('should create .agent directory with expected files', async () => {
    touch({
      'package.json': JSON.stringify({
        dependencies: { react: '^18.0.0' },
        devDependencies: { typescript: '^5.0.0', vitest: '^1.0.0' },
      }),
      'tsconfig.json': JSON.stringify({ compilerOptions: { strict: true } }),
      'src/index.ts': 'const x: number = 1;',
      'src/app.tsx': 'function App() { return null; }',
    });

    await handleInitCommand();

    const agentDir = path.join(tmpRoot, '.agent');
    expect(fs.existsSync(path.join(agentDir, 'project.md'))).toBe(true);
    expect(fs.existsSync(path.join(agentDir, 'agents.md'))).toBe(true);
    expect(fs.existsSync(path.join(agentDir, 'taste', 'project-taste.md'))).toBe(true);
    expect(fs.existsSync(path.join(agentDir, 'modules'))).toBe(true);
  });

  it('should write meaningful content in project.md', async () => {
    touch({
      'package.json': JSON.stringify({
        dependencies: { next: '^14.0.0', react: '^18.0.0' },
        devDependencies: { typescript: '^5.0.0' },
      }),
      'tsconfig.json': JSON.stringify({}),
      'src/pages/index.tsx': 'export default function Home() { return null; }',
    });

    await handleInitCommand();

    const content = fs.readFileSync(path.join(tmpRoot, '.agent', 'project.md'), 'utf-8');
    expect(content).toContain('Next.js');
    expect(content).toContain('TypeScript');
    expect(content).toContain('Project Overview');
  });

  it('should write agent guidance in agents.md', async () => {
    touch({
      'package.json': JSON.stringify({
        dependencies: { react: '^18.0.0' },
        devDependencies: { typescript: '^5.0.0' },
      }),
      'src/index.ts': 'const x = 1;',
    });

    await handleInitCommand();

    const content = fs.readFileSync(path.join(tmpRoot, '.agent', 'agents.md'), 'utf-8');
    expect(content).toContain('Agent Guidance');
    expect(content).toContain('npm test');
    expect(content).toContain('project.md');
    expect(content).toContain('taste');
  });

  it('should create project taste file with detected preferences', async () => {
    touch({
      'package.json': JSON.stringify({
        dependencies: { react: '^18.0.0' },
        devDependencies: { typescript: '^5.0.0' },
      }),
      'tsconfig.json': JSON.stringify({}),
      'src/components/Button.tsx': 'function Button() { return null; }',
    });

    await handleInitCommand();

    const tasteContent = fs.readFileSync(path.join(tmpRoot, '.agent', 'taste', 'project-taste.md'), 'utf-8');
    expect(tasteContent).toContain('Project Taste Preferences');
    expect(tasteContent).toContain('uses TypeScript');
    expect(tasteContent).toContain('confidence:');
  });

  it('should create module files for each source directory', async () => {
    touch({
      'package.json': JSON.stringify({ dependencies: {}, devDependencies: {} }),
      'src/auth/login.ts': 'export const login = () => {};',
      'src/auth/register.ts': 'export const register = () => {};',
      'src/api/handler.ts': 'export const handler = () => {};',
      'src/ui/button.tsx': 'export const Button = () => null;',
    });

    await handleInitCommand();

    const modulesDir = path.join(tmpRoot, '.agent', 'modules');
    expect(fs.existsSync(path.join(modulesDir, 'auth.md'))).toBe(true);
    expect(fs.existsSync(path.join(modulesDir, 'api.md'))).toBe(true);
    expect(fs.existsSync(path.join(modulesDir, 'ui.md'))).toBe(true);
  });

  it('should handle re-init (idempotent)', async () => {
    touch({
      'package.json': JSON.stringify({ dependencies: { react: '^18.0.0' }, devDependencies: {} }),
      'src/index.tsx': 'export default () => null;',
    });

    await handleInitCommand();
    await handleInitCommand();

    const agentDir = path.join(tmpRoot, '.agent');
    expect(fs.existsSync(path.join(agentDir, 'project.md'))).toBe(true);
    expect(fs.existsSync(path.join(agentDir, 'agents.md'))).toBe(true);
  });

  it('should detect features like Zod validation from dependencies', async () => {
    touch({
      'package.json': JSON.stringify({
        dependencies: { zod: '^3.22.0' },
        devDependencies: {},
      }),
      'src/validate.ts': 'import { z } from "zod";',
    });

    await handleInitCommand();

    const projectMd = fs.readFileSync(path.join(tmpRoot, '.agent', 'project.md'), 'utf-8');
    expect(projectMd).toContain('validation (Zod)');
  });
});
