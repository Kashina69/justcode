import fs from 'fs/promises';
import path from 'path';
import { MemoryIndex } from './types.js';

export class IndexStore {
  private indexPath: string;

  /**
   * Initializes IndexStore.
   * 
   * @param projectRoot Target project directory, defaults to process.cwd()
   */
  constructor(projectRoot: string = process.cwd()) {
    this.indexPath = path.join(projectRoot, '.agent', 'memory', 'index.json');
  }

  /**
   * Loads the memory index list from index.json. Defaults to empty array if missing.
   * 
   * @returns Resolves to MemoryIndex array.
   */
  public async loadMemoryIndex(): Promise<MemoryIndex> {
    try {
      const data = await fs.readFile(this.indexPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  /**
   * Serializes the memory index to index.json on disk.
   * 
   * @param index The index list to write.
   */
  public async saveMemoryIndex(index: MemoryIndex): Promise<void> {
    const dir = path.dirname(this.indexPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.indexPath, JSON.stringify(index, null, 2), 'utf-8');
  }

  /**
   * Safely appends an entry to the index list without duplicates.
   * 
   * @param item The index payload to add.
   */
  public async appendToMemoryIndex(item: { id: string; summary: string; tags: string[] }): Promise<void> {
    const index = await this.loadMemoryIndex();
    const exists = index.some((e) => e.id === item.id);
    if (!exists) {
      index.push(item);
      await this.saveMemoryIndex(index);
    }
  }
}
