# test/ — Test Coverage Analysis

> Generated from source code analysis of all 30 test files.

---

## Quick stats

- **Total test files:** 30
- **Total source files:** ~67
- **Fully tested modules:** Safety, Providers, Router, Autocomplete, Backup
- **Untested critical modules:** WriteFile, MemoryTools, ToolRegistry, CLI CommandDispatcher, AgentOrchestrator.runTurn()
- **Testing framework:** Vitest (no jest, no mocha)
- **No setup files,** no shared fixtures, no snapshot tests

---

## Test structure

Tests mirror the `src/` directory structure exactly:

```
test/
├── agent/          → src/agent/
├── cli/            → src/cli/
├── config/         → src/config/
├── db/             → src/db/
├── memory/         → src/memory/
├── planning/       → src/planning/
├── providers/      → src/providers/
├── safety/         → src/safety/
├── skills/         → src/skills/
└── tools/          → src/tools/
```

---

## File-by-file breakdown

### agent/ (2 files)

**`test/agent/index.test.ts`** — AgentOrchestrator (55 lines)

Tests only the `routeModelAlias()` method. Constructs a full AgentOrchestrator with ToolRegistry, SafetyGate, BackupManager. Pure unit: no real LLM calls.

| Test | Verifies |
|---|---|
| `/plan` commands route to `planner` | Keyword detection |
| Active plans present → `fast` | Execution mode routing |
| Refactoring even with plans → `smart` | Complex keyword override |
| Short queries → `fast` | Conversational routing |
| General code changes → `smart` | Default routing |

**Gap:** `runTurn()`, tool dispatch, backup integration, error recovery, stop conditions, prompt assembly — none tested.

**`test/agent/router.test.ts`** — Router (48 lines)

Tests standalone `routeByTaskDescription()` and `routeModelAlias()`.

| Test | Verifies |
|---|---|
| `isReadOnly` → `fast` | Context parameter |
| `/plan` / `isComplex` → `planner` | Planning triggers |
| "refactor/design/optimize" → `smart` | Keyword matching |
| Active plans → `fast` | Execution mode |
| Short queries → `fast` | Simple query detection |
| Default → `smart` | Fallback |
| `routeModelAlias` extracts last user message | Message parsing |

**Gap:** Empty messages, multi-message edge cases, non-string content parts.

### safety/ (2 files) ⭐ Well tested

**`test/safety/gate.test.ts`** — SafetyGate (94 lines)

Thorough coverage of all 3 tiers.

| Test | What it verifies |
|---|---|
| `read_file` inside root = safe | Safe tier |
| `read_file` outside root = dangerous | Path traversal protection |
| `write_file` = write | Write tier |
| Safe bash (ls, cat, git status, etc.) = safe | SAFE_BASH_PREFIXES allowlist |
| npm install, build, mkdir = write | Write-tier bash |
| rm -rf, git push --force, curl\|bash = dangerous | DANGEROUS_BASH_PATTERNS |
| Unknown tools = dangerous | KNOWN_TOOLS fallback |
| `record_memory` = write (not dangerous) | Write tier for memory |
| KNOWN_TOOLS has all expected names | Set completeness (13 tools) |
| `check_process`, `wait_process` = safe | Process polling |
| `start_process` with npm = write | Process-start write tier |
| `start_process` with dangerous = dangerous | Process-start dangerous tier |

**`test/safety/backup.test.ts`** — BackupManager (55 lines)

| Test | Verifies |
|---|---|
| Backup + modify + undo restores original | Full lifecycle |
| Backup nonexistent + create + undo deletes file | Deletion undo |

### tools/ (5 files)

**`test/tools/bash.test.ts`** — BashTool (34 lines)

| Test | Verifies |
|---|---|
| `echo hello_world` succeeds | Basic execution |
| Background process detection (listening on port) | Long-running detection |
| Cleanup terminates processes | Process management |

**Gap:** Error output, timeout handling, piping, `start_process`/`check_process`/`wait_process` integration.

**`test/tools/read_file.test.ts`** (16 lines)

| Test | Verifies |
|---|---|
| Read existing `package.json` | Content returns correctly |
| Read nonexistent file → error | Error handling |

**Gap:** No tests for line offset, binary files, permission errors, symlinks.

**`test/tools/edit_file.test.ts`** (62 lines)

| Test | Verifies |
|---|---|
| Replace unique text | Single edit |
| Error on duplicate `oldText` | Uniqueness check |
| Error on not found | Missing text |

**Gap:** Multi-edit blocks, whitespace edge cases, empty edits.

**`test/tools/search.test.ts`** (24 lines) — Smoke tests

| Test | Verifies |
|---|---|
| Grep finds "justcode" in package.json | Basic grep |
| Glob finds `src/tools/*.ts` | Basic glob |
| Bash echo | Basic exec |

**Gap:** Only smoke-level coverage. No regex, glob exclude, multi-file grep tests.

**`test/tools/ask_user.test.ts`** (117 lines)

Fully mocked (all 3 CLI modules mocked via `vi.mock()`).

| Test | Verifies |
|---|---|
| Text question → returns answer | Free-text input |
| Single choice → returns selection | Option selection |
| Multi choice → returns selections | Checkbox behavior |
| Missing options → error | Error handling |

**Untested tools:** `write_file.ts` (critical), `memory_tools.ts` (4 tools), `registry.ts`

### memory/ (6 files)

**`test/memory/session.test.ts`** (78 lines)

| Test | Verifies |
|---|---|
| Load empty stats when no file | Absence handling |
| Save and load incremental stats | Persistence |
| Save and load conversation history | Transcript persistence |
| Update session summaries | Summary changes |

**`test/memory/recall.test.ts`** (97 lines)

Full integration: records 30 nodes, BFS traverses, verifies correct retrieval. Second test enforces token budget.

| Test | Verifies |
|---|---|
| 30-node graph: record → BFS → verify connectivity | Full pipeline |
| Token budget enforcement: budget 30 → truncated | Budget limiting |

**`test/memory/project.test.ts`** (103 lines)

| Test | Verifies |
|---|---|
| Load/append to memory.md | Timeline persistence |
| Read/write file index.json | Index CRUD |
| Create session summary via mocked LLM | Summary generation |

**`test/memory/logger.test.ts`** (68 lines)

| Test | Verifies |
|---|---|
| Init .logs/, create .gitignore, log request/response/error | Full lifecycle |

**`test/memory/graph-traversal.test.ts`** (53 lines)

Pure unit with in-memory mock graph:

| Test | Verifies |
|---|---|
| 1-hop traversal from seed | Hop limit |
| 2-hop traversal with cycle detection | Cycle safety |
| Multiple seed entries | Multi-seed |

**`test/memory/global.test.ts`** (37 lines)

| Test | Verifies |
|---|---|
| Create ~/.agent/usage.log with token+ cost data | Global logging |

### providers/ (3 files)

**`test/providers/openai.test.ts`** (159 lines) ⭐ Well tested

Mocks `global.fetch`:

| Test | Verifies |
|---|---|
| Message formatting + completion + tool call parsing | Happy path |
| `reasoning_content` + `cached_tokens` (DeepSeek) | Reasoning extraction |
| `<think>` tag stripping | Inline think parsing |

**`test/providers/anthropic.test.ts`** (126 lines) ⭐ Well tested

Mocks `@anthropic-ai/sdk`:

| Test | Verifies |
|---|---|
| Complete with message/tool mapping | Happy path |
| Missing API key throws | Constructor validation |
| `thinking` blocks + `cache_*` tokens | Extended thinking |

**`test/providers/factory.test.ts`** (66 lines)

| Test | Verifies |
|---|---|
| `fast` → `OpenAiCompatibleProvider` | Alias resolution |
| `smart` → `AnthropicMessagesProvider` | Alias resolution |
| Custom provider (anthropic) → Anthropic | Custom providers |
| Custom provider (openai-compat) → OpenAI | Custom providers |

### cli/ (4 files)

**`test/cli/autocomplete.test.ts`** (83 lines) ⭐ Well tested

| Test | Verifies |
|---|---|
| `/` → all slash commands | Command completion |
| `/skill → subcommands` | Subcommand completion |
| `/skill pin pony` → `ponytail` | Skill name completion |
| `@pon` → `@ponytail` | Skill pin completion |
| `!@cav` → `!@caveman` | Skill mute completion |
| `pack` → `package.json` | File completion |
| `@pack` → `@package.json` | @-file completion |

**`test/cli/repl.test.ts`** (81 lines)

| Test | Verifies |
|---|---|
| `@skillname` pins a skill | Pin parsing |
| `!@skillname` mutes a skill | Mute parsing |
| `@filepath` injects full file | Context injection |
| `@filepath:lines` injects range | Line range injection |

**`test/cli/theme.test.ts`** (49 lines)

| Test | Verifies |
|---|---|
| List all 6 themes | Theme enumeration |
| Apply "One Dark" → ANSI codes correct | Theme application |
| Save "Catppuccin" to disk | Theme persistence |

**`test/cli/spinner.test.ts`** (45 lines)

| Test | Verifies |
|---|---|
| Start, timer, update text, stop with clear | Full lifecycle |
| Stop without clearing | Stop variant |

**Untested:** `command-dispatcher.ts`, `cost.ts`, `config-menu.ts`, `models.ts`, `onboarding.ts`, `sessions.ts`, `db-menu.ts`, `db-actions.ts`, `gitignore-filter.ts`

### planning/ (1 file)

**`test/planning/planner.test.ts`** (94 lines)

| Test | Verifies |
|---|---|
| Draft then critique with mocked fetch | Two-stage LLM pipeline |
| Save, list, archive plan with filesystem | Full CRUD lifecycle |

### skills/ (3 files)

**`test/skills/parser.test.ts`** (25 lines)

| Test | Verifies |
|---|---|
| Parse valid SKILL.md with YAML frontmatter | Parsing |
| Return null for missing frontmatter | Error handling |

**`test/skills/matcher.test.ts`** (65 lines)

| Test | Verifies |
|---|---|
| Always match `coding-efficiency` if present | Always-on rule |
| Match `nextjs-conventions` if next in package.json | Dependency rule |
| Match skill by keyword in task description | Keyword rule |

**`test/skills/loader.test.ts`** (47 lines)

| Test | Verifies |
|---|---|
| Load skills from built-in + project `.agent/skills/` | Multi-source loading |

### config/ (1 file)

**`test/config/loader.test.ts`** (58 lines)

| Test | Verifies |
|---|---|
| Defaults when no config file exists | Fallback |
| Load + merge from `~/.agent/config.json` | Global config loading |

**Gap:** Local config.json override, env var override, malformed JSON, provider config.

### db/ (3 files)

**`test/db/schema.test.ts`** (41 lines)

| Test | Verifies |
|---|---|
| Render ASCII ERD | Schema visualization |
| Render Mermaid ER diagram | Mermaid generation |

**`test/db/memory.test.ts`** (84 lines)

| Test | Verifies |
|---|---|
| Record and load DB memory nodes | DB memory CRUD |
| Schema revalidation: new tables/columns detected | Change detection |

**`test/db/executor.test.ts`** (70 lines)

| Test | Verifies |
|---|---|
| `isQueryReadOnly` for SQL (SELECT/SHOW/DESCRIBE/EXPLAIN/PRAGMA = read, INSERT/UPDATE/DELETE/DROP = write) | Read-only detection |
| `isQueryReadOnly` for MongoDB (find/count/aggregate = read, insertOne/updateOne/deleteMany = write) | Read-only detection |
| Execute rejects write when user declines | Safety |
| Execute succeeds for read-only or confirmed writes | Happy path |

---

## Coverage gaps — priority sorted

| Priority | Module | Risk | What's missing |
|---|---|---|---|
| 🔴 CRITICAL | `WriteFileTool` | Data loss | 42-line file, completely untested |
| 🔴 CRITICAL | `MemoryTools` (4 tools) | Memory data loss | search/recall/record/get_memory_node all untested |
| 🔴 CRITICAL | `ToolRegistry` | Dispatch failures | Registration, execution dispatch, KNOWN_TOOLS sync validation |
| 🔴 CRITICAL | `AgentOrchestrator.runTurn()` | Agent loop failures | Main orchestration loop, tool dispatch, stop conditions, error recovery, prompt assembly |
| 🟡 HIGH | `CLI command-dispatcher` | UX bugs | All /commands untested |
| 🟡 HIGH | `CLI cost.ts` | Wrong billing | Cost estimation, file parsing |
| 🟡 HIGH | `db/config.ts`, `formatter.ts` | DB connection failures | Config load/save, result formatting |
| 🟡 HIGH | `Prompt/template loader` | Startup failures | Path resolution, error handling |
| 🟡 MEDIUM | `Calibration` | Token waste | 9-line module, untested |
| 🟡 MEDIUM | `Agent Skills integration` | Wrong behavior | Skill injection in system prompt untested |

---

## Testing patterns used

| Pattern | Used in |
|---|---|
| Pure unit (no I/O, no mocks) | `router.test.ts`, `graph-traversal.test.ts`, `factory.test.ts`, `schema.test.ts`, `parser.test.ts` |
| HTTP mock (`global.fetch`) | `openai.test.ts`, `project.test.ts`, `planner.test.ts` |
| SDK mock (`vi.mock`) | `anthropic.test.ts` |
| CLI module mock | `ask_user.test.ts` |
| File I/O (temp dirs) | `bash.test.ts`, `session.test.ts`, `recall.test.ts`, `project.test.ts` |
| Process mock (`child_process.exec`) | `executor.test.ts` |
| Spy (`process.stdout.write`, `os.homedir`) | `spinner.test.ts`, `theme.test.ts`, `global.test.ts` |
