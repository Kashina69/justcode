import fs from 'fs/promises';
import path from 'path';
import { MemoryNode, MemoryIndex } from './types.js';

function nodesDir(projectRoot: string): string {
  return path.join(projectRoot, '.agent', 'memory', 'nodes');
}

function indexPath(projectRoot: string): string {
  return path.join(projectRoot, '.agent', 'memory', 'index.json');
}

export async function readMemoryNode(id: string, projectRoot: string = process.cwd()): Promise<MemoryNode> {
  const data = await fs.readFile(path.join(nodesDir(projectRoot), `${id}.json`), 'utf-8');
  return JSON.parse(data);
}

export async function writeMemoryNode(node: MemoryNode, projectRoot: string = process.cwd()): Promise<void> {
  const dir = nodesDir(projectRoot);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${node.id}.json`), JSON.stringify(node, null, 2), 'utf-8');
}

export async function loadMemoryIndex(projectRoot: string = process.cwd()): Promise<MemoryIndex> {
  try {
    const data = await fs.readFile(indexPath(projectRoot), 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export async function saveMemoryIndex(index: MemoryIndex, projectRoot: string = process.cwd()): Promise<void> {
  const fp = indexPath(projectRoot);
  await fs.mkdir(path.dirname(fp), { recursive: true });
  await fs.writeFile(fp, JSON.stringify(index, null, 2), 'utf-8');
}

export async function appendToMemoryIndex(item: { id: string; summary: string; tags: string[] }, projectRoot: string = process.cwd()): Promise<void> {
  const index = await loadMemoryIndex(projectRoot);
  if (!index.some(e => e.id === item.id)) {
    index.push(item);
    await saveMemoryIndex(index, projectRoot);
  }
}
