import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { recordMemoryNode } from '../../src/memory/record.js';
import { recallMemoryContext } from '../../src/memory/recall.js';
import { NodeStore } from '../../src/memory/node-store.js';
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
        // 1. Construct a memory graph of 30 connected nodes.
        // Node links structure:
        // mem_0 -> mem_1 -> mem_2 -> ... -> mem_29
        const nodeIds = [];
        for (let i = 0; i < 30; i++) {
            const summary = `Fact ${i}: Detail topic mapping.`;
            const content = `Full content details for fact node number ${i}. This describes architectural decision ${i} in detail.`;
            const tags = [`topic-${i}`, 'integration-test'];
            // Link to previous node if i > 0
            const relatedTo = i > 0 ? [nodeIds[i - 1]] : [];
            const id = await recordMemoryNode(summary, content, relatedTo, tags, 'test-session', testRoot);
            nodeIds.push(id);
        }
        // Double check node files were actually created
        const store = new NodeStore(testRoot);
        const node3 = await store.readMemoryNode(nodeIds[3]);
        expect(node3.summary).toBe('Fact 3: Detail topic mapping.');
        expect(node3.relatedTo).toEqual([nodeIds[2]]);
        // 2. Issue a recall context query starting from the middle node to check graph walk traversal
        const result = await recallMemoryContext('Fact 15', {
            maxSeedNodes: 1, // Start keyword search on exact match
            maxHops: 3, // BFS walk out by 3 hops
            tokenBudget: 3000,
            projectRoot: testRoot,
        });
        // 3. Verify single-call retrieval results
        expect(result.includedNodes.length).toBeGreaterThan(0);
        expect(result.totalTokensUsed).toBeGreaterThan(0);
        expect(result.truncated).toBe(false);
        // Verify correct BFS connectivity. Fact 15 links back to 14, 14 to 13, 13 to 12.
        const retrievedIds = result.includedNodes.map((n) => n.id);
        expect(retrievedIds).toContain(nodeIds[15]); // The seed match
        expect(retrievedIds).toContain(nodeIds[14]); // 1 hop away
        expect(retrievedIds).toContain(nodeIds[13]); // 2 hops away
        expect(retrievedIds).toContain(nodeIds[12]); // 3 hops away
    });
    it('should enforce tokenBudget limit on retrieval content', async () => {
        const nodeIds = [];
        const names = ['Zero', 'One', 'Two', 'Three', 'Four'];
        for (let i = 0; i < 5; i++) {
            const id = await recordMemoryNode(`Summary ${names[i]}`, `Content of node ${i} is long. 1234567890 1234567890 1234567890 1234567890`, i > 0 ? [nodeIds[i - 1]] : [], ['test-budget'], 'test-session', testRoot);
            nodeIds.push(id);
        }
        // Query starting from node 4 (which links to 3, 2, 1, 0)
        // Estimate tokens: each content is ~70 characters (approx 18 tokens).
        // Set tokenBudget low to force truncation.
        const result = await recallMemoryContext('Summary Four', {
            maxSeedNodes: 1,
            maxHops: 4,
            tokenBudget: 30, // Fits at most 1 or 2 nodes
            projectRoot: testRoot,
        });
        expect(result.truncated).toBe(true);
        expect(result.includedNodes.length).toBeLessThan(5);
        expect(result.frontierNodeIds.length).toBeGreaterThan(0);
    });
});
