# fix.md — issues found in a live session transcript, and how to fix them

This document is derived from a real transcript of the harness running against
DeepSeek V4 Flash, migrating a small Node.js app to Next.js. Every issue below is
grounded in something that actually happened in that session, not a hypothetical.
Read the whole file before changing code — several fixes touch the same modules.

Fixes are ordered by severity, not by how easy they are. Fix 1 first regardless of
effort, because it's a safety issue, not a convenience one.

---

## Fix 1 — Safety gate treats every bash call identically (no tiering)

### What happened
Every single bash call in the transcript — including `ls node_modules/next` and a
harmless existence check — triggered the identical warning:

> ⚠️ [SAFETY WARNING] A dangerous action has been requested. Reason: All bash
> executions require manual confirmation.

Nine confirmations in one short session, all worded the same way, regardless of
whether the command was `ls` or `npm install`.

### Why this matters more than it looks like it does
This isn't just friction. `plan.md` §7 specifies three tiers (`safe` / `write` /
`dangerous`) precisely so that confirmation prompts stay rare enough to mean
something. When every command gets the same scary-looking warning, the realistic
outcome is the user starts reflexively approving without reading — which means the
one time a truly dangerous command shows up, it gets the same reflexive `y`. A safety
system that cries wolf on `ls` is actively worse than no safety system, because it
trains the exact behavior it exists to prevent.

### Root cause
The current implementation is not consulting a classifier at all — every bash
invocation is unconditionally routed to the confirmation path. There's no allowlist,
no denylist, no distinction.

### The fix
Implement the actual three-tier classifier:

```ts
type ToolRiskLevel = "safe" | "write" | "dangerous";

function classifyBashCommandRisk(command: string): ToolRiskLevel {
  // safe: read-only, no filesystem mutation, no network egress beyond package resolution
  // examples: ls, cat, node -v, npm ls, echo, pwd, git status, git log
  // write: mutates files inside the project root but isn't on the denylist
  // examples: npm install, npm run build, mkdir, mv (within project root)
  // dangerous: matches the denylist, OR resolves to a path outside the project root
  // examples: rm -rf, DROP, TRUNCATE, git push --force, anything piping a remote URL into sh/bash
}
```

- `safe` → execute immediately, no prompt, just log it
- `write` → execute immediately, but log with a diff/summary the user can review after the fact — no blocking prompt
- `dangerous` → the existing confirmation flow, unchanged

Start the `safe` allowlist conservatively (`ls`, `cat`, `pwd`, `node -v`, `npm ls`,
`git status`, `git log`, `echo`) and expand it as you observe more harmless commands
hitting `write` unnecessarily. Never move anything *out* of `dangerous` without a
deliberate decision — only grow the safe list, don't shrink the dangerous one.

### Acceptance criteria
- [ ] `ls`, `cat`, `node -v` style commands execute with zero prompts in a fresh
      session
- [ ] `npm install`, `npm run build` execute without blocking, but produce a logged
      entry showing what ran
- [ ] A denylist match (test with a deliberately harmless-looking but blocked
      pattern, e.g. a fake `rm -rf ./` in a throwaway test dir) still requires
      explicit confirmation
- [ ] Re-running the exact transcript from this document produces at most 1–2
      confirmation prompts total, not 9

---

## Fix 2 — No background-process polling, so the agent retries the same command

### What happened
```
⚙️ bash: npm install 2>&1
✔️ "[Process is running in background] Output so far: "      (empty)
⚙️ bash: npm install 2>&1                                      ← same command again
✔️ "[Process is running in background] Output so far: "      (empty, again)
⚙️ bash: npm install --prefer-offline 2>&1                    ← changed flags, still guessing
✔️ "[Process is running in background] Output so far: "      (empty, again)
```

Five attempts at essentially the same command before output finally appeared. The
install that eventually "succeeded" only pulled in 15 packages — suspiciously few for
Next.js + React, which normally resolves 300+ transitive dependencies. The agent
noticed ("That doesn't seem right for Next.js") and then proceeded anyway, having only
checked that `node_modules/next` existed — not that the install was actually
complete or uncorrupted.

### Why this happened
The only tool available for running a shell command is a single `bash` call that
sometimes returns before the command finishes, labeled "running in background." There
is no way to check on that *same* process afterward — so the agent's only available
action is to re-issue the original command, which is ambiguous (does it attach to the
existing process, or start a competing second one?) and wasteful regardless.

### Quantified cost of this bug
From the actual session: the install-and-build verification phase accounted for **62%
of the entire session's cost** ($0.0071 of $0.0114 total). The first five identical
`npm install` attempts alone, before the agent changed approach, cost roughly **$0.003
— over a quarter of the whole session — for zero new information gained.**

### The fix
Replace the single ambiguous `bash` tool's background behavior with an explicit
job-handle model:

```ts
function startBackgroundProcess(command: string): { jobId: string }

function checkBackgroundProcessStatus(jobId: string): {
  running: boolean;
  exitCode: number | null;
  newOutputSinceLastCheck: string;
}

function waitForBackgroundProcess(
  jobId: string,
  timeoutMs: number
): { completed: boolean; exitCode: number | null; output: string }
```

- `startBackgroundProcess` always returns immediately with a `jobId` — never blocks,
  never silently runs synchronously.
- `checkBackgroundProcessStatus` is what the agent calls to "check in" — it polls
  the *same* process by id, never starts a new one.
- Instruct the agent (via the system prompt or a skill) to use
  `waitForBackgroundProcess` with a reasonable timeout (e.g. 10–15s) and loop calling
  it rather than re-issuing the original command. A few longer waits cost far less
  than many short retries, since each tool round-trip re-sends the full system prompt
  and history.
- `npm install`, `npx next build`, and any other command expected to take more than a
  couple seconds should route through this path by default rather than the plain
  synchronous `bash` tool.

### Also fix: verify install completion properly
Don't infer success from `ls node_modules/<package>` existing. Check the actual exit
code from `waitForBackgroundProcess`, and where possible cross-check against
`package-lock.json` (does it exist and is it non-trivial in size) rather than spot
-checking one directory.

### Acceptance criteria
- [ ] Re-running the transcript's `npm install` step produces exactly one
      `startBackgroundProcess` call followed by polling via
      `checkBackgroundProcessStatus`/`waitForBackgroundProcess` — never a second,
      identical `startBackgroundProcess` call for the same logical operation
- [ ] Install completion is verified via exit code, not directory existence alone
- [ ] A deliberately slow command (`sleep 20 && echo done`) completes correctly
      through the polling path without the agent re-issuing it

---

## Fix 3 — `record_memory` flagged as "Unrecognized tool" despite working correctly

### What happened
```
⚙️ Executing "record_memory" with input: {...}
⚠️ [SAFETY WARNING] Reason: Unrecognized tool "record_memory"
   Do you want to allow this action? (y/N): y
✔️ "Memory node successfully recorded with ID: mem_2026-06-21_..."
```

The tool ran successfully and returned a real result, despite being labeled
unrecognized.

### Root cause
The safety classifier and the tool dispatcher are checking against two different
tool registries that have drifted out of sync — `record_memory` is registered with
the dispatcher (it executed and returned a valid result) but missing from whatever
list the safety layer checks for known tools.

### The fix
Both the dispatcher and the safety classifier must read from a single shared tool
registry — there should be exactly one place in the codebase that lists "what tools
exist," and both subsystems import from it. If a tool call doesn't match an entry in
that registry, the call should fail outright rather than execute with a misleading
warning.

```ts
const TOOL_REGISTRY: ToolDefinition[] = [
  readFileTool,
  writeFileTool,
  bashTool,
  grepTool,
  globTool,
  searchMemoryTool,
  recallMemoryTool,
  recordMemoryTool,
  getMemoryNodeTool,
  // ...
];
```

Both `classifyToolCallRisk()` and the dispatcher's execution path should derive their
knowledge of valid tools from this single array, not from separate hardcoded lists.

### Acceptance criteria
- [ ] Every tool the dispatcher can execute also appears correctly classified by the
      safety layer — write a test that diffs the dispatcher's tool list against the
      classifier's known list and fails if they're not identical
- [ ] Calling a genuinely unregistered tool name fails the call outright, with a
      clear error — it does not execute and return a result

---

## Fix 4 — Thinking output is verbose; caveman/ponytail skills don't appear to be constraining it

### What happened
The "Thinking Process" blocks in the transcript are long and exploratory — repeated
hedging ("Let me also... actually, let me just... let me think about this
differently"), restating the same plan multiple ways before settling. This is the
pattern the caveman and ponytail skills exist to cut, but it doesn't look like either
is meaningfully constraining the model's output here.

### The fix — verify before rewriting
First, confirm whether the skills are actually present in what gets sent to the
model. Add a one-time debug log that dumps the fully assembled system prompt for a
single request, and grep it for the caveman/ponytail skill content. Two possible
outcomes:

1. **The skill text isn't in the prompt at all** — a loader bug. Check that the
   skill-matching step in `skills/` is actually selecting these skills for a coding
   task (their `description` frontmatter needs to match generically enough to apply
   broadly, not just to narrow keyword cases).
2. **The skill text is present, but not being followed** — a wording/strength
   problem. Make the instruction more directive and specific rather than a general
   style suggestion — e.g., explicitly instruct "do not restate the plan more than
   once in your reasoning; settle on an approach and move to action" rather than a
   vaguer "be concise" framing.

### Acceptance criteria
- [ ] A logged system prompt confirms caveman/ponytail content is present for a
      coding task
- [ ] A re-run of a comparable multi-file generation task shows materially shorter
      thinking blocks (rough target: cut thinking-block token count by at least a
      third) with no loss of correctness in the resulting code

---

## Fix 5 — Metrics conflate model latency with tool-execution latency

### What happened
`Speed: 5.0 t/s` and similar very low numbers appear during the npm install/build
steps — not because the model was slow to generate, but because the bash subprocess
itself took several seconds and that time is being folded into the same latency
figure used to compute tokens/sec.

### The fix
Track and report two separate latency figures per turn instead of one:

```ts
interface TurnMetrics {
  modelLatencyMs: number;        // time spent waiting on the provider's completion
  toolExecutionLatencyMs: number; // time spent executing tool calls this turn
  tokensPerSecond: number;        // computed from outputTokens / modelLatencyMs only
}
```

Display both in the metrics line, and compute `Speed` from `modelLatencyMs` alone so
it reflects actual model throughput, not how long a shell command happened to take.

### Acceptance criteria
- [ ] A turn that includes a slow tool call (e.g. a deliberate `sleep 10`) still
      reports a normal, accurate tokens/sec figure for the model's own generation
- [ ] The metrics line visibly separates model time from tool time

---

## Priority summary

| # | Issue | Severity | Effort |
|---|---|---|---|
| 1 | Blanket bash confirmation | High — safety/trust | Low |
| 2 | No background-process polling | High — cost (62% of a session) | Medium |
| 3 | Tool registry drift (`record_memory`) | Medium — correctness/trust | Low |
| 4 | Verbose thinking, skills not constraining output | Medium — cost/quality | Low–Medium |
| 5 | Latency metric conflation | Low — observability only | Low |

Fix 1 and 3 first — both are cheap and both are about the safety/trust system telling
the truth. Fix 2 next, since it's the largest quantified cost. Fix 4 and 5 can follow
once the above are stable.