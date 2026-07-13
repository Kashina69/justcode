/**
 * Pure Breadth-First Search (BFS) graph traversal logic.
 * Walks the memory node edges up to maxHops, tracking visited nodes and the frontier
 * node IDs (one hop beyond the traversal boundary).
 * 
 * Input and edge-retrieval are fully parameterized to allow filesystem-free unit testing.
 * 
 * @param seedIds Starting node IDs list.
 * @param maxHops Traverse relatedTo edges up to this count.
 * @param getNodeEdges Asynchronous callback to retrieve connected edges for a given node ID.
 * @returns Resolves to visited nodes (with hop distances) and frontier node IDs.
 */
export async function walkRelatedNodesBreadthFirst(
  seedIds: string[],
  maxHops: number,
  getNodeEdges: (id: string) => Promise<string[]> | string[]
): Promise<{
  visited: Map<string, number>;
  frontier: Set<string>;
}> {
  const visited = new Map<string, number>();
  const frontier = new Set<string>();
  const queue: { id: string; hop: number }[] = [];

  // Initialize queue with seed nodes
  for (const seedId of seedIds) {
    visited.set(seedId, 0);
    queue.push({ id: seedId, hop: 0 });
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    
    // If we've reached the boundary hop limit, neighbors are in the frontier
    if (current.hop >= maxHops) {
      try {
        const edges = await getNodeEdges(current.id);
        for (const edge of edges) {
          if (!visited.has(edge)) {
            frontier.add(edge);
          }
        }
      } catch {
        // Skip missing node links gracefully
      }
      continue;
    }

    try {
      const edges = await getNodeEdges(current.id);
      for (const edge of edges) {
        const nextHop = current.hop + 1;
        const existingHop = visited.get(edge);

        if (existingHop === undefined || nextHop < existingHop) {
          visited.set(edge, nextHop);
          frontier.delete(edge); // Ensure it's not categorized as frontier if it's fully visited
          queue.push({ id: edge, hop: nextHop });
        }
      }
    } catch {
      // Skip missing nodes
    }
  }

  return { visited, frontier };
}
