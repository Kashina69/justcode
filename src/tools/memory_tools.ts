import { Tool } from './types.js';
import { IndexStore } from '../memory/index-store.js';
import { NodeStore } from '../memory/node-store.js';
import { searchMemoryIndexByKeyword } from '../memory/keyword-search.js';
import { recallMemoryContext } from '../memory/recall.js';
import { recordMemoryNode } from '../memory/record.js';

export class SearchMemoryTool implements Tool {
  definition = {
    name: 'search_memory',
    description: 'Searches the memory index cache by keyword to identify matching node summaries and tags.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query topic keywords.',
        },
        maxResults: {
          type: 'number',
          description: 'The maximum matches to return (default 8).',
        },
      },
      required: ['query'],
    },
  };

  async execute(args: { query: string; maxResults?: number }): Promise<string> {
    const store = new IndexStore();
    const index = await store.loadMemoryIndex();
    const matches = searchMemoryIndexByKeyword(index, args.query, args.maxResults);
    return JSON.stringify(matches, null, 2);
  }
}

export class RecallMemoryTool implements Tool {
  definition = {
    name: 'recall_memory',
    description: 'Retrieves relevant memory node content clusters by executing a keyword search and BFS graph expansion.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The query topic keywords to seed the search.',
        },
        maxSeedNodes: {
          type: 'number',
          description: 'Maximum seed nodes to expand from (default 3).',
        },
        maxHops: {
          type: 'number',
          description: 'Maximum hops to walk (default 2).',
        },
        tokenBudget: {
          type: 'number',
          description: 'Max token budget for returned content (default 4000).',
        },
      },
      required: ['query'],
    },
  };

  async execute(args: { query: string; maxSeedNodes?: number; maxHops?: number; tokenBudget?: number }): Promise<string> {
    const result = await recallMemoryContext(args.query, {
      maxSeedNodes: args.maxSeedNodes,
      maxHops: args.maxHops,
      tokenBudget: args.tokenBudget,
    });
    return JSON.stringify(result, null, 2);
  }
}

export class RecordMemoryTool implements Tool {
  definition = {
    name: 'record_memory',
    description: 'Records a new structured memory node and links it to existing related nodes.',
    inputSchema: {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          description: 'One-line summary description of the fact or decision.',
        },
        content: {
          type: 'string',
          description: 'Detailed content body of the memory.',
        },
        relatedTo: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of related memory node ID strings.',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Free-form topic tags.',
        },
        sourceSessionId: {
          type: 'string',
          description: 'Source session ID context (optional).',
        },
      },
      required: ['summary', 'content', 'relatedTo', 'tags'],
    },
  };

  async execute(args: {
    summary: string;
    content: string;
    relatedTo: string[];
    tags: string[];
    sourceSessionId?: string | null;
  }): Promise<string> {
    const id = await recordMemoryNode(
      args.summary,
      args.content,
      args.relatedTo,
      args.tags,
      args.sourceSessionId || null
    );
    return `Memory node successfully recorded with ID: ${id}`;
  }
}

export class GetMemoryNodeTool implements Tool {
  definition = {
    name: 'get_memory_node',
    description: 'Retrieves a single memory node by its exact ID string for drill-down.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'The exact Memory Node ID.',
        },
      },
      required: ['id'],
    },
  };

  async execute(args: { id: string }): Promise<string> {
    try {
      const store = new NodeStore();
      const node = await store.readMemoryNode(args.id);
      return JSON.stringify(node, null, 2);
    } catch {
      return `Error: Memory node with ID "${args.id}" was not found on disk.`;
    }
  }
}
