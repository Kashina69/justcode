import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const MAX_ENTRIES = 20;
const DECAY_FACTOR = 0.05;

export interface TasteEntry {
  preference: string;
  confidence: number;
  source: string;
  category?: 'code-style' | 'framework' | 'architecture' | 'workflow' | 'ui' | 'other';
}

function projectTastePath(root?: string): string {
  return path.join(root || process.cwd(), '.agents', 'taste', 'project-taste.md');
}

function globalTasteDir(): string {
  return path.join(os.homedir(), '.justcode', 'taste');
}

function globalTastePath(): string {
  return path.join(globalTasteDir(), 'global-taste.md');
}

function parseTasteFile(content: string): TasteEntry[] {
  const entries: TasteEntry[] = [];
  const lines = content.split('\n');
  let current: Partial<TasteEntry> = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('- preference:')) {
      if (current.preference) entries.push(current as TasteEntry);
      current = { preference: trimmed.replace(/^- preference:\s*/, '').replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1'), confidence: 0.5, source: 'manual' };
    } else if (trimmed.startsWith('confidence:') && current.preference) {
      current.confidence = parseFloat(trimmed.replace(/^confidence:\s*/, ''));
    } else if (trimmed.startsWith('source:') && current.preference) {
      current.source = trimmed.replace(/^source:\s*/, '').replace(/^"(.*)"$/, '$1');
    } else if (trimmed.startsWith('category:') && current.preference) {
      current.category = trimmed.replace(/^category:\s*/, '').replace(/^"(.*)"$/, '$1') as any;
    }
  }
  if (current.preference) entries.push(current as TasteEntry);
  return entries;
}

function formatTasteFile(entries: TasteEntry[], title: string): string {
  const sorted = [...entries].sort((a, b) => b.confidence - a.confidence);
  const lines: string[] = [
    `# ${title}`,
    '# Auto-updated by justcode. Keep this file small — only strong, high-confidence preferences.',
    `# Last updated: ${new Date().toISOString().split('T')[0]}`,
    `# Total entries: ${sorted.length}`,
    '',
  ];
  for (const e of sorted) {
    lines.push(`- preference: "${e.preference}"`);
    lines.push(`  confidence: ${e.confidence.toFixed(2)}`);
    lines.push(`  source: "${e.source}"`);
    if (e.category) lines.push(`  category: "${e.category}"`);
    lines.push('');
  }
  return lines.join('\n');
}

async function readTasteFile(filepath: string): Promise<TasteEntry[]> {
  try {
    const content = await fs.readFile(filepath, 'utf-8');
    return parseTasteFile(content);
  } catch {
    return [];
  }
}

async function writeTasteFile(filepath: string, entries: TasteEntry[], title: string): Promise<void> {
  await fs.mkdir(path.dirname(filepath), { recursive: true });
  const pruned = pruneEntries(entries);
  await fs.writeFile(filepath, formatTasteFile(pruned, title), 'utf-8');
}

function pruneEntries(entries: TasteEntry[]): TasteEntry[] {
  const sorted = [...entries].sort((a, b) => b.confidence - a.confidence);
  if (sorted.length <= MAX_ENTRIES) return sorted;
  return sorted.slice(0, MAX_ENTRIES);
}

function mergeTasteEntries(existing: TasteEntry[], detected: TasteEntry[]): TasteEntry[] {
  const merged = new Map<string, TasteEntry>();

  for (const e of existing) {
    const key = e.preference.toLowerCase().trim();
    merged.set(key, e);
  }

  for (const e of detected) {
    const key = e.preference.toLowerCase().trim();
    const existing_entry = merged.get(key);
    if (existing_entry) {
      existing_entry.confidence = Math.min(1, existing_entry.confidence + (e.confidence * DECAY_FACTOR));
      if (e.source !== existing_entry.source) {
        existing_entry.source += `; ${e.source}`;
      }
    } else {
      merged.set(key, { ...e });
    }
  }

  return Array.from(merged.values());
}

async function ensureGlobalTaste(): Promise<void> {
  const dir = globalTasteDir();
  const filepath = globalTastePath();
  await fs.mkdir(dir, { recursive: true });
  try {
    await fs.access(filepath);
  } catch {
    await fs.writeFile(filepath, formatTasteFile([], 'Global Taste Preferences'), 'utf-8');
  }
}

export async function loadProjectTaste(root?: string): Promise<TasteEntry[]> {
  return readTasteFile(projectTastePath(root));
}

export async function loadGlobalTaste(): Promise<TasteEntry[]> {
  await ensureGlobalTaste();
  return readTasteFile(globalTastePath());
}

export async function saveProjectTaste(entries: TasteEntry[], root?: string): Promise<void> {
  await writeTasteFile(projectTastePath(root), entries, 'Project Taste Preferences');
}

export async function saveGlobalTaste(entries: TasteEntry[]): Promise<void> {
  await ensureGlobalTaste();
  await writeTasteFile(globalTastePath(), entries, 'Global Taste Preferences');
}

export async function mergeIntoProjectTaste(detected: TasteEntry[], root?: string): Promise<TasteEntry[]> {
  const existing = await loadProjectTaste(root);
  const merged = mergeTasteEntries(existing, detected);
  await saveProjectTaste(merged, root);
  return merged;
}

export async function mergeIntoGlobalTaste(detected: TasteEntry[]): Promise<TasteEntry[]> {
  const existing = await loadGlobalTaste();
  const merged = mergeTasteEntries(existing, detected);
  await saveGlobalTaste(merged);
  return merged;
}

export async function getTasteContext(root?: string): Promise<string> {
  const projectTaste = await loadProjectTaste(root);
  const globalTaste = await loadGlobalTaste();
  const all = [...globalTaste, ...projectTaste].sort((a, b) => b.confidence - a.confidence);

  if (all.length === 0) return '';

  const lines = all.map(e => {
    const cat = e.category ? ` [${e.category}]` : '';
    return `  - "${e.preference}" (confidence: ${(e.confidence * 100).toFixed(0)}%)${cat}`;
  });

  return [
    '## User Taste Preferences',
    'The following preferences should guide code generation decisions.',
    'Higher confidence = more strongly held. Weigh them proportionally.',
    '',
    ...lines,
  ].join('\n');
}
