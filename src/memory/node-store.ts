import fs from 'fs/promises';
import path from 'path';
import { MemoryNode } from './types.js';

export class NodeStore {
  private nodesDir: string;

  /**
   * Initializes NodeStore.
   * 
   * @param projectRoot Target project directory, defaults to process.cwd()
   */
  constructor(projectRoot: string = process.cwd()) {
    this.nodesDir = path.join(projectRoot, '.agent', 'memory', 'nodes');
  }

  /**
   * Reads a memory node by ID from its JSON file.
   * 
   * @param id The memory node ID string.
   * @returns Resolves to the loaded MemoryNode structure.
   */
  public async readMemoryNode(id: string): Promise<MemoryNode> {
    const filePath = path.join(this.nodesDir, `${id}.json`);
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  }

  /**
   * Writes/serializes a memory node to its JSON file.
   * 
   * @param node The memory node structure to write.
   */
  public async writeMemoryNode(node: MemoryNode): Promise<void> {
    await fs.mkdir(this.nodesDir, { recursive: true });
    const filePath = path.join(this.nodesDir, `${node.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(node, null, 2), 'utf-8');
  }

  /**
   * Helper to retrieve absolute target directory path.
   */
  public getNodesDirectory(): string {
    return this.nodesDir;
  }
}
