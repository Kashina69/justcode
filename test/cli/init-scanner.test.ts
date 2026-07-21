import { describe, it, expect } from 'vitest';
import { scanProject } from '../../src/cli/init-scanner.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

function createTempProject(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jctest-'));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, 'utf-8');
  }
  return root;
}

describe('scanProject', () => {
  it('should detect TypeScript from tsconfig.json', async () => {
    const root = createTempProject({
      'tsconfig.json': JSON.stringify({ compilerOptions: { strict: true } }),
      'package.json': JSON.stringify({
        dependencies: { react: '^18.0.0' },
        devDependencies: { typescript: '^5.0.0', vitest: '^1.0.0' },
      }),
      'src/index.ts': 'const x: number = 1;',
      'src/app.tsx': 'function App() { return null; }',
    });

    const profile = await scanProject(root);
    expect(profile.language).toBe('TypeScript');
    expect(profile.languages).toContain('TypeScript');
    expect(profile.traits.some(t => t.name === 'uses TypeScript')).toBe(true);
    expect(profile.conventions).toContain('strict TypeScript mode enabled');

    fs.rmSync(root, { recursive: true, force: true });
  });

  it('should detect React framework', async () => {
    const root = createTempProject({
      'package.json': JSON.stringify({
        dependencies: { react: '^18.0.0', 'react-dom': '^18.0.0' },
        devDependencies: {},
      }),
      'src/index.tsx': 'import React from "react";',
    });

    const profile = await scanProject(root);
    expect(profile.frameworks).toContain('React');
    expect(profile.traits.some(t => t.name === 'uses React')).toBe(true);

    fs.rmSync(root, { recursive: true, force: true });
  });

  it('should detect Next.js and Tailwind CSS', async () => {
    const root = createTempProject({
      'package.json': JSON.stringify({
        dependencies: { next: '^14.0.0', react: '^18.0.0' },
        devDependencies: {},
      }),
      'tailwind.config.ts': 'export default {};',
      'src/app/page.tsx': 'export default function Home() { return null; }',
    });

    const profile = await scanProject(root);
    expect(profile.frameworks).toContain('Next.js');
    expect(profile.traits.some(t => t.name === 'uses Tailwind CSS')).toBe(true);

    fs.rmSync(root, { recursive: true, force: true });
  });

  it('should detect Python project', async () => {
    const root = createTempProject({
      'pyproject.toml': '[tool.poetry]\nname = "test"',
      'src/main.py': 'def main():\n    pass',
    });

    const profile = await scanProject(root);
    expect(profile.languages).toContain('Python');

    fs.rmSync(root, { recursive: true, force: true });
  });

  it('should detect Rust project', async () => {
    const root = createTempProject({
      'Cargo.toml': '[package]\nname = "test"',
      'src/main.rs': 'fn main() {}',
    });

    const profile = await scanProject(root);
    expect(profile.languages).toContain('Rust');

    fs.rmSync(root, { recursive: true, force: true });
  });

  it('should detect Go project', async () => {
    const root = createTempProject({
      'go.mod': 'module test',
      'main.go': 'package main',
    });

    const profile = await scanProject(root);
    expect(profile.languages).toContain('Go');

    fs.rmSync(root, { recursive: true, force: true });
  });

  it('should detect test frameworks', async () => {
    const root = createTempProject({
      'package.json': JSON.stringify({
        dependencies: {},
        devDependencies: { vitest: '^1.0.0', playwright: '^1.40.0' },
      }),
      'src/index.ts': 'export const a = 1;',
    });

    const profile = await scanProject(root);
    expect(profile.testFrameworks).toContain('Vitest');
    expect(profile.testFrameworks).toContain('Playwright');

    fs.rmSync(root, { recursive: true, force: true });
  });

  it('should detect functional vs class-based patterns', async () => {
    const root = createTempProject({
      'package.json': JSON.stringify({ dependencies: {}, devDependencies: { typescript: '^5.0.0' } }),
      'tsconfig.json': JSON.stringify({}),
      'src/components/Header.tsx': 'function Header() { return null; }',
      'src/components/Footer.tsx': 'function Footer() { return null; }',
      'src/components/Item.tsx': 'const Item = () => null;',
      'src/components/List.tsx': 'const List = () => null;',
      'src/components/Legacy.tsx': 'class LegacyWidget { render() { return null; } }',
    });

    const profile = await scanProject(root);
    expect(profile.traits.some(t => t.name === 'prefers functional patterns over classes')).toBe(true);

    fs.rmSync(root, { recursive: true, force: true });
  });

  it('should detect semicolon usage', async () => {
    const root = createTempProject({
      'package.json': JSON.stringify({ dependencies: {}, devDependencies: { typescript: '^5.0.0' } }),
      'tsconfig.json': JSON.stringify({}),
      'src/lib/utils.ts': ['const a = 1;', 'const b = 2;', 'const c = 3;', 'const d = 4;', 'const e = 5;', 'const f = 6;', 'const g = 7;'].join('\n'),
      'src/lib/math.ts': ['export function add(x: number, y: number) {', '  return x + y;', '}', '', 'const h = 8;', 'const i = 9;', 'const j = 10;', 'const k = 11;'].join('\n'),
    });

    const profile = await scanProject(root);
    expect(profile.traits.some(t => t.name === 'uses semicolons')).toBe(true);

    fs.rmSync(root, { recursive: true, force: true });
  });

  it('should handle project with no package.json', async () => {
    const root = createTempProject({
      'setup.py': 'from setuptools import setup\nsetup(name="test")',
      'main.py': 'print("hello")',
      'src/lib/main.py': 'def helper(): pass',
      'src/lib/utils.py': 'def util(): pass',
    });

    const profile = await scanProject(root);
    expect(profile.language).toBe('Python');
    expect(profile.languages).toContain('Python');
    expect(profile.fileCount).toBeGreaterThan(0);

    fs.rmSync(root, { recursive: true, force: true });
  });

  it('should detect modules from source directories', async () => {
    const root = createTempProject({
      'package.json': JSON.stringify({ dependencies: {}, devDependencies: {} }),
      'src/auth/login.ts': 'export function login() {}',
      'src/auth/register.ts': 'export function register() {}',
      'src/api/users.ts': 'export function getUsers() {}',
      'src/api/posts.ts': 'export function getPosts() {}',
      'src/ui/button.tsx': 'export function Button() { return null; }',
    });

    const profile = await scanProject(root);
    const moduleNames = profile.modules.map(m => m.name);
    expect(moduleNames).toContain('auth');
    expect(moduleNames).toContain('api');
    expect(moduleNames).toContain('ui');

    fs.rmSync(root, { recursive: true, force: true });
  });

  it('should detect linting and formatter scripts', async () => {
    const root = createTempProject({
      'package.json': JSON.stringify({
        dependencies: {},
        devDependencies: {},
        scripts: { lint: 'eslint .', 'lint:fix': 'eslint --fix .', format: 'prettier --write .', test: 'vitest run' },
      }),
      'src/index.ts': 'const a = 1;',
    });

    const profile = await scanProject(root);
    expect(profile.traits.some(t => t.name === 'has linting configured')).toBe(true);
    expect(profile.traits.some(t => t.name === 'has formatter configured')).toBe(true);
    expect(profile.traits.some(t => t.name === 'has test script configured')).toBe(true);

    fs.rmSync(root, { recursive: true, force: true });
  });
});
