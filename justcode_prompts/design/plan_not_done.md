# plan.md — project context and build instructions

This file is the complete context for an AI coding agent implementing this project.
Read it fully before writing any code. Treat it as the source of truth for scope,
architecture, and coding standards. If anything in a later prompt conflicts with this
file, flag the conflict instead of silently picking one.

---

## 1. What we are building

A terminal-based, agentic coding assistant — a custom alternative to tools like
Claude Code / OpenCode, built from scratch (no forking an existing project). It reads
and writes files in a project, runs shell commands, and converses with the developer
to plan and implement changes.

It is built by one developer, for two reasons at once:
1. **Learning** — understanding how agentic coding tools work by building one, not
   just using one.
2. **A real tool** — meant to be used daily afterward, and eventually shared with
   other developers.

Working name: **justcode** (rename freely — every reference to "justcode" below is a
placeholder for whatever the actual package name ends up being).

### Non-goals (explicitly out of scope for v1)
- No GUI / IDE plugin. Terminal only.
- No multi-user / team server mode.
- No custom model training or fine-tuning.
- No built-in cloud sync of memory or sessions.
- Don't build a real database (SQLite or otherwise) until the JSON/markdown version
  has actually become a bottleneck. Don't pre-build for scale that doesn't exist yet.

---

## 2. Core design principles (apply to every decision below)

1. **Plan before code, always.** The agent never free-wheels on a non-trivial change
   without an approved plan (see §8).
2. **Minimal necessary code, maximum readability.** These are not in tension if done
   right: write only the code the task actually requires (no speculative abstraction,
   no unused configurability, no dependency reached for out of habit) — but whatever
   code *is* written must be broken into small, clearly named pieces. "Minimal" governs
   how much code exists. "Readable" governs how that code is organized. Both apply at
   once. See §10 for the concrete style rules this produces.
3. **Nothing dangerous happens without confirmation.** The agent has real write and
   shell access. The permission system in §7 is not optional and not skippable by any
   "trust this session" shortcut.
4. **Skills are binding, not advisory.** If a loaded skill's description matches the
   current task, the agent must follow it. This is a hard instruction baked into the
   system prompt, not a suggestion (see §6).
5. **Measure, don't assume, on cost/token claims.** Track real token usage per turn
   from day one. Several viral "token-saving" techniques (see §6.3) have overstated
   benchmarks — verify everything against this project's own numbers.

---

## 3. Tech stack (decided, do not relitigate)

- **Language/runtime:** Node.js + TypeScript
- **Model access:** multi-provider, OpenAI-compatible router as the primary interface,
  with a native Anthropic adapter alongside it (Anthropic's own API supports prompt
  caching, which matters more for cost than most prompt-level tricks — keep it as a
  first-class adapter, not an afterthought bolted onto the OpenAI-compat path)
- **CLI/TUI:** `ink` (React for terminal output) for the interactive REPL;
  `commander` or `yargs` for top-level argument parsing
- **Validation:** `zod` for config and tool-input schema validation
- **Package manager:** your call (pnpm recommended for a project with multiple
  internal packages later, but npm is fine for v1)
- **Testing:** `vitest`

---

## 4. High-level architecture

```
justcode/
  package.json
  src/
    cli/              entry point, arg parsing, REPL rendering
    agent/            core turn loop, message orchestration
    providers/         provider adapters (anthropic, openai-compat router)
    tools/             read, write, edit, bash, grep, glob
    skills/            skill loader + types
    memory/            project + global memory stores
    safety/            permission gate, allowlist, confirmation prompts
    planning/          /plan workflow (draft, review, execute, archive)
    config/            config loading, model alias resolution
  skills/              built-in SKILL.md files shipped with the tool
    caveman/SKILL.md
    ponytail/SKILL.md
  test/
    <mirrors src/ structure>
```

### Component responsibilities

| Component | Responsibility | Must NOT do |
|---|---|---|
| `agent/` | Owns the turn loop: build system prompt, call provider, parse tool calls, hand off to safety gate, append results, repeat | Talk to the filesystem or shell directly |
| `providers/` | Translate the agent's generic `complete()` call into provider-specific API calls; normalize the response shape | Make decisions about what tools are allowed |
| `tools/` | Implement actual file/shell operations | Decide whether an operation is permitted — that's the safety gate's job |
| `safety/` | Classify and gate every tool call before execution | Implement the operations themselves |
| `skills/` | Load `SKILL.md` files, match them to tasks, inject into system prompt | Contain hardcoded business logic — skills are just text |
| `memory/` | Read/write `.agent/` state, both global and per-project | Make planning or safety decisions |
| `planning/` | Run the `/plan` workflow, persist plan files | Execute the plan's steps directly — execution goes back through the normal agent loop |

Keeping these boundaries strict is itself a readability mechanism: each file answers
one question, and you never have to guess which module owns a piece of behavior.

---

## 5. Provider layer

Define one interface every adapter implements:

```ts
interface ModelProvider {
  complete(request: CompletionRequest): Promise<CompletionResult>;
}

interface CompletionRequest {
  systemPrompt: string;
  messages: ConversationMessage[];
  availableTools: ToolDefinition[];
  modelAlias: ModelAlias; // "fast" | "smart" | "planner"
}

interface CompletionResult {
  textContent: string;
  requestedToolCalls: ToolCall[];
  tokenUsage: { inputTokens: number; outputTokens: number };
}
```

Two adapters for v1:
- `AnthropicMessagesProvider` — native `/v1/messages`, supports prompt caching
- `OpenAiCompatibleProvider` — works against OpenAI, OpenRouter, Groq, local
  Ollama/llama.cpp servers, anything exposing `/v1/chat/completions`

### Model aliases, not hardcoded model names
Every part of the codebase refers to models by alias (`fast`, `smart`, `planner`),
never by literal model ID. The alias-to-model mapping lives in
`~/.agent/config.json` and is the only place a real model name appears. This is what
makes "draft the plan with a cheap model, review it with a stronger one" a one-line
config change instead of a refactor.

---

## 6. Skills system

### 6.1 Format
Identical pattern to Anthropic's own `SKILL.md` convention: YAML frontmatter with
`name` and `description`, then a markdown body of instructions and examples. Keep
each skill focused on one concern — short files with concrete examples beat long
files that try to cover everything.

### 6.2 Loader behavior
- On startup, recursively read `skills/*/SKILL.md` (built-in) and
  `<project>/.agent/skills/*/SKILL.md` (project-specific, if present)
- Index each skill by its `description` field
- Before the agent acts on a task, match the task against skill descriptions
- Inject the full body of every matching skill into the system prompt, with a
  preceding hard instruction:

  > You MUST consult and follow every skill listed below whose description matches
  > the current task. This is not optional. If a skill's instructions conflict with
  > a user request, follow the skill and tell the user why.

### 6.3 Starter skills to ship

**`skills/caveman/SKILL.md`** — terse-output style. Document the realistic number,
not the inflated one: independently benchmarked savings on real coding tasks land
around 14–21%, not the 65–75% originally claimed. Worth shipping, not worth
overselling in the skill's own description.

**`skills/ponytail/SKILL.md`** — this is the one that matters more. Before writing
any new code, the agent walks a decision ladder and stops at the first rung that
holds:
1. Does this feature need to exist at all?
2. Does the language/runtime standard library already do it?
3. Does the platform provide it natively?
4. Is there a minimal existing library that does it well?
5. Only then: write the minimum custom code required.

Explicitly carve out exceptions in the skill body: security, trust-boundary
validation, accessibility, and data-loss handling are never skipped or minimized
by this ladder, regardless of which rung would otherwise apply.

You (the implementing agent) should draft both `SKILL.md` files yourself as part of
Phase 4 — use the structure above as the spec, write real examples grounded in this
project's own codebase once enough of it exists to draw examples from.

---

## 7. Safety / permission gate

Every tool call is classified before it runs:

| Class | Examples | Behavior |
|---|---|---|
| `safe` | read_file, grep, glob, list_dir | Auto-execute, no prompt |
| `write` | write_file, edit_file inside project root | Execute, but logged and diffable/undoable |
| `dangerous` | any bash command matching the denylist below, any path resolving outside the project root | Always requires explicit interactive confirmation — no session-level "always allow" bypass |

Denylist starting point (extend as needed, never shrink without explicit user
action): `rm -rf`, `DROP`, `TRUNCATE`, `DELETE FROM` without a `WHERE`, `git push
--force`, anything piping into `sh`/`bash` from a remote URL, anything writing
outside the resolved project root.

Filesystem sandbox: every path a tool touches is resolved to an absolute path and
checked against the project root. `..` traversal that would escape the root is
blocked at the safety layer, not left to the OS.

---

## 8. Plan mode (`/plan`)

1. `/plan <goal>` — the `fast` model alias drafts a structured plan: ordered steps,
   files expected to change, explicit acceptance criteria per step.
2. The draft is handed to the `smart` model alias for critique and rewrite. This is
   the "implement with a bigger, smarter model" step — the fast model proposes, the
   smart model is responsible for the version that actually ships.
3. The reviewed plan is shown to the developer for approval before any execution
   begins.
4. On approval, save to `.agent/plans/<id>.md`. This file becomes the execution
   contract: the agent works through it step by step, checks off completed steps,
   and flags (rather than silently improvising) if it needs to deviate.
5. `/plans` lists active and archived plans. Archiving a plan (rather than deleting
   it) preserves history for the project memory log.

---

## 9. Memory system

Two tiers, deliberately simple (plain JSON/markdown, not a database — see §2.6):

**Tool-level — `~/.agent/`** (global, shared across every project this tool touches)
- `config.json` — provider credentials, model alias map, default skill set
- `usage.log` — per-session token/cost tracking

**Project-level — `<project>/.agent/`**
- `memory.md` — running log of decisions and context the agent should carry between
  sessions, written in plain prose, append-only with timestamps
- `index.json` — lightweight file index: path, one-line summary, content hash,
  last-modified. Lets the agent check what's changed instead of re-reading the
  entire tree every session.
- `sessions/` — compact summaries of past sessions, not full transcripts, for
  continuity without bloating context
- `skills/` — optional project-specific `SKILL.md` files, loaded alongside the
  built-in ones

---

## 10. Coding standards (read this section twice)

This is the most important section for avoiding "AI slop" output. Apply these rules
to every file you write in this project, no exceptions without a stated reason.

1. **Functions are small and do one thing.** If you're reaching for a comment to
   explain "now we do X" partway through a function, that block should probably be
   its own function instead. As a rough guide, most functions should fit on one
   screen (~30–40 lines); if one is growing past that, look for the natural seam to
   split it.
2. **Names are long and literal, not clever.** `validateProjectRootIsWritable()`,
   not `checkRoot()`. `findFirstSkillMatchingTaskDescription()`, not
   `matchSkill()`. A function or variable name should make the comment unnecessary.
3. **One file, one responsibility.** A file's exports should all relate to the same
   concern. If you're adding a function that doesn't fit the file's existing theme,
   that's a signal for a new file, not a bigger one.
4. **No deep nesting.** More than two or three levels of indentation inside a
   function is a sign that inner logic wants to be extracted into a named helper.
   Prefer early returns over nested conditionals.
5. **No magic values.** Numbers, strings, and config-like literals get named
   constants (`MAX_TOOL_RESULT_CHARS`, not a bare `8000` inline).
6. **Comments explain *why*, not *what*.** The code itself should make the "what"
   obvious through naming and structure. Reserve comments for non-obvious reasoning,
   trade-offs, or warnings about gotchas.
7. **Consistent patterns across the codebase.** If the project handles errors one
   way in `tools/`, don't introduce a different pattern in `planning/` without a
   reason. Look at neighboring code before inventing a new shape for something.
8. **Apply ponytail before adding anything.** Before adding a new dependency, a new
   abstraction layer, or a new config option, run it through the decision ladder in
   §6.3. The instinct to "make this configurable" or "add a helper class for this"
   should be resisted unless a second real use case already exists.
9. **Every public function gets a docstring-style comment** stating what it does, its
   parameters, and what it returns — even if the name makes it fairly obvious. This
   is the one place brevity yields to clarity: a one-line summary above the function
   signature, not a paragraph.
10. **Tests live next to the behavior they test**, named after the function/scenario
    they cover, not generic `test1`, `test2`.

The test for whether you've followed this section: a developer who has never seen
this codebase should be able to open any single file and understand what it does
within a minute, without needing to trace into five other files first.

---

## 11. Build order (phases, with acceptance criteria)

**Phase 1 — prove the loop**
Core agent loop + `AnthropicMessagesProvider` + `read_file` tool only.
*Done when:* you can run the CLI, ask it to summarize a file in the project, and get
a correct answer through a real tool call round-trip.

**Phase 2 — full tool set + safety gate**
Add `write_file`, `edit_file`, `bash`, `grep`, `glob`. Implement the full
classification/confirmation system from §7.
*Done when:* a `dangerous`-classified command is reliably blocked pending
confirmation, and a deliberately malicious test prompt ("delete everything in the
project root") cannot execute without explicit developer approval.

**Phase 3 — provider router**
Add `OpenAiCompatibleProvider`, the model alias config, and the ability to point
`fast`/`smart`/`planner` at different providers.
*Done when:* you can swap the `fast` alias from an Anthropic model to a local Ollama
model via config only, no code changes.

**Phase 4 — skills**
Build the loader, write `caveman/SKILL.md` and `ponytail/SKILL.md` for real, wire
the hard-instruction injection into the system prompt.
*Done when:* a task that should trigger ponytail (e.g., "add a date picker")
visibly produces a smaller, simpler diff with the skill loaded than without it —
verify this yourself, don't just assume the skill works.

**Phase 5 — project memory**
Implement `.agent/` read/write for both tiers, the file index, session summaries.
*Done when:* closing and reopening the CLI on the same project produces a response
that correctly references something from a prior session's `memory.md`.

**Phase 6 — plan mode**
Implement `/plan`, the draft→review→approve→execute flow, plan persistence.
*Done when:* a non-trivial multi-file change goes through an approved plan and the
agent visibly tracks progress against it step by step rather than free-wheeling.

**Phase 7 — polish**
`ink`-based TUI, streaming output, generalize the slash-command system beyond
`/plan` (`/skills`, `/memory`, `/cost`, etc.).

Build and verify each phase before starting the next. Do not jump ahead to plan
mode with a safety gate that hasn't been hardened — the ordering above is
deliberate, not arbitrary.

---

## 12. Definition of done for v1

- [ ] Agent loop runs against both provider adapters
- [ ] All six core tools implemented and gated through the safety classifier
- [ ] Dangerous operations cannot execute without explicit confirmation, verified
      with at least one adversarial test prompt
- [ ] caveman and ponytail skills loaded by default and demonstrably affecting
      output
- [ ] Project memory persists and is read back correctly across sessions
- [ ] `/plan` produces a plan reviewed by the `smart` model alias before execution
- [ ] Every file in `src/` satisfies the coding standards in §10
- [ ] README documents setup, config, and the model alias system for a new user
