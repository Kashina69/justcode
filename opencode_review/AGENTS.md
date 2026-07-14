# justcode — AGENTS.md

> **Project context file** — everything an AI agent needs to understand the repo, its current state, and all analysis/review work completed so far. Each subdirectory has an `index.md` with detailed file-by-file descriptions.

This repo is the **justcode AI coding assistant itself** (not a user project). Be careful modifying agent behavior — changes affect how the tool operates.

---

## Project folders (top-level)

| Folder | Purpose | More detail |
|--------|---------|-------------|
| `src/` | TypeScript source code (CLI, tools, memory, providers, planning, DB, safety, skills, agent, config) | — |
| `test/` | Vitest unit tests mirroring `src/` structure | `test/TEST.md` |
| `prompts/` | Agent system prompt `.txt` files loaded at runtime | `opencode_review/PROMPTS.md` |
| `templates/` | Structural glue `.txt` templates injected around dynamic content | `opencode_review/PROMPTS.md` |
| `skills/` | Custom behavior skill files (`.md` with YAML front-matter) | `opencode_review/SKILLS.md` |
| `design/` | Project design specs (plan.md, plan2.md, token-efficiency-plan.md) | `design/index.md` |
| `session-reviews/` | Live session bug analysis and transcripts (fix.md, fix2.md, output.txt, prompt-review.md) | `session-reviews/index.md` |
| `archives/` | Build artifacts and working copies (files/, files.zip) | `archives/index.md` |
| `other/personal/` | Personal developer notes (ubuntu-optimization.md) | `personal/index.md` |
| `opencode_review/` | Full analysis and improvement review files — see section below | `opencode_review/index.md` |
| `docs/` | Consolidated project documentation index — merged from former `docs/` and `docs_two/`. Identical files deduplicated, differing versions kept as `_2` suffix. See `docs/index.md` for full file-by-file index. | `opencode_review/DOCS.md`, `docs/index.md` |
| `ai workflow/` | Supporting tooling (skill-creator Python scripts, skill evaluation prompts, frontend design skill drafts). Not loaded by the code. | — |
| `dist/` | `tsc` build output; run `npm run build` before publishing | — |
| `.agent/` | Auto-created runtime data: memory graph nodes, sessions, plans, DB config, backups, project timeline, file index | `AGENTS.md` below |
| `.logs/` | Auto-created full request/response debug logs | — |

---

## Analysis & review work completed

The root was cluttered with loose planning files. We reorganized everything into categorized subdirectories and built 8 detailed analysis documents:

### Root reorganization

| What was moved | Destination |
|----------------|-------------|
| `plan.md`, `plan2.md` | `design/` |
| `fix.md`, `fix2.md`, `output.txt`, `prompt review` | `session-reviews/` |
| `fix_pc.md` → renamed `ubuntu-optimization.md` | `personal/` |
| `files/`, `files.zip` | `archives/` |
| All 7 prior analysis files | `opencode_review/` |

Every destination directory has an `index.md` listing its contents with descriptions.

### 8 analysis files in `opencode_review/`

| File | What it covers |
|------|----------------|
| `feature.md` | Feature overview, architecture, REPL loop, tool system, memory, providers, safety |
| `AGENTS.md` | **This file** — project context for AI agents |
| `SRC.md` | Full source tree synopsis: every file in `src/` with line counts, exports, and brief description |
| `PROMPTS.md` | Prompt & template catalog: every file in `prompts/` and `templates/` with call sites |
| `test/TEST.md` | Test coverage analysis: all 30 test files, gaps per subsystem, patterns used, priority-ordered coverage gaps |
| `SKILLS.md` | Skill system analysis: loading, parsing, matching, built-in skills |
| `PROJECT.md` | Project-wide structure, config loading pipeline, pricing constants, cross-cutting patterns |
| `improvement-plan.md` | **Detailed actionable improvement plan** — 23 concrete changes across 3 phases, each with file path, what to change, why, and acceptance criteria |

---

## improvement-plan.md summary

23 items organized in 3 implementation phases:

### Phase 1 — Immediate fixes (10 items)
Stale comments, missing Windows safety patterns, package.json caching, colon-split parser bug, sync→async prompt loader, session log rotation, summary throttle, CONFIG_DIR dedup, grep truncation message, cost.ts tests.

### Phase 2 — Structural improvements (8 items)
Extract shared progress handler (repl.ts + db-actions.ts), refactor command-dispatcher if-else chain to Map, deduplicate autocomplete file traversal, multi-edit overlap validation, write overwrite confirmation, backup CLI commands (`/backup list/undo/restore`), child orchestrator factory method to eliminate `as any` casts.

### Phase 3 — New capabilities (5 items)
Actual cost logging from API responses (usage.log is never written to), usage tokens in CompletionResponse type, interactive `/config` UI, `read_file` offset/limit support, skill TTL caching.

See `opencode_review/improvement-plan.md` for full per-item details (file paths, line references, acceptance criteria).

---

## Commands

| Command | Action |
|---------|--------|
| `npm run dev` | Run via `tsx` (no build step) |
| `npm run build` | `tsc` — compiles to `dist/` |
| `npm test` | `vitest run` — all unit tests |
| `npm run test:watch` | `vitest` in watch mode |
| `npm install -g .` | Install global `justcode` bin from local source |

No linter or formatter is configured.

---

## Source architecture

- **Entrypoint:** `src/cli/index.ts` → registered as `justcode` bin in package.json
- **Flow:** CLI REPL → `AgentOrchestrator.runTurn()` → LLM provider → tool dispatch → loop
- **Model routing:** `router.ts` routes by keyword to `fast`/`smart`/`planner` alias
- **Config loading** (`src/config/index.ts`): env vars → `~/.agent/config.json` → local `config.json` → defaults
- **config.json** is gitignored; commit only to `config.example.json`

### Subsystems in `src/`

| Subsystem | Description |
|-----------|-------------|
| `cli/` | REPL, commands, spinner, colors, autocomplete, onboarding, cost, DB menu, DB actions |
| `tools/` | 14 tool implementations + registry + bash process management |
| `memory/` | Graph nodes, BFS traversal, recall pipeline, sessions, project memory, logger |
| `providers/` | Anthropic + OpenAI-compatible provider implementations + factory |
| `planning/` | Plan draft/critique/save/archive workflow |
| `db/` | Database executor (SQLite, PostgreSQL, MySQL, MongoDB), schema introspector, memory |
| `safety/` | Three-tier safety gate (safe/write/dangerous) + backup/undo manager |
| `skills/` | Skill loader (3 sources), parser, keyword/dependency matcher |
| `agent/` | AgentOrchestrator, router (fast/smart/planner), calibration |
| `config/` | Config loader, constants (pricing, profiles, token limits), prompt/template loader |

See `opencode_review/SRC.md` for detailed per-file breakdown.

---

## ESM

- `"type": "module"` in package.json
- TypeScript source uses `.js` import extensions (required by NodeNext moduleResolution)

---

## Adding a tool

Register in two places:
1. `src/tools/registry.ts` — register the handler function
2. `src/safety/gate.ts` — add name to `KNOWN_TOOLS` set

The `KNOWN_TOOLS` set is the single source of truth for the dispatcher + safety gate. Missing either = tool won't run.

---

## Safety

- Three-tier gate: `safe` (silent), `write` (logged, no prompt), `dangerous` (y/N)
- `SAFE_BASH_PREFIXES` list in `gate.ts` — add read-only commands here
- Backup system: every `write_file` is backed up; `/undo` rolls back last write
- **Known gap:** Windows dangerous patterns missing (e.g. `rd /s /q`, `del /f /s`). See improvement-plan.md item 1.2.

---

## Testing coverage (summary)

- **30 test files**, Vitest framework
- **Well tested:** SafetyGate, BackupManager, Autocomplete, AnthropicProvider, OpenAIProvider, Router
- **Untested critical modules:** WriteFileTool, MemoryTools, ToolRegistry, AgentOrchestrator.runTurn(), CLI command-dispatcher
- See `opencode_review/test/TEST.md` for full file-by-file breakdown and priority-ordered gaps.

---

## Known code quality issues

| Issue | File | Impact |
|-------|------|--------|
| `as any` casts | `src/cli/db-actions.ts:141-146` | Constructor changes silently break DB agent |
| Duplicated progress handler | `repl.ts` + `db-actions.ts:154-177` | ~80 lines inlined twice; fixes must mirror |
| `config-ui.ts` missing | `src/cli/` | Test references non-existent file |
| Stale "Phase 2" comment | `src/tools/read_file.ts:29` | Sandboxing already implemented in gate.ts |
| Session logger unbounded | `src/memory/logger.ts` | No log rotation; can fill disk |
| Session summary on every turn | `src/memory/project.ts:101-142` | LLM called per turn, even for trivial conversations |

---

## Key constants

`src/config/constants.ts` — `MAX_MEMORY_RECALL_TOKENS` (4000), pricing rates, model defaults, provider profiles

---

## Operability notes

- Local/remote AI API calls happen during `npm test` — tests mock providers but some integration tests call real APIs
- `.env` file in cwd is auto-loaded via `dotenv` in config loader
- Onboarding prompts for keys if none are set; devs should pre-set env vars or `config.json`
- `ai workflow/` folder has supporting materials (skill-creator Python tooling, agent prompts for skill evaluation, frontend design skill drafts). Not loaded by the code — reference for skill development.

---

## Runtime data directories (auto-created, per project)

- `.agent/` — memory graph nodes + index, session stats/history, plans, DB config, backups, project memory timeline (`.agent/memory.md`), file index (`.agent/index.json`)
- `.logs/` — full request/response debug logs for performance analysis and prompt optimization

These are excluded from npm publish (`.npmignore`) but not from git — add entries if needed.
