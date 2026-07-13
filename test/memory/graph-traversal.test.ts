import { describe, it, expect } from 'vitest';
import { walkRelatedNodesBreadthFirst } from '../../src/memory/graph-traversal.js';

describe('walkRelatedNodesBreadthFirst', () => {
  // A test graph structure represented as a map
  const mockGraph: Record<string, string[]> = {
    A: ['B', 'C'],
    B: ['D'],
    C: ['E', 'F'],
    D: ['A'], // Cycle D -> A
    E: [],
    F: ['G'],
    G: ['H'],
  };

  const getMockEdges = (id: string): string[] => {
    return mockGraph[id] || [];
  };

  it('should traverse paths up to 1 hop', async () => {
    const result = await walkRelatedNodesBreadthFirst(['A'], 1, getMockEdges);

    expect(Array.from(result.visited.keys())).toEqual(['A', 'B', 'C']);
    expect(result.visited.get('A')).toBe(0);
    expect(result.visited.get('B')).toBe(1);
    expect(result.visited.get('C')).toBe(1);

    // Frontier nodes at exactly hop limit + 1
    expect(Array.from(result.frontier)).toEqual(['D', 'E', 'F']);
  });

  it('should traverse paths up to 2 hops and resolve cycles', async () => {
    const result = await walkRelatedNodesBreadthFirst(['A'], 2, getMockEdges);

    expect(Array.from(result.visited.keys())).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
    expect(result.visited.get('D')).toBe(2);
    expect(result.visited.get('E')).toBe(2);
    expect(result.visited.get('F')).toBe(2);

    // Frontier is at hop 3
    expect(Array.from(result.frontier)).toEqual(['G']);
  });

  it('should support multiple seed node entries', async () => {
    const result = await walkRelatedNodesBreadthFirst(['B', 'F'], 1, getMockEdges);

    expect(Array.from(result.visited.keys())).toEqual(['B', 'F', 'D', 'G']);
    expect(result.visited.get('B')).toBe(0);
    expect(result.visited.get('F')).toBe(0);
    expect(result.visited.get('D')).toBe(1);
    expect(result.visited.get('G')).toBe(1);
  });
});
