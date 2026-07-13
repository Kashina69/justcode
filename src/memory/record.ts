import { NodeStore } from './node-store.js';
import { IndexStore } from './index-store.js';
import { MemoryNode } from './types.js';

/**
 * Serializes and registers a new memory node into the graph.
 * Saves the JSON node file and appends node properties to index.json.
 * 
 * @param summary One-line summary descriptive text.
 * @param content Full comprehensive content of the memory node.
 * @param relatedToIds Array of connected node ID strings.
 * @param tags Free-form categorization tags.
 * @param sourceSessionId Session ID context that created this node.
 * @param projectRoot Target project root directory, defaults to process.cwd().
 * @returns Resolves to the newly generated MemoryNode ID string.
 */
export async function recordMemoryNode(
  summary: string,
  content: string,
  relatedToIds: string[],
  tags: string[],
  sourceSessionId: string | null,
  projectRoot: string = process.cwd()
): Promise<string> {
  const dateStr = new Date().toISOString().split('T')[0];
  const timestamp = Date.now();
  const nodeId = `mem_${dateStr}_${timestamp}`;

  const node: MemoryNode = {
    id: nodeId,
    summary,
    content,
    tags,
    relatedTo: relatedToIds,
    createdAt: new Date().toISOString(),
    sourceSessionId,
  };

  // 1. Serialize node to nodes/<id>.json
  const nodeStore = new NodeStore(projectRoot);
  await nodeStore.writeMemoryNode(node);

  // 2. Append to index.json
  const indexStore = new IndexStore(projectRoot);
  await indexStore.appendToMemoryIndex({
    id: nodeId,
    summary,
    tags,
  });

  return nodeId;
}
