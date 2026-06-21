export interface MemoryNode {
  id: string;                  // e.g. "mem_2026-06-21_001"
  summary: string;             // one line, shown in the index, used for keyword matching
  content: string;             // the full detail — only loaded when this node is pulled in
  tags: string[];              // free-form topic tags, e.g. ["auth", "rate-limiting"]
  relatedTo: string[];         // ids of other nodes this one is connected to
  createdAt: string;           // ISO timestamp
  sourceSessionId: string | null; // which session produced this node, if any
}

export type MemoryIndex = {
  id: string;
  summary: string;
  tags: string[];
}[];

export interface MemoryIndexMatch {
  id: string;
  summary: string;
  tags: string[];
  score: number;
}

export interface MemoryRecallResult {
  includedNodes: { id: string; summary: string; content: string }[];
  frontierNodeIds: string[]; // one hop beyond what was included — NOT auto-fetched
  totalTokensUsed: number;
  truncated: boolean;        // true if tokenBudget cut off further expansion
}
