# fix-2.md — round 2, derived from a timestamped session transcript

Builds on `fix.md`. That round's fixes are confirmed working in this transcript
(tiered safety gate, background process polling) — see the wins noted below before
the new issues. This transcript predates `token-efficiency-plan.md` being applied;
treat its numbers as the "before" baseline to compare against once that ships.

---

## Confirmed working (no action needed)
- Tiered safety gate: every tool call shows `tool_classify`, zero blanket `(y/N)`
  prompts in the entire session.
- Background process polling: `start_process`/`wait_process` used correctly for both
  `next build` calls — no retry-spam.

---

## Fix 1 — `skill_match` cost ~110 seconds of latency in one session (highest priority)

### Evidence
24 `skill_match` calls in this transcript, individually timed at 2071ms–11161ms.
Summed: **≈110,296ms, roughly 110 seconds**, for a task where the result was "yes,
caveman/ponytail apply" in nearly every case. Per-call latency in the multi-second
range is consistent with a real model round-trip, not a deterministic check.

### Two distinct problems
1. It's not deterministic yet — `token-efficiency-plan.md` Part A already specifies
   the fix (`selectActiveSkills()` as plain code, no LLM call). This transcript is
   the concrete evidence that fix needs to ship before anything else here.
2. It's re-run after **every tool call**, not once per task. Even once deterministic,
   recomputing 24 times for one task that doesn't change skill relevance mid-stream
   is wasted work.

### The fix (extends `token-efficiency-plan.md` Part A)
```ts
function getActiveSkillsForCurrentTask(
  taskId: string,
  cache: Map<string, SkillDefinition[]>,
  taskContext: TaskContext,
  projectMetadata: ProjectMetadata
): SkillDefinition[] {
  if (cache.has(taskId)) return cache.get(taskId)!;
  const skills = selectActiveSkills(taskContext, projectMetadata);
  cache.set(taskId, skills);
  return skills;
}
```
Compute once when a new user task begins, hold for every tool-call step within that
task, invalidate only when a genuinely new task starts.

### Acceptance criteria
- [ ] `skill_match`-equivalent step takes single-digit milliseconds, not seconds
- [ ] It appears at most once per user task in logs, not once per tool call
- [ ] Re-running this exact transcript's task should show total skill-selection time
      under 100ms combined, down from ~110,000ms

---

## Fix 2 — No host OS/shell awareness

### Evidence
Two separate trial-and-error cycles in one session: `rm -f` failed
("not recognized as an internal or external command"), discovered Windows, switched
to `if exist ... del /q`. Later, bash-style `curl` + `&` chaining failed
("Input redirection is not supported"), rediscovered Windows again, switched to
PowerShell. Same fact, learned twice, mid-session, at the cost of two failed
round-trips.

### The fix
Detect once, at harness startup, inject into the static cached prefix (never
re-derived per task):
```ts
function detectHostEnvironment(): { platform: NodeJS.Platform; shellHint: string } {
  const platform = process.platform;
  const shellHint = platform === "win32"
    ? "Windows — use cmd-compatible commands (dir, del, if exist) or explicit `powershell -Command \"...\"` for anything else"
    : "POSIX — use standard Unix commands (ls, rm, &&)";
  return { platform, shellHint };
}
```
One line added to `agent_system.txt`'s static content (or a tiny separate cached
block): `Host: <platform> — <shellHint>`.

### Acceptance criteria
- [ ] Zero "not recognized" / shell-mismatch failures in a fresh session on a given
      machine
- [ ] The host fact appears once, in the cached static prefix, not re-stated or
      re-discovered per task

---

## Fix 3 — Mid-session gotchas aren't being recorded to memory

### Evidence
`memory-system-plan.md` §5 already lists "a gotcha or non-obvious bug pattern was
discovered" as a `record_memory` trigger. This session hit two: the `__dirname` vs
`process.cwd()` fix under webpack bundling, and the Windows shell rediscovery.
Neither was recorded — only one memory node was written, at the very end, summarizing
the whole migration. Both gotchas are now undocumented and will likely be
rediscovered at full cost next time either resurfaces.

### The fix
This isn't a new mechanism — `record_memory` already exists and the trigger is
already specified. The gap is execution discipline. Add a direct line to
`skills/coding-efficiency/SKILL.md`:

> When you resolve a non-obvious bug or environment quirk mid-task (not just at task
> completion), call `record_memory` for that specific finding immediately — don't
> wait to fold it into an end-of-task summary, and don't let it go unrecorded because
> the overall task already gets a memory node.

### Also: build the `nextjs-conventions` skill now, not later
Two independent real gotchas have now been hit: async `params` (previous session)
and `__dirname` resolution under bundling (this session). That's enough evidence to
stop treating this as hypothetical. Seed it with both:

```
---
name: nextjs-conventions
description: Next.js projects — detected via package.json dependency on "next"
---
# Next.js-Specific Gotchas

- params/searchParams/cookies()/headers() are async since Next.js 15 — always await
  before accessing properties.
- Don't rely on __dirname for runtime file paths — webpack/Turbopack bundling
  doesn't preserve it reliably. Use process.cwd() or an explicitly passed root path.
```
Load it via the same deterministic `selectActiveSkills()` check from
`token-efficiency-plan.md` Part A (package.json dependency check), not a model call.
Append to this file every time a new Next.js-specific gotcha is discovered — this is
meant to grow.

### Acceptance criteria
- [ ] Mid-task gotchas produce their own memory node within the same turn they're
      resolved, not only as part of an end-of-task summary
- [ ] `skills/nextjs-conventions/SKILL.md` exists and is loaded automatically for any
      project with `next` in package.json

---

## Fix 4 — Mixed module syntax, and unresolved hedging about it

### Evidence
`lib/todos.js` mixed `require()` with `export function`, while the rest of the
codebase (`app/api/todos/route.js`, `app/page.jsx`) consistently uses `import`/
`export`. The agent's own thinking noticed the inconsistency and never resolved it
("Wait, actually this IS an issue... But wait — this works in Next.js because...
Let me just try building the project instead") — a second real-world instance of
caveman's "don't re-evaluate the same decision twice" rule being violated.

### The fix
This should already be substantially addressed by the planner-grounding fix from
`fix.md` (`planner_draft_system.txt` now reads `agent/code-conventions.md` before
proposing a plan) — module-syntax convention would be documented there. Treat this
as a thing to specifically verify in the next transcript, not a new mechanism to
build. If it recurs after that fix is live, add an explicit line to
`coding-efficiency`: "match the dominant import/export style already used in
sibling files before writing a new one."

### Acceptance criteria
- [ ] New files generated after the planner-grounding fix match the dominant module
      syntax of their directory
- [ ] No instance of a single file mixing `require()` and `export` going forward

---

## Fix 5 — Verification gaps: abandoned test script, unverified process cleanup

### Evidence
A Node smoke-test one-liner produced no output ("Command completed successfully
with no output" — likely a missing top-level await on the dynamic `import()`) and
was silently abandoned in favor of testing via `next build` instead, with no comment
that the original check was dropped. Separately, `Stop-Process -Name "node" -Force`
exited with code 1 and was treated as fine ("that's just from the force stop")
without confirming the dev server was actually stopped.

### The fix
Add to `coding-efficiency`:
> If a verification step produces an ambiguous or empty result, fix it or explicitly
> state you're abandoning it and why — don't silently move to a different check
> without comment.
>
> After stopping a process you started, verify it's actually stopped (re-check the
> port/process, don't assume a non-zero exit code means success without reading what
> it actually says).

### Acceptance criteria
- [ ] No silently-dropped verification steps in a session transcript
- [ ] A process-stop step is followed by a confirming check, not just an exit-code
      assumption

---

## Fix 6 — Caveats reasoned about privately should reach the user

### Evidence
The agent's thinking explicitly considered that `better-sqlite3`'s native bindings
could be a problem in serverless/edge deployment — resolved it for itself ("fine for
local dev") and never surfaced it in the final summary.

### The fix
Add to `coding-efficiency`:
> Terseness applies to filler, not to material caveats. If you privately reason
> through a real limitation or risk (deployment portability, a known edge case, a
> tradeoff the developer should know about), state it in one line in your response —
> don't resolve it silently and move on.

### Acceptance criteria
- [ ] A spot-check of 3 sessions involving a real architectural tradeoff shows the
      tradeoff mentioned in the final response, not only in the thinking block

---

## Priority order

| # | Issue | Why this order |
|---|---|---|
| 1 | `skill_match` latency + per-step re-run | 110s measured in one session — largest, already has a designed fix waiting |
| 2 | No OS/shell awareness | Cheap, mechanical, immediately measurable |
| 3 | Gotchas not recorded to memory + missing Next.js skill | Spec already covers it; execution gap plus one new skill to write |
| 4 | Mixed module syntax / unresolved hedging | Likely already mitigated by existing fix — verify, don't rebuild |
| 5 | Verification/cleanup gaps | Real but lower-frequency risk |
| 6 | Private caveats not surfaced | Lowest mechanical cost, real user-trust impact |