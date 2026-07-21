import { writeMemoryNode, appendToMemoryIndex } from './store.js';
import { MemoryNode } from './types.js';

let idCounter = 0;

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
  const seq = (idCounter++).toString(36).padStart(4, '0');
  const nodeId = `mem_${dateStr}_${timestamp}_${seq}`;

  const node: MemoryNode = {
    id: nodeId,
    summary,
    content,
    tags,
    relatedTo: relatedToIds,
    createdAt: new Date().toISOString(),
    sourceSessionId,
  };

  await writeMemoryNode(node, projectRoot);
  await appendToMemoryIndex({ id: nodeId, summary, tags }, projectRoot);

  return nodeId;
}
