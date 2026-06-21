# memory-system-plan.md — project memory graph: full context and build spec

This document is the complete context for implementing the **memory graph** feature.
It extends `plan.md` §9 with full implementation detail. Read it fully before writing
any code. If anything here conflicts with `plan.md`, this document wins for anything
related to memory specifically — `plan.md` remains authoritative for everything else.

---

## 1. The single most important requirement

Memory must be retrievable through **one deterministic tool call** that performs the
entire graph traversal internally and returns the complete relevant context in its
return value. The agent must never need a sequence of "get this node → look at its
edges → decide which related node to fetch next → call again" round-trips to backtrack
through the graph. Every extra round-trip re-sends the full system prompt and
conversation history, which is the opposite of token-efficient. The traversal logic —
the actual graph-walking — lives entirely in plain, deterministic code, not in a
sequence of LLM-driven tool calls.

If your implementation requires the agent to call a memory tool more than once to
answer a single information need, you have built this wrong. There is one correct
exception, described in §6.3 (the optional drill-down escape hatch), which is
opt-in and rare, not the normal path.

---

## 2. Memory is not the project prompt, and it is not a session — keep these three separate

This project already has two other context sources. Do not conflate any of them with
memory. They are different systems with different lifecycles, different mutability,
and different loading behavior.

| | Project prompt | Session | Memory graph (this document) |
|---|---|---|---|
| **What it is** | Static onboarding document for the project | An append-only transcript of one unit of work | Structured, accumulated knowledge about the project |
| **Content** | Code quality standards, folder structure conventions, project use case, tech stack, conventions | Raw turn-by-turn conversation messages (user + assistant + tool calls) | Distilled facts, decisions, gotchas, and the relationships between them |
| **When it's written** | Once, at project setup; edited manually, rarely | Continuously, as a side effect of working | Incrementally, via deliberate tool calls when something worth remembering happens |
| **When it's loaded** | Every single request, in full, as a static cache-friendly prefix | Only the currently active session's own history | Never loaded in full — a lightweight index is always present; full content is pulled on demand, one node or one connected cluster at a time |
| **Mutability** | Rarely changes | Append-only, never edited after the fact | Append-only at the node level; edges can be added later, content of an existing node should not be rewritten |
| **Scope** | One file per project | One folder per work session, many sessions per project | One graph per project, shared across every session and every fork of that project |
| **Forking behavior** | N/A — same prompt for every session | A fork copies the parent's message history up to the fork point into a new session | Memory is **not** forked — it's project-global. Every session and every fork reads and writes the same shared graph. |

If you are about to write code that loads the project prompt or a session transcript
through a function named anything containing "memory," stop — that's the wrong file.

---

## 3. Data model

No graph database. A node is a small JSON file; the edges are just an array of IDs on
each node. This is intentionally the simplest structure that satisfies the traversal
requirement in §1 — do not introduce a graph database, a vector store, or any other
heavier dependency unless this structure is proven insufficient in practice.

```
<project>/.agent/memory/
  nodes/
    <node-id>.json
  index.json
```

### 3.1 Node shape (`nodes/<node-id>.json`)

```ts
interface MemoryNode {
  id: string;                  // e.g. "mem_2026-06-21_001"
  summary: string;             // one line, shown in the index, used for keyword matching
  content: string;             // the full detail — only loaded when this node is pulled in
  tags: string[];               // free-form topic tags, e.g. ["auth", "rate-limiting"]
  relatedTo: string[];          // ids of other nodes this one is connected to
  createdAt: string;            // ISO timestamp
  sourceSessionId: string | null; // which session produced this node, if any
}
```

### 3.2 Index shape (`index.json`)

The index is the only thing always loaded into context. It must stay small — summary
and tags only, never `content`.

```ts
type MemoryIndex = {
  id: string;
  summary: string;
  tags: string[];
}[];
```

`index.json` is rebuilt (or incrementally appended to) every time `recordMemoryNode`
runs — it is a derived cache of the `nodes/` directory, not a separate source of
truth. If it ever drifts out of sync with `nodes/`, regenerating it from the node
files must be a one-line operation.

---

## 4. The tool surface exposed to the agent

Three tools. The first is read-light, the second is the main one and does the full
traversal, the third writes.

### 4.1 `search_memory` — cheap, index-only, for quick existence checks

```ts
function searchMemoryIndexByKeyword(
  query: string,
  maxResults: number = 8
): MemoryIndexMatch[]
```

Searches `index.json` only — summaries and tags, never node content. Plain substring
or token-overlap scoring. No embeddings, no semantic search, no external calls. This
exists for cases where the agent just wants to know "does something like this already
exist" without pulling full content yet.

### 4.2 `recall_memory` — THE primary tool, single call, full traversal

```ts
function recallMemoryContext(
  query: string,
  options?: {
    maxSeedNodes?: number;     // default 3 — how many top keyword matches to start from
    maxHops?: number;          // default 2 — how far to walk relatedTo edges from each seed
    tokenBudget?: number;      // default MAX_MEMORY_RECALL_TOKENS — hard ceiling on returned content
  }
): MemoryRecallResult
```

This is the tool the agent should reach for almost every time it needs project memory.
Internally, in one function call with no LLM involvement in the traversal itself:

1. **Seed.** Run the same keyword scoring as `searchMemoryIndexByKeyword` against
   `index.json` to find the top `maxSeedNodes` starting points.
2. **Expand.** From each seed, walk `relatedTo` edges breadth-first, up to `maxHops`
   hops out. Track visited node ids to avoid revisiting and to avoid infinite loops on
   cyclic edges.
3. **Rank and trim.** Sort visited nodes by a simple relevance score (hop distance
   from nearest seed, ties broken by recency). Walk down this ranked list, pulling
   full `content` from `nodes/<id>.json` and accumulating it into the result, stopping
   the moment the running total would exceed `tokenBudget`. Do not cut a node's
   content mid-way through — a node is either fully included or excluded.
4. **Return.** A single structured result:

```ts
interface MemoryRecallResult {
  includedNodes: { id: string; summary: string; content: string }[];
  frontierNodeIds: string[]; // one hop beyond what was included — NOT auto-fetched
  totalTokensUsed: number;
  truncated: boolean;        // true if tokenBudget cut off further expansion
}
```

`frontierNodeIds` is informational only — it tells the agent what's just outside the
returned context, for the rare case described in §6.3. It is not a prompt for the
agent to immediately go fetch them; most tasks are answered fully by `includedNodes`.

### 4.3 `record_memory` — writes a new node

```ts
function recordMemoryNode(
  summary: string,
  content: string,
  relatedToIds: string[],
  tags: string[],
  sourceSessionId: string | null
): string // returns the new node's id
```

Writes `nodes/<new-id>.json`, appends `{id, summary, tags}` to `index.json`. No
embeddings computed, no automatic linking — `relatedToIds` must be explicit. If the
agent doesn't know what a new node relates to, it should call `search_memory` first to
find candidates, then pass those ids in deliberately. Edges are never inferred
automatically in v1.

---

## 5. When the agent should write memory

This is a behavioral instruction, not a mechanism — bake it into the project prompt or
a dedicated skill, not into the memory code itself. The memory system should never
write automatically or silently in the background; every node is the result of an
explicit, intentional tool call, so the graph stays auditable and the agent stays
accountable for what it chose to remember.

Reasonable triggers to instruct the agent on:
- A non-trivial decision was made and the reasoning behind it should survive past this
  session (e.g., "we chose library X over Y because...")
- A gotcha or non-obvious bug pattern was discovered
- A plan (from the `/plan` workflow) completed — record a short outcome node, linked
  to whatever it touched
- The user explicitly says "remember this" or equivalent

Do not instruct the agent to record routine, low-value information (e.g., "renamed a
variable") — that's noise that degrades the index's signal-to-noise ratio, which
defeats the entire point of building a graph instead of just keeping the raw
transcript.

---

## 6. Explicit non-goals for v1

1. **No embeddings or vector search.** Keyword/substring matching against `index.json`
   is the only retrieval method. Revisit only if keyword matching is demonstrably
   insufficient in practice — don't pre-build for a problem you haven't hit yet.
2. **No automatic edge inference.** Edges (`relatedTo`) are always explicit, set at
   write time by whatever calls `recordMemoryNode`. No background job computes
   similarity and links nodes on its own.
3. **No cross-project memory.** Each project's `.agent/memory/` is self-contained.
   Nothing is shared or queried across project boundaries.
4. **No node editing.** Nodes are append-only once written. If something is later
   found to be wrong or outdated, record a new node that supersedes it and link the
   two — don't mutate history.

### 6.3 The one allowed exception to "single call"

If `recall_memory` returns `truncated: true` or the agent has a specific id from
`frontierNodeIds` it deliberately wants in full, a fourth, narrow tool may be used:

```ts
function getMemoryNodeById(id: string): MemoryNode
```

This is a deliberate, occasional drill-down for a specific known id — not a substitute
for `recall_memory`, and not something the agent should reach for by default. If you
find the agent calling this routinely after every `recall_memory`, that's a sign
`maxHops` or `tokenBudget` defaults need tuning, not that this tool needs to become the
primary path.

---

## 7. Token efficiency — concrete, testable requirements

- Define `MAX_MEMORY_RECALL_TOKENS` as a named constant in `config/`, not a magic
  number inline in the traversal function.
- Every call to `recallMemoryContext` must log: query, number of seed nodes, number of
  nodes included, `totalTokensUsed`, and whether `truncated` was true. This is for
  measurement, per the project's own principle of verifying cost claims with real
  numbers rather than assuming a design works.
- Acceptance test: construct a memory graph of at least 30 connected nodes in a test
  fixture, issue a `recall_memory` call, and confirm the entire relevant answer is
  present in a single `MemoryRecallResult` without needing a follow-up call — this is
  the concrete check for the requirement in §1.

---

## 8. File/function summary (for quick reference while implementing)

```
src/memory/
  types.ts              MemoryNode, MemoryIndex, MemoryRecallResult, MemoryIndexMatch
  index-store.ts         loadMemoryIndex(), appendToMemoryIndex()
  node-store.ts           readMemoryNode(id), writeMemoryNode(node)
  keyword-search.ts       searchMemoryIndexByKeyword(query, maxResults)
  graph-traversal.ts      walkRelatedNodesBreadthFirst(seedIds, maxHops) — pure, no I/O beyond reading nodes already loaded
  recall.ts               recallMemoryContext(query, options) — orchestrates the above three into the single-call tool
  record.ts               recordMemoryNode(summary, content, relatedToIds, tags, sourceSessionId)
  tools.ts                wraps the above as agent-callable tool definitions: search_memory, recall_memory, record_memory, get_memory_node
```

Keep `graph-traversal.ts` pure (input: node ids + a way to read edges, output: visited
set) so it can be unit-tested without touching the filesystem — feed it an in-memory
fixture graph in tests rather than real files on disk.

---

## 9. Definition of done

- [ ] `recall_memory` answers a realistic query against a 30+ node test graph in one
      call, with no follow-up tool calls needed
- [ ] `index.json` never contains `content` — only `id`, `summary`, `tags`
- [ ] `tokenBudget` is enforced and never silently exceeded
- [ ] Memory is confirmed shared and identical across two forked sessions of the same
      project — forking does not duplicate or fork the memory graph
- [ ] No embeddings, no vector store, no automatic edge inference anywhere in the
      implementation
- [ ] Every `recordMemoryNode` call traces back to an explicit, identifiable trigger
      (a decision, a gotcha, a completed plan, or a user request) — none are
      unexplained or automatic
- [ ] Project prompt loading code and session loading code share zero functions with
      memory loading code — the three systems are implemented in fully separate
      modules per §2