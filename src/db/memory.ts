import fs from 'fs/promises';
import path from 'path';
import { MemoryNode, MemoryIndex } from '../memory/types.js';
import { DbConfig, DbSchema } from './types.js';
import { introspectSchema } from './schema.js';

const MEM_DIR = path.join(process.cwd(), '.agent', 'db', 'memory');
const NODES_DIR = path.join(MEM_DIR, 'nodes');
const INDEX_FILE = path.join(MEM_DIR, 'index.json');
const CACHE_FILE = path.join(MEM_DIR, 'schema-cache.json');

/**
 * Loads the database memory index.
 */
export async function loadDbMemory(): Promise<MemoryIndex> {
  try {
    const data = await fs.readFile(INDEX_FILE, 'utf-8');
    return JSON.parse(data) as MemoryIndex;
  } catch {
    return [];
  }
}

/**
 * Records a new database memory node.
 */
export async function recordDbMemory(
  summary: string,
  content: string,
  tags: string[] = [],
  relatedTo: string[] = []
): Promise<MemoryNode> {
  await fs.mkdir(NODES_DIR, { recursive: true });

  const timestamp = new Date().toISOString();
  const id = `db_mem_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  const node: MemoryNode = {
    id,
    summary,
    content,
    tags,
    relatedTo,
    createdAt: timestamp,
    sourceSessionId: null,
  };

  // Write node file
  const nodePath = path.join(NODES_DIR, `${id}.json`);
  await fs.writeFile(nodePath, JSON.stringify(node, null, 2), 'utf-8');

  // Update index
  const index = await loadDbMemory();
  index.push({ id, summary, tags });
  await fs.writeFile(INDEX_FILE, JSON.stringify(index, null, 2), 'utf-8');

  return node;
}

/**
 * Loads a memory node by ID.
 */
export async function loadDbMemoryNode(id: string): Promise<MemoryNode | null> {
  try {
    const filePath = path.join(NODES_DIR, `${id}.json`);
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data) as MemoryNode;
  } catch {
    return null;
  }
}

/**
 * Revalidates the schema against cache. Logs memory of changes if detected.
 */
export async function revalidateSchema(config: DbConfig): Promise<{ changed: boolean; diff?: string }> {
  const currentSchema = await introspectSchema(config);
  let cachedSchema: DbSchema | null = null;

  try {
    const cachedData = await fs.readFile(CACHE_FILE, 'utf-8');
    cachedSchema = JSON.parse(cachedData) as DbSchema;
  } catch {
    // Cache doesn't exist yet
  }

  // Save current schema to cache
  await fs.mkdir(MEM_DIR, { recursive: true });
  await fs.writeFile(CACHE_FILE, JSON.stringify(currentSchema, null, 2), 'utf-8');

  if (!cachedSchema) {
    // Initial schema cached
    const summary = 'Initial database schema cached.';
    const content = `Database connection "${config.name}" schema initialized with ${currentSchema.tables.length} tables.`;
    await recordDbMemory(summary, content, ['schema', 'initial']);
    return { changed: true, diff: 'Initial schema cached.' };
  }

  // Compare tables and columns
  const diffs: string[] = [];
  const currTableNames = new Set(currentSchema.tables.map((t) => t.name));
  const cachedTableNames = new Set(cachedSchema.tables.map((t) => t.name));

  // Check added tables
  for (const name of currTableNames) {
    if (!cachedTableNames.has(name)) {
      diffs.push(`Table "${name}" was created.`);
    }
  }

  // Check dropped tables
  for (const name of cachedTableNames) {
    if (!currTableNames.has(name)) {
      diffs.push(`Table "${name}" was dropped.`);
    }
  }

  // Check column changes in existing tables
  for (const currTable of currentSchema.tables) {
    const cachedTable = cachedSchema.tables.find((t) => t.name === currTable.name);
    if (!cachedTable) continue;

    const currColNames = new Set(currTable.columns.map((c) => c.name));
    const cachedColNames = new Set(cachedTable.columns.map((c) => c.name));

    for (const name of currColNames) {
      if (!cachedColNames.has(name)) {
        diffs.push(`Column "${name}" was added to table "${currTable.name}".`);
      } else {
        // Compare types
        const col1 = currTable.columns.find((c) => c.name === name);
        const col2 = cachedTable.columns.find((c) => c.name === name);
        if (col1 && col2 && col1.type !== col2.type) {
          diffs.push(`Column "${name}" in table "${currTable.name}" type changed from ${col2.type} to ${col1.type}.`);
        }
      }
    }

    for (const name of cachedColNames) {
      if (!currColNames.has(name)) {
        diffs.push(`Column "${name}" was dropped from table "${currTable.name}".`);
      }
    }
  }

  if (diffs.length > 0) {
    const summary = 'Database schema changes detected.';
    const content = `The following schema modifications were identified:\n` + diffs.map((d) => `- ${d}`).join('\n');
    await recordDbMemory(summary, content, ['schema', 'update']);
    return { changed: true, diff: diffs.join('\n') };
  }

  return { changed: false };
}
