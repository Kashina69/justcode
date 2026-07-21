import fs from 'fs/promises';
import path from 'path';

export interface DetectedTrait {
  name: string;
  confidence: number;
  evidence: string;
}

export interface ProjectProfile {
  name: string;
  language: string;
  languages: string[];
  frameworks: string[];
  buildTool: string;
  testFrameworks: string[];
  sourceDirs: string[];
  directories: string[];
  fileCount: number;
  moduleCount: number;
  traits: DetectedTrait[];
  conventions: string[];
  features: string[];
  modules: { name: string; path: string; files: string[] }[];
  largeFiles: { path: string; lines: number; purpose: string }[];
}

const SKIP_DIRS = new Set(['node_modules', '.git', '.agent', '.agents', 'dist', 'build', '.next', '.nuxt', '.turbo', 'coverage', '__pycache__', '.venv', 'venv', 'env', '.env', '.cache', '.yarn', '.pnp', '.svelte-kit', '.output']);
const SOURCE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.rs', '.go', '.java', '.kt', '.rb', '.php', '.swift', '.c', '.cpp', '.h', '.hpp', '.css', '.scss', '.sass', '.less', '.vue', '.svelte', '.astro', '.md', '.json', '.yaml', '.yml', '.toml', '.prisma', '.graphql']);

export async function scanProject(root: string): Promise<ProjectProfile> {
  const name = path.basename(root);

  const pkgJson = await tryReadJson(path.join(root, 'package.json'));
  const tsConfig = await tryReadJson(path.join(root, 'tsconfig.json'));

  const languages = new Set<string>();
  const frameworks = new Set<string>();
  const testFrameworks = new Set<string>();
  const traits: DetectedTrait[] = [];
  const conventions: string[] = [];
  const features: string[] = [];
  const sourceDirs: string[] = [];
  const directories: string[] = [];
  const modules: { name: string; path: string; files: string[] }[] = [];
  const largeFiles: { path: string; lines: number; purpose: string }[] = [];
  const allDeps: Record<string, string> = {};

  // ---- Detect from package.json ----
  if (pkgJson) {
    languages.add('JavaScript');
    Object.assign(allDeps, pkgJson.dependencies || {}, pkgJson.devDependencies || {});

    const frameworkMap: Record<string, string> = {
      next: 'Next.js', react: 'React', vue: 'Vue', svelte: 'Svelte', angular: 'Angular',
      'nuxt': 'Nuxt', 'gatsby': 'Gatsby', 'remix': 'Remix', 'astro': 'Astro',
      'solid-js': 'SolidJS', 'preact': 'Preact',
      express: 'Express', fastify: 'Fastify', koa: 'Koa', nest: 'NestJS',
      hono: 'Hono', '@hono/hono': 'Hono',
    };
    for (const [key, label] of Object.entries(frameworkMap)) {
      if (key in allDeps) {
        frameworks.add(label);
        traits.push({ name: `uses ${label}`, confidence: 0.95, evidence: `dependency "${key}" in package.json` });
      }
    }

    if ('typescript' in allDeps || tsConfig) {
      languages.add('TypeScript');
      traits.push({ name: 'uses TypeScript', confidence: tsConfig ? 0.98 : 0.8, evidence: tsConfig ? 'tsconfig.json found' : 'typescript in devDependencies' });
    }

    const testMap: Record<string, string> = {
      vitest: 'Vitest', jest: 'Jest', mocha: 'Mocha', ava: 'AVA', tape: 'Tape',
      'playwright': 'Playwright', 'cypress': 'Cypress', 'selenium-webdriver': 'Selenium',
    };
    for (const [key, label] of Object.entries(testMap)) {
      if (key in allDeps) testFrameworks.add(label);
    }

    const toolMap: Record<string, string> = {
      vite: 'Vite', webpack: 'Webpack', esbuild: 'esbuild', rollup: 'Rollup',
      turbopack: 'Turbopack', 'parcel': 'Parcel', 'tsup': 'tsup', 'nx': 'Nx',
    };
    for (const [key, label] of Object.entries(toolMap)) {
      if (key in allDeps) traits.push({ name: `uses ${label}`, confidence: 0.9, evidence: `dependency "${key}"` });
    }

    if (pkgJson.scripts) {
      const scriptNames = Object.keys(pkgJson.scripts);
      if (scriptNames.some(s => s.startsWith('lint'))) traits.push({ name: 'has linting configured', confidence: 0.85, evidence: `scripts: ${scriptNames.filter(s => s.startsWith('lint')).join(', ')}` });
      if (scriptNames.some(s => s.startsWith('test'))) traits.push({ name: 'has test script configured', confidence: 0.85, evidence: `scripts: ${scriptNames.filter(s => s.startsWith('test')).join(', ')}` });
      if (scriptNames.some(s => s.startsWith('format') || s === 'prettier')) traits.push({ name: 'has formatter configured', confidence: 0.8, evidence: 'format script found' });
    }
  }

  // ---- Detect Python ----
  if (await exists(path.join(root, 'pyproject.toml')) || await exists(path.join(root, 'setup.py')) || await exists(path.join(root, 'requirements.txt'))) {
    languages.add('Python');
    traits.push({ name: 'uses Python', confidence: 0.95, evidence: 'pyproject.toml, setup.py, or requirements.txt found' });
  }

  // ---- Detect Rust ----
  if (await exists(path.join(root, 'Cargo.toml'))) {
    languages.add('Rust');
    traits.push({ name: 'uses Rust', confidence: 0.95, evidence: 'Cargo.toml found' });
  }

  // ---- Detect Go ----
  if (await exists(path.join(root, 'go.mod'))) {
    languages.add('Go');
    traits.push({ name: 'uses Go', confidence: 0.95, evidence: 'go.mod found' });
  }

  // ---- Detect CSS framework ----
  const tailwindConfig = await findFiles(root, /tailwind\.config\.(js|cjs|mjs|ts)$/, 1);
  if (tailwindConfig.length > 0) {
    traits.push({ name: 'uses Tailwind CSS', confidence: 0.95, evidence: `${tailwindConfig[0]} found` });
  }
  if (await exists(path.join(root, 'uno.config.ts')) || await exists(path.join(root, 'windi.config.ts'))) {
    traits.push({ name: 'uses utility-first CSS', confidence: 0.85, evidence: 'UnoCSS/WindiCSS config found' });
  }

  // ---- Scan source tree ----
  const srcDir = await findSourceDir(root);

  if (srcDir) {
    sourceDirs.push(srcDir);
    await scanDirectory(srcDir, root, languages, modules, largeFiles, directories, 3);
  }

  // Walk src top-level for module identification
  if (srcDir) {
    try {
      const entries = await fs.readdir(srcDir, { withFileTypes: true });
      for (const e of entries) {
        if (e.isDirectory() && !SKIP_DIRS.has(e.name)) {
          const modFiles: string[] = [];
          await collectFiles(path.join(srcDir, e.name), modFiles, 2);
          if (modFiles.length > 0) {
            modules.push({ name: e.name, path: path.relative(root, path.join(srcDir, e.name)), files: modFiles });
          }
        }
      }
    } catch { /* ignore */ }
  }

  // ---- Detect conventions ----
  if (tsConfig) {
    if (tsConfig.compilerOptions?.strict) conventions.push('strict TypeScript mode enabled');
    if (tsConfig.compilerOptions?.strictNullChecks) conventions.push('strictNullChecks enabled');
  }

  // Sample source files for code conventions
  const sampleFiles = modules.flatMap(m => m.files).filter(f => f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.js') || f.endsWith('.jsx')).slice(0, 20);
  let classCount = 0;
  let funcCount = 0;
  let arrowCount = 0;
  let semicolonCount = 0;
  let noSemicolonCount = 0;
  let tsSampleCount = 0;

  for (const f of sampleFiles) {
    try {
      const content = await fs.readFile(path.join(root, f), 'utf-8');
      const lines = content.split('\n');
      for (const line of lines) {
        if (/\bclass\s+\w+/.test(line)) classCount++;
        if (/\bfunction\s+\w+/.test(line)) funcCount++;
        if (/=>\s*{/.test(line) || /=>\s*\(/.test(line) || /=>\s+\S/.test(line)) arrowCount++;
      }
      const nonEmpty = lines.filter(l => l.trim() && !l.trim().startsWith('//') && !l.trim().startsWith('/*') && !l.trim().startsWith('*'));
      for (const l of nonEmpty) {
        if (l.trim().endsWith(';')) semicolonCount++;
        else if (/^\s*[\w\s]+\s*$/.test(l.trim()) || l.trim().endsWith('{') || l.trim().endsWith('}') || l.trim().endsWith(')')) { /* likely no semicolon needed */ }
        else if (l.trim().length > 2 && !l.trim().startsWith('import') && !l.trim().startsWith('export') && !l.trim().startsWith('/*')) noSemicolonCount++;
      }
      tsSampleCount++;
    } catch { /* skip */ }
  }

  if (classCount > 0 && classCount > funcCount + arrowCount) {
    traits.push({ name: 'prefers class-based architecture', confidence: Math.min(0.9, 0.5 + classCount / (funcCount + arrowCount + classCount) / 2), evidence: `${classCount} class declarations vs ${funcCount + arrowCount} function declarations in sample` });
  } else if (funcCount + arrowCount > 0 && funcCount + arrowCount > classCount * 2) {
    traits.push({ name: 'prefers functional patterns over classes', confidence: Math.min(0.9, 0.5 + (funcCount + arrowCount) / (funcCount + arrowCount + classCount) / 2), evidence: `${funcCount + arrowCount} function/arrow declarations vs ${classCount} class declarations` });
  }

  if (semicolonCount > noSemicolonCount * 2 && semicolonCount > 10) {
    traits.push({ name: 'uses semicolons', confidence: Math.min(0.9, semicolonCount / (semicolonCount + noSemicolonCount)), evidence: `${semicolonCount} lines end with ;` });
  } else if (noSemicolonCount > semicolonCount * 2 && noSemicolonCount > 10) {
    traits.push({ name: 'omits semicolons', confidence: Math.min(0.9, noSemicolonCount / (semicolonCount + noSemicolonCount)), evidence: `${noSemicolonCount} lines omit ;` });
  }

  // ---- Detect features ----
  const hasApiRoutes = await findFiles(root, /route\.(ts|js|tsx)$/, 5).then(r => r.length > 0);
  if (hasApiRoutes) features.push('API routes');

  if (Object.keys(allDeps).length > 0) {
    if ('@prisma/client' in allDeps || 'prisma' in allDeps) features.push('database (Prisma ORM)');
    if ('drizzle-orm' in allDeps) features.push('database (Drizzle ORM)');
    if ('mongoose' in allDeps || 'mongodb' in allDeps) features.push('database (MongoDB)');
    if ('graphql' in allDeps) features.push('GraphQL API');
    if ('trpc' in allDeps) features.push('tRPC API');
    if ('zod' in allDeps) features.push('validation (Zod)');
    if ('i18next' in allDeps || 'react-i18next' in allDeps) features.push('internationalization');
    if ('socket.io' in allDeps || 'ws' in allDeps) features.push('WebSocket support');
  }

  const moduleCount = modules.length;
  const allSourceFiles = modules.flatMap(m => m.files);
  const fileCount = allSourceFiles.length;

  // ---- Build language summary ----
  const language = languages.has('TypeScript') ? 'TypeScript' :
    languages.has('JavaScript') ? 'JavaScript' :
    languages.has('Python') ? 'Python' :
    languages.has('Rust') ? 'Rust' :
    languages.has('Go') ? 'Go' :
    Array.from(languages)[0] || 'Unknown';

  return {
    name,
    language,
    languages: Array.from(languages),
    frameworks: Array.from(frameworks),
    buildTool: pkgJson?.packageManager?.split('@')[0] || (await findBuildTool(root)),
    testFrameworks: Array.from(testFrameworks),
    sourceDirs,
    directories,
    fileCount,
    moduleCount,
    traits,
    conventions,
    features,
    modules,
    largeFiles,
  };
}

async function findSourceDir(root: string): Promise<string | null> {
  for (const dir of ['src', 'app', 'lib', 'packages', 'core', 'server', 'client']) {
    const full = path.join(root, dir);
    if (await exists(full)) return full;
  }
  // fallback: find first non-skip subdirectory
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory() && !SKIP_DIRS.has(e.name) && !e.name.startsWith('.')) {
        return path.join(root, e.name);
      }
    }
  } catch { /* ignore */ }
  return null;
}

async function scanDirectory(
  dir: string, root: string,
  languages: Set<string>, modules: { name: string; path: string; files: string[] }[],
  largeFiles: { path: string; lines: number; purpose: string }[],
  directories: string[],
  depth: number
): Promise<void> {
  if (depth <= 0) return;
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      const rel = path.relative(root, full);
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) {
          directories.push(rel);
          await scanDirectory(full, root, languages, modules, largeFiles, directories, depth - 1);
        }
      } else if (e.isFile()) {
        const ext = path.extname(e.name).toLowerCase();
        if (ext === '.ts' || ext === '.tsx') languages.add('TypeScript');
        else if (ext === '.js' || ext === '.jsx' || ext === '.mjs' || ext === '.cjs') languages.add('JavaScript');
        else if (ext === '.py') languages.add('Python');
        else if (ext === '.rs') languages.add('Rust');
        else if (ext === '.go') languages.add('Go');
        else if (ext === '.java') languages.add('Java');

        if (e.name.endsWith('.test.ts') || e.name.endsWith('.test.tsx') || e.name.endsWith('.spec.ts') || e.name.endsWith('.test.js') || e.name.endsWith('.spec.js')) {
          continue; // skip test files in module listing
        }
      }
    }
  } catch { /* ignore */ }
}

async function collectFiles(dir: string, result: string[], depth: number): Promise<void> {
  if (depth <= 0) return;
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) {
          await collectFiles(full, result, depth - 1);
        }
      } else if (e.isFile()) {
        const ext = path.extname(e.name).toLowerCase();
        if (SOURCE_EXTS.has(ext)) {
          result.push(full);
        }
      }
    }
  } catch { /* ignore */ }
}

async function findFiles(root: string, pattern: RegExp, limit: number): Promise<string[]> {
  const results: string[] = [];
  async function walk(dir: string, depth: number) {
    if (depth <= 0 || results.length >= limit) return;
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const e of entries) {
        if (results.length >= limit) return;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (!SKIP_DIRS.has(e.name)) await walk(full, depth - 1);
        } else if (e.isFile() && pattern.test(e.name)) {
          results.push(path.relative(root, full));
        }
      }
    } catch { /* ignore */ }
  }
  await walk(root, 5);
  return results;
}

async function findBuildTool(root: string): Promise<string> {
  if (await exists(path.join(root, 'pnpm-lock.yaml'))) return 'pnpm';
  if (await exists(path.join(root, 'yarn.lock'))) return 'yarn';
  if (await exists(path.join(root, 'package-lock.json'))) return 'npm';
  if (await exists(path.join(root, 'bun.lock'))) return 'bun';
  if (await exists(path.join(root, 'Cargo.toml'))) return 'cargo';
  if (await exists(path.join(root, 'go.mod'))) return 'go';
  if (await exists(path.join(root, 'pyproject.toml'))) return 'pip';
  return 'unknown';
}

async function tryReadJson(filepath: string): Promise<any | null> {
  try {
    const content = await fs.readFile(filepath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function exists(filepath: string): Promise<boolean> {
  try {
    await fs.access(filepath);
    return true;
  } catch {
    return false;
  }
}
