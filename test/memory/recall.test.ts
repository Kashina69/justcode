import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { recordMemoryNode } from '../../src/memory/record.js';
import { recallMemoryContext } from '../../src/memory/recall.js';
import { readMemoryNode } from '../../src/memory/store.js';
import fs from 'fs';
import path from 'path';

describe('Memory Graph Recall Integration & Acceptance Tests', () => {
  const testRoot = path.resolve('test_memory_graph_temp');

  beforeEach(() => {
    if (fs.existsSync(testRoot)) {
      fs.rmSync(testRoot, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testRoot)) {
      fs.rmSync(testRoot, { recursive: true, force: true });
    }
  });

  it('should traverse, score, and retrieve nodes correctly on a 30+ node graph in one call', async () => {
    const nodeIds: string[] = [];

    for (let i = 0; i < 30; i++) {
      const summary = `Fact ${i}: Detail topic mapping.`;
      const content = `Full content details for fact node number ${i}. This describes architectural decision ${i} in detail.`;
      const tags = [`topic-${i}`, 'integration-test'];
      const relatedTo = i > 0 ? [nodeIds[i - 1]] : [];

      const id = await recordMemoryNode(summary, content, relatedTo, tags, 'test-session', testRoot);
      nodeIds.push(id);
    }

    const node3 = await readMemoryNode(nodeIds[3], testRoot);
    expect(node3.summary).toBe('Fact 3: Detail topic mapping.');
    expect(node3.relatedTo).toEqual([nodeIds[2]]);

    const result = await recallMemoryContext('Fact 15', {
      maxSeedNodes: 1,
      maxHops: 3,
      tokenBudget: 3000,
      projectRoot: testRoot,
    });

    expect(result.includedNodes.length).toBeGreaterThan(0);
    expect(result.totalTokensUsed).toBeGreaterThan(0);
    expect(result.truncated).toBe(false);

    const retrievedIds = result.includedNodes.map((n) => n.id);
    expect(retrievedIds).toContain(nodeIds[15]);
    expect(retrievedIds).toContain(nodeIds[14]);
    expect(retrievedIds).toContain(nodeIds[13]);
    expect(retrievedIds).toContain(nodeIds[12]);
  });

  it('should enforce tokenBudget limit on retrieval content', async () => {
    const nodeIds: string[] = [];

    const names = ['Zero', 'One', 'Two', 'Three', 'Four'];
    for (let i = 0; i < 5; i++) {
      const id = await recordMemoryNode(
        `Summary ${names[i]}`,
        `Content of node ${i} is long. 1234567890 1234567890 1234567890 1234567890`,
        i > 0 ? [nodeIds[i - 1]] : [],
        ['test-budget'],
        'test-session',
        testRoot
      );
      nodeIds.push(id);
    }

    const result = await recallMemoryContext('Summary Four', {
      maxSeedNodes: 1,
      maxHops: 4,
      tokenBudget: 30,
      projectRoot: testRoot,
    });

    expect(result.truncated).toBe(true);
    expect(result.includedNodes.length).toBeLessThan(5);
    expect(result.frontierNodeIds.length).toBeGreaterThan(0);
  });
});
