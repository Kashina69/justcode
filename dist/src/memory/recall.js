import { NodeStore } from './node-store.js';
import { IndexStore } from './index-store.js';
import { searchMemoryIndexByKeyword } from './keyword-search.js';
import { walkRelatedNodesBreadthFirst } from './graph-traversal.js';
import { MAX_MEMORY_RECALL_TOKENS } from '../config/index.js';
import { SessionLogger } from './logger.js';
/**
 * Estimates the token count of a given string using character-based approximation (~4 chars/token).
 */
export function estimateTokens(text) {
    return Math.ceil(text.length / 4);
}
/**
 * Orchestrates keyword matching, BFS traversal, relevance ranking, and token budgeting.
 * Performs memory retrieval in a single deterministic execution.
 *
 * @param query Search query containing topic keywords.
 * @param options Query constraints (max seeds, max hops, token budget, target project root).
 * @returns Resolves to MemoryRecallResult detailing included nodes and frontiers.
 */
export async function recallMemoryContext(query, options = {}) {
    const maxSeedNodes = options.maxSeedNodes ?? 3;
    const maxHops = options.maxHops ?? 2;
    const tokenBudget = options.tokenBudget ?? MAX_MEMORY_RECALL_TOKENS;
    const projectRoot = options.projectRoot ?? process.cwd();
    const nodeStore = new NodeStore(projectRoot);
    const indexStore = new IndexStore(projectRoot);
    const index = await indexStore.loadMemoryIndex();
    const seedMatches = searchMemoryIndexByKeyword(index, query, maxSeedNodes);
    const seedIds = seedMatches.map((m) => m.id);
    if (seedIds.length === 0) {
        SessionLogger.getInstance().logSystem(`[Memory Recall] Query: "${query}" | Seeds: 0 | Included: 0 | Tokens: 0 | Truncated: false`);
        return {
            includedNodes: [],
            frontierNodeIds: [],
            totalTokensUsed: 0,
            truncated: false,
        };
    }
    const getNodeEdges = async (id) => {
        try {
            const node = await nodeStore.readMemoryNode(id);
            return node.relatedTo;
        }
        catch {
            return [];
        }
    };
    const { visited, frontier } = await walkRelatedNodesBreadthFirst(seedIds, maxHops, getNodeEdges);
    const loadedVisited = [];
    for (const [id, hop] of visited.entries()) {
        try {
            const node = await nodeStore.readMemoryNode(id);
            loadedVisited.push({ hop, node });
        }
        catch {
            // Ignore missing files
        }
    }
    // Sort by hop distance (ascending), then by creation date (descending)
    loadedVisited.sort((a, b) => {
        if (a.hop !== b.hop) {
            return a.hop - b.hop;
        }
        return new Date(b.node.createdAt).getTime() - new Date(a.node.createdAt).getTime();
    });
    const includedNodes = [];
    const frontierNodeIdsSet = new Set(frontier);
    let totalTokensUsed = 0;
    let truncated = false;
    for (const item of loadedVisited) {
        const nodeTokens = estimateTokens(item.node.content);
        if (totalTokensUsed + nodeTokens <= tokenBudget) {
            includedNodes.push({
                id: item.node.id,
                summary: item.node.summary,
                content: item.node.content,
            });
            totalTokensUsed += nodeTokens;
        }
        else {
            truncated = true;
            frontierNodeIdsSet.add(item.node.id);
        }
    }
    const frontierNodeIds = Array.from(frontierNodeIdsSet);
    SessionLogger.getInstance().logSystem(`[Memory Recall] Query: "${query}" | Seeds: ${seedIds.length} | Included: ${includedNodes.length} | Tokens: ${totalTokensUsed} | Truncated: ${truncated}`);
    return {
        includedNodes,
        frontierNodeIds,
        totalTokensUsed,
        truncated,
    };
}
