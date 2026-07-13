import fs from 'fs/promises';
import path from 'path';
export class NodeStore {
    nodesDir;
    /**
     * Initializes NodeStore.
     *
     * @param projectRoot Target project directory, defaults to process.cwd()
     */
    constructor(projectRoot = process.cwd()) {
        this.nodesDir = path.join(projectRoot, '.agent', 'memory', 'nodes');
    }
    /**
     * Reads a memory node by ID from its JSON file.
     *
     * @param id The memory node ID string.
     * @returns Resolves to the loaded MemoryNode structure.
     */
    async readMemoryNode(id) {
        const filePath = path.join(this.nodesDir, `${id}.json`);
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data);
    }
    /**
     * Writes/serializes a memory node to its JSON file.
     *
     * @param node The memory node structure to write.
     */
    async writeMemoryNode(node) {
        await fs.mkdir(this.nodesDir, { recursive: true });
        const filePath = path.join(this.nodesDir, `${node.id}.json`);
        await fs.writeFile(filePath, JSON.stringify(node, null, 2), 'utf-8');
    }
    /**
     * Helper to retrieve absolute target directory path.
     */
    getNodesDirectory() {
        return this.nodesDir;
    }
}
