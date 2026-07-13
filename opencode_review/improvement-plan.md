# justcode — Detailed Improvement Plan

> Concrete per-subsystem changes with file paths and implementation guidance.
> Each change is self-contained and can be implemented independently.
> After implementing a change, run `npm test` && `npm run dev` to verify.

---

## How to use this plan

1. Start with **Phase 1** — highest impact, lowest risk
2. Each item has: **Subsystem** | **File** | **What to change** | **Why** | **Acceptance criteria**
3. `npm test` after each item; `npm run dev` for smoke test

---

## Phase 1 — Immediate fixes

### 1.1 Stale "Phase 2" comment in ReadFileTool

| Field | Value |
|-------|-------|
| **File** | `src/tools/read_file.ts:29` |
| **What** | Remove the comment `// Direct path resolution for Phase 1. Sandboxing and path constraints will be added in Phase 2.` |
| **Why** | Sandboxing already exists in `safety/gate.ts` (path-starts-with-project-root check at line 132-143). The comment misleads developers. |
| **Criteria** | Line 29 no longer mentions "Phase 1/Phase 2 sandboxing". |

### 1.2 Missing Windows dangerous patterns in SafetyGate

| Field | Value |
|-------|-------|
| **File** | `src/safety/gate.ts:54-72` — `DANGEROUS_BASH_PATTERNS` array |
| **What** | Add dangerous Windows commands: `rd /s /q`, `rmdir /s`, `del /f /s /q`, `takeown /f`, `icacls /grant` with dangerous flags, `reg delete`, `diskpart`, `format` (already has a partial match but incomplete) |
| **Why** | Safety gate only covers POSIX commands; Windows users get no protection against destructive commands. |
| **Criteria** | A command like `rd /s /q C:\Windows` is classified `dangerous`; `del /f /s /q *.js` is classified `dangerous`. |

### 1.3 package.json read from disk on every skill match

| Field | Value |
|-------|-------|
| **File** | `src/skills/matcher.ts:43-54` |
| **What** | Cache `package.json` contents in memory. Read once on construction (or first call), store `dependencies: string[]` as instance field. Add a `refresh()` method. |
| **Why** | Each `matchSkills()` call does `fs.readFile` + `JSON.parse` on `package.json`, even if nothing changed. For long sessions with frequent queries, this is wasted I/O. |
| **Criteria** | Second call to `matchSkills()` does zero file reads unless `refresh()` was called. |

### 1.4 Naive colon-split in skill parser

| Field | Value |
|-------|-------|
| **File** | `src/skills/parser.ts:32-35` |
| **What** | Replace `line.indexOf(':')` with a split that respects the first colon only: `const sepIdx = line.indexOf(':'); const key = line.substring(0, sepIdx).trim(); const val = line.substring(sepIdx + 1).trim();`. Also handle YAML-style quoted values properly (e.g. `description: "value: with colon"`). |
| **Why** | If a description value contains a colon (e.g. "Fix: handle edge case"), the current code truncates the value at the first colon. |
| **Criteria** | `description: "Debug: fix crash on null"` parses to `description = 'Debug: fix crash on null'`. |

### 1.5 Sync file reads in prompt loader

| Field | Value |
|-------|-------|
| **File** | `src/config/prompts.ts:22-46` |
| **What** | `readPromptSync` and `readTemplateSync` use `fs.readFileSync`. Convert to `fs/promises` `readFile`, create `readPrompt` and `readTemplate` async functions. Keep sync wrappers as deprecated wrappers that log a warning on first call. |
| **Why** | Sync I/O blocks the event loop. All callers should be async. |
| **Criteria** | New async functions exported; existing sync callers still work (with deprecation warning). |

### 1.6 Session logger lacks log rotation

| Field | Value |
|-------|-------|
| **File** | `src/memory/logger.ts` — `write()` at line 102-108 |
| **What** | Add a max file size check (default 10MB). Before appending, check `this.logPath` size via `fs.statSync`. If > limit, close current file and start a new one with a sequential suffix (e.g. `session_2026-07-14T00-00-00_001.log`). Also add a configurable max log file count that prunes oldest files. |
| **Why** | Sessions with heavy tool use can produce gigabytes of log output, filling the disk. No mechanism to limit growth. |
| **Criteria** | Setting max size to 1KB and writing 2KB of logs produces 2+ rotated files; oldest file is pruned when count exceeds limit. |

### 1.7 Session summary called on every turn without throttle

| Field | Value |
|-------|-------|
| **File** | `src/memory/project.ts:101-142` |
| **What** | Add a minimum threshold before summarizing: e.g., only summarize when `history.length >= 5` AND `history.length % 5 === 0`. Also add a config option `summaryFrequency` in `AppConfig`. |
| **Why** | `createSessionSummary()` calls the LLM for every interaction turn. On a 30-turn session, that's 30 API calls just for summarization. |
| **Criteria** | With threshold=5, summaries are generated only on turns 5, 10, 15... 0-4 produce no summary. |

### 1.8 Hardcoded CONFIG_DIR in colors.ts

| Field | Value |
|-------|-------|
| **File** | `src/cli/colors.ts` (search for `~/.agent` or `join(homedir(), '.agent')`) |
| **What** | Replace the hardcoded path with the shared config path from `src/config/index.ts` (`getGlobalConfigPath` returns the `.agent` dir path). |
| **Why** | Two different hardcoded paths to the config directory makes it impossible to relocate the config directory in the future. |
| **Criteria** | `colors.ts` imports config directory from `src/config/index.ts` instead of computing its own path. |

### 1.9 Grep truncation not reported clearly to LLM

| Field | Value |
|-------|-------|
| **File** | `src/tools/grep.ts:44-46` |
| **What** | The current truncation message says `... and X more matches.`. Add a clear instruction at the top of the truncated output: `[TRUNCATED: showing 100 of ${results.length} matches. Refine your pattern to narrow results.]` and move the count to the top. |
| **Why** | The LLM may miss the "more matches" notice at the bottom and assume all results are shown, leading to incomplete decisions. |
| **Criteria** | Truncated output starts with `[TRUNCATED: showing 100 of 342 matches]`. |

### 1.10 cost.ts has no tests

| Field | Value |
|-------|-------|
| **File** | `src/cli/cost.ts` |
| **What** | Add unit tests covering: (a) `estimateCost` with various model IDs, (b) `estimateCost` with cache hit flag, (c) `printCostSummary` with a mock usage.log file, (d) empty log file handling, (e) malformed line handling. |
| **Why** | Cost estimation is production code with zero test coverage. A bug here could silently cause incorrect billing reports. |
| **Criteria** | `npm test` passes with >=80% branch coverage on `src/cli/cost.ts`. |

---

## Phase 2 — Structural improvements

### 2.1 Extract giant progress callback from REPL

| Field | Value |
|-------|-------|
| **File** | `src/cli/repl.ts` — `promptUser()` method |
| **What** | Extract the inline progress callback (which handles `request_start`, `request_end`, `thinking`, `tool_start`, `tool_end`, `tool_result` events) into a separate class or module-level function. Name it `createProgressHandler(context: CliContext): (progress: ProgressEvent) => void`. |
| **Why** | The callback is ~80 lines of branching logic inline inside `promptUser()`, making the method hard to read and untestable in isolation. |
| **Criteria** | Extracted function has its own test file (`repl.test.ts` or `progress-handler.test.ts`). The same pattern is used in `db-actions.ts:154-177` — refactor both to share the handler. |

### 2.2 Refactor command-dispatcher if-else chain

| Field | Value |
|-------|-------|
| **File** | `src/cli/command-dispatcher.ts` |
| **What** | Replace the if-else chain with a `Map<string, CommandHandler>` where each handler is a separate function or class method. Extract help text into a `COMMAND_HELP` map to deduplicate the help/list command output. |
| **Why** | Adding a new command requires adding another else-if branch and updating the help text in multiple places. This is error-prone. |
| **Criteria** | New command registration is one entry in a map + one handler function. Help text is auto-generated from the command map. |

### 2.3 Deduplicate autocomplete path resolution

| Field | Value |
|-------|-------|
| **File** | `src/cli/autocomplete.ts:92-127` — `completePaths()` |
| **What** | The `completePaths` function duplicates file system traversal logic. Either: (a) replace with the `src/tools/glob.ts` tool's `fs.glob`, or (b) extract the traversal into a shared utility (`fsUtils.ts`). |
| **Why** | Two independent implementations of file system recursion with different skip rules, exclusion logic, and edge cases. Bug fixes in one won't benefit the other. |
| **Criteria** | Removing `completePaths` doesn't break tab completion. The glob tool or shared utility is used instead. |

### 2.4 Multi-edit overlap validation

| Field | Value |
|-------|-------|
| **File** | `src/tools/edit_file.ts` |
| **What** | Before applying a batch of edits, validate that no two edits overlap (i.e., their `oldString` ranges in the file don't intersect). If overlaps exist, return an error listing the conflicting edits. |
| **Why** | Overlapping edits produce incorrect output (second edit operates on already-modified content). The LLM may not detect this and will get unexpected results. |
| **Criteria** | Two edits targeting overlapping sections in the same file return a clear error before any edit is applied. |

### 2.5 Write confirmation overwrite protection

| Field | Value |
|-------|-------|
| **File** | `src/tools/write_file.ts` |
| **What** | Before writing, check if the target file exists. If it does, compare the existing content hash with the new content hash. If different AND the file was not created by the current session, yield a confirmation prompt via the `ask_user` tool pattern. |
| **Why** | `write_file` silently overwrites any file. An accidental overwrite of a user's source file could lose work. The safety gate only classifies it as 'write' (non-blocking), but the tool itself should be cautious. |
| **Criteria** | Writing to a pre-existing file that was not created this session yields a warning. `writeFile` returns success only after confirmation. |

### 2.6 Expose backup restore in CLI

| Field | Value |
|-------|-------|
| **File** | `src/safety/backup.ts` + `src/cli/command-dispatcher.ts` |
| **What** | Add a `/backup` slash command with subcommands: `/backup list` (show recent backups with timestamps and diff summaries), `/backup undo` (restore most recent backup), `/backup restore <id>` (restore a specific backup). |
| **Why** | Backups are created automatically but there's no way for the user to interactively restore them. The data exists in `.agent/backups/` but is inaccessible. |
| **Criteria** | `/backup list` shows 5 most recent backups with file paths and timestamps. `/backup undo` restores the latest backup. |

### 2.7 Share progress handler between REPL and DB agent

| Field | Value |
|-------|-------|
| **File** | `src/cli/db-actions.ts:154-177` + extracted handler from 2.1 |
| **What** | After extracting the progress handler in 2.1, replace the duplicated inline handler in `db-actions.ts` with the shared one. The DB agent handler is nearly identical to the REPL handler (same event types, same rendering). |
| **Why** | 80+ lines of duplicated event-handling logic. Bug fixes or UI improvements need to be made in two places. |
| **Criteria** | Both `repl.ts` and `db-actions.ts` import and use the same progress handler function. |

### 2.8 DB agent orchestrator lifecycle

| Field | Value |
|-------|-------|
| **File** | `src/cli/db-actions.ts:140-149` |
| **What** | Instead of manually constructing `AgentOrchestrator` options by reaching into `(context.orchestrator as any)` properties (line 141-146), add a `createChildOrchestrator(systemPrompt: string)` method to `AgentOrchestrator` that properly clones the shared state (config, registry, safety gate, backup manager). |
| **Why** | The `as any` casts bypass TypeScript safety. Any structural change to `AgentOrchestrator` constructor silently breaks the DB agent until runtime. |
| **Criteria** | `createChildOrchestrator` returns a properly initialized `AgentOrchestrator` without `as any` casts. TypeScript compilation succeeds. |

---

## Phase 3 — New capabilities

### 3.1 Log actual cost from provider response

| Field | Value |
|-------|-------|
| **File** | `src/providers/anthropic.ts` + `src/providers/openai.ts` + `src/cli/cost.ts` |
| **What** | After each API response, extract `usage.input_tokens`, `usage.output_tokens` from the raw response. Log to `~/.agent/usage.log` as JSON lines. Update `printCostSummary` to use actual token counts (it already does, but no one writes the log). Implement a `logUsage()` function that appends a JSON line. Call it in both providers' `complete()` after successful response. |
| **Why** | Currently `usage.log` is never written to by any code path — `printCostSummary` only reads an empty file. Cost tracking is effectively broken. |
| **Criteria** | After one API call, `usage.log` contains one JSON line with real token counts. `printCostSummary` shows non-zero totals. |

### 3.2 Provider response token extraction

| Field | Value |
|-------|-------|
| **File** | `src/providers/types.ts` |
| **What** | Add `usage?: { inputTokens: number; outputTokens: number; cacheHitTokens?: number }` to the `CompletionResponse` type. Both Anthropic and OpenAI providers populate this field from their API responses. |
| **Why** | Usage data is returned by both APIs but discarded. Storing it enables cost tracking, budgeting, and user-facing stats. |
| **Criteria** | After `provider.complete()`, `response.usage` contains real token counts from the API. |

### 3.3 Config UI for managing providers

| Field | Value |
|-------|-------|
| **File** | `src/cli/` — new file `src/cli/config-ui.ts` (attempted earlier, file not found) |
| **What** | Create an interactive `/config` command with subcommands: `/config list` (show all providers and current alias mappings), `/config set <key> <value>` (update a single config field), `/config provider add` (re-run onboarding for new provider), `/config provider remove <name>` (delete a provider). |
| **Why** | The only way to change configuration is to edit the JSON file or re-run onboarding. There's no way to add a second provider or change model aliases without starting over. |
| **Criteria** | `/config list` shows providers, aliases, and endpoints (masking keys). `/config provider remove` removes a provider from config. |

### 3.4 Read file with offset/limit

| Field | Value |
|-------|-------|
| **File** | `src/tools/read_file.ts` |
| **What** | Add optional `offset?: number` and `limit?: number` parameters to `ReadFileTool.definition.inputSchema`. When provided, read only the specified range of lines from the file (seek to offset bytes or line number). Return the total file line count in the output so the LLM knows how much remains. |
| **Why** | Large files (1000+ lines) must be read in full to satisfy the current tool. For generated or log files, this wastes context budget. |
| **Criteria** | Reading a 5000-line file with `offset=100, limit=50` returns 50 lines and mentions "5000 total lines in file". |

### 3.5 Skill file caching

| Field | Value |
|-------|-------|
| **File** | `src/skills/loader.ts` |
| **What** | Add a TTL-based cache for loaded skill files. Cache parsed `Skill[]` results and invalidate after a configurable TTL (default 60s). On `loadSkills()`, return cached array if TTL not expired, otherwise re-read from disk. |
| **Why** | Skills are loaded from disk on every planning cycle. For projects with many skills, this adds noticeable latency. |
| **Criteria** | Second call to `loadSkills()` within 60s returns cached results without disk I/O. After 61s, skills are re-read. |

---

## Implementation order (recommended)

```
Week 1 (Phase 1):
  1.1  stale comment       — 2 min
  1.2  Windows patterns    — 10 min
  1.3  pkg.json cache      — 15 min
  1.4  colon-split fix     — 5 min
  1.5  sync→async prompts  — 20 min
  1.6  log rotation        — 30 min
  1.7  summary throttle    — 15 min
  1.8  CONFIG_DIR cleanup  — 10 min
  1.9  grep truncation msg — 5 min
  1.10 cost.ts tests       — 20 min

Week 2 (Phase 2):
  2.1  extract progress handler    — 45 min
  2.2  command dispatcher refactor — 60 min
  2.3  autocomplete dedup          — 30 min
  2.4  multi-edit overlap check    — 30 min
  2.5  write confirmation          — 30 min
  2.6  backup CLI commands         — 45 min
  2.7  share progress handler      — 15 min
  2.8  child orchestrator method   — 20 min

Week 3+ (Phase 3):
  3.1  actual cost logging  — 30 min
  3.2  usage in types       — 15 min
  3.3  config UI            — 60 min
  3.4  read_file offset     — 30 min
  3.5  skill cache          — 20 min
```

---

## Files with zero test coverage (candidates for next test pass)

| File | Lines | Risk |
|------|-------|------|
| `src/cli/cost.ts` | 50 | Medium — billing correctness |
| `src/cli/colors.ts` | 131 | Low — pure theme logic |
| `src/cli/spinner.ts` | ~40 | Low — ANSI terminal control |
| `src/cli/onboarding.ts` | 89 | Medium — user-provider config |
| `src/cli/autocomplete.ts` | 128 | Low — readline completer |
| `src/cli/gitignore-filter.ts` | 42 | Low — gitignore parsing |
| `src/cli/db-menu.ts` | 72 | Low — routing only |
| `src/cli/db-actions.ts` | 192 | Medium — DB agent lifecycle |
| `src/memory/sessions.ts` | — | Medium — conversation persistence |
| `src/safety/gate.ts` | 205 | High — security critical |
| `src/safety/backup.ts` | — | Medium — data recovery |
| `src/config/prompts.ts` | 46 | Low — file reading |

---

## Cross-cutting concerns

- **Naming inconsistency**: Some files use camelCase (`readFileTool`), others use PascalCase (`ReadFileTool`). Follow the predominant pattern in each subsystem.
- **Error message format**: Some tools return `Error: ...`, others return plain messages. Standardize on `[TOOL_ERROR] <message>` prefix for machine-readable errors.
- **TypeScript strictness**: The `as any` casts in `db-actions.ts:141-146` and potentially elsewhere should be eliminated. Consider enabling `noImplicitAny` in tsconfig.
