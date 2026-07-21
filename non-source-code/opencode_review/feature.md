# justcode — Feature Inventory

> Every implemented feature verified against `src/` and `test/`. Marked **stable** where dedicated tests exist.

---

## 1. Agent Execution Loop

### Core Agent (`src/agent/index.ts`)
- **Status:** Stable (routing tested; main loop untested)
- **What it does:** `AgentOrchestrator.runTurn()` implements the core agentic loop: inject context (memory, plans, skills) → route to model alias → call LLM provider → parse response → dispatch tool calls recursively → return final answer.
- **Key capabilities:**
  - Multi-turn conversation with recursive tool-calling (tools can call back into `runTurn`)
  - System prompt assembly from: base prompt + `ask_user_guidance` + shell hint + project memory + active plans + matched skills
  - Calibration notes injected between turns (token budget from prior turn)
  - Skill pin/mute filtering per turn
  - Progress events streaming (text, tool_start, tool_end, stats, thinking, request_start/end, flow_event)

### Model Routing (`src/agent/router.ts`)
- **Status:** Stable (tested)
- **What it does:** Keyword-based routing to `fast`/`smart`/`planner` alias without extra LLM call
- **Route triggers:**
  - `planner`: `/plan`, "create a plan", "architecture plan"
  - `smart`: "refactor", "design", "security", "optimize performance"
  - `fast`: active plans exist (execution mode), short/conversational queries
  - **Default:** `smart`

### Turn Calibration (`src/agent/calibration.ts`)
- **Status:** Untested
- **What it does:** Injects `[prior turn: declared ~N, used M]` note into next user message, helping the model self-regulate output length

---

## 2. CLI & REPL

### Interactive REPL (`src/cli/repl.ts`)
- **Status:** Stable (prompt processing tested)
- **Read-eval-print loop** with readline interface
- Progress events rendered to terminal: spinner, flow logs, collapsible tool output, thinking blocks, cost stats
- `/analyze` shorthand expansion
- File injection via `@filepath` and `@filepath:lines`
- Skill pin/mute via `@skillname` / `!@skillname`

### Slash Commands (`src/cli/command-dispatcher.ts`)
- **Status:** Untested
- **Full command set:**
  - `exit`/`quit` — save session and exit
  - `e`/`expand` — show last collapsed tool output
  - `/undo` — roll back last write_file/edit_file
  - `/cost` — global API cost statistics
  - `/memory` — project memory timeline
  - `/skills` — list skills with pin/mute status
  - `/skill list|pin|mute|reset` — manage skill overrides
  - `/debug on|off` — toggle flow log traces
  - `/plan <goal>` — draft + critique + approve plan
  - `/plans` — list plans
  - `/plans archive <id>` — archive a plan
  - `/sessions` — list project sessions with cost
  - `/session resume <id>` — resume past conversation
  - `/models` — interactive model alias config
  - `/config` — interactive config editor
  - `/theme` — terminal color theme picker
  - `/db ...` — database admin commands

### Tab Autocomplete (`src/cli/autocomplete.ts`)
- **Status:** Stable (comprehensively tested)
- Completes: slash commands, `/skill pin|mute <name>`, skill names (@ and !@), file paths (gitignore-filtered)

### Terminal Spinner (`src/cli/spinner.ts`)
- **Status:** Stable (tested)
- Animated braille-frame spinner with cursor hide/show, updateable text

### Theme System (`src/cli/colors.ts`)
- **Status:** Stable (tested)
- 6 themes: Default, One Dark, Catppuccin, Material, Hackerman, Vilnius Purple
- Persisted to `~/.agent/theme.json`

### Gitignore Filter (`src/cli/gitignore-filter.ts`)
- **Status:** Untested
- Builds path filter for autocomplete from `.gitignore` + hardcoded ignore patterns

### Interactive Prompts (`src/cli/ask-question.ts`, `select-option.ts`, `multi-select.ts`)
- **Status:** Used by ask_user tool (tested indirectly)
- Text input, arrow-key single-select, spacebar multi-select

### Onboarding (`src/cli/onboarding.ts`)
- **Status:** Untested
- First-run wizard: pick provider → enter API key → configure aliases → write to `~/.agent/config.json`

---

## 3. Tools

### Tool Registry (`src/tools/registry.ts`)
- **Status:** Untested
- Registers all 14 tools, validates against `KNOWN_TOOLS` at startup, dispatches execution
- Injects readline into AskUserTool
- Startup assertion: if any registered tool is missing from `KNOWN_TOOLS`, throws

### Read File (`src/tools/read_file.ts`)
- **Status:** Stable (tested)
- Reads file as UTF-8 string. No path sandboxing yet.

### Write File (`src/tools/write_file.ts`)
- **Status:** Untested (critical gap)
- Creates parent directories recursively, writes file

### Edit File (`src/tools/edit_file.ts`)
- **Status:** Stable (tested)
- Exact string replacement with uniqueness validation on `oldText`. Supports multi-edit blocks.

### Grep (`src/tools/grep.ts`)
- **Status:** Stable (smoke-tested)
- Recursive directory walk, case-insensitive regex, skips node_modules/.git/.agent/dist/.logs, caches at 100 matches

### Glob (`src/tools/glob.ts`)
- **Status:** Stable (smoke-tested)
- Uses Node 22+ native `fs.glob`, normalizes to forward slashes

### Bash Tools (`src/tools/bash/`)
- **One-shot execution** (`bash-tool.ts`) — dynamic timeout (6s normal, 30s install/build/test), auto-detects long-running processes by stdout keywords
- **Background process** (`start-process.ts`, `check-process.ts`, `wait-process.ts`) — returns `jobId` immediately, polls with offset-based delta output, configurable timeout
- **Job registry** (`state.ts`) — global `Map<string, BackgroundJob>`
- **Cleanup** — `BashTool.cleanup()` kills all registered processes
- **Status:** Partially tested (basic exec, background detection, cleanup tested)

### Memory Tools (`src/tools/memory_tools.ts`)
- **Status:** Untested (critical gap)
- `search_memory` — keyword search against memory index
- `recall_memory` — full BFS graph retrieval (primary memory tool)
- `record_memory` — write new memory node
- `get_memory_node` — single node fetch by ID

### Ask User (`src/tools/ask_user.ts`)
- **Status:** Stable (tested)
- Text, single-choice, multi-choice questions using CLI interactive menus
- Batching: all questions in one call
- Fallback readline interface for testing

---

## 4. Safety System

### Safety Gate (`src/safety/gate.ts`)
- **Status:** Stable (thoroughly tested)
- **Three tiers:**
  - `safe`: read_file, grep, glob, search/recall/get_memory_node, ask_user, check/wait_process, safe bash prefixes (ls, cat, git status, etc.) → **silent, no prompt**
  - `write`: write_file, edit_file, record_memory, non-safe bash (npm install, build, mkdir) → **logged, no prompt**
  - `dangerous`: unknown tools, path traversal, dangerous bash patterns (rm -rf, git push --force, curl|sh, dd, chmod 777) → **y/N prompt**
- `KNOWN_TOOLS` set = single source of truth for dispatcher + gate
- Path sandboxing: resolves relative to project root, rejects escape attempts

### Backup Manager (`src/safety/backup.ts`)
- **Status:** Stable (tested)
- Timestamped backups to `.agent/backups/` before every write/edit
- `undoLast()` restores original content or deletes file if it didn't exist
- Multiple undo stack entries

---

## 5. Memory System

### Project Memory (`src/memory/project.ts`)
- **Status:** Partially tested
- Timeline prose in `.agent/memory.md` — timestamped notes appended per session
- File index in `.agent/index.json` — `{ path, summary, hash, lastModified }`
- Session summary generation — calls fast LLM with `session_summary_system.txt` template
- Summary saved to `.agent/sessions/<timestamp>_summary.md`

### Memory Graph (`src/memory/`)
- **Status:** Stable (core tested, some modules untested)
- **Node store** (`node-store.ts`) — per-node JSON files in `.agent/memory/nodes/`
- **Index store** (`index-store.ts`) — lightweight index in `.agent/memory/index.json`
- **Keyword search** (`keyword-search.ts`) — substring + tag scoring against index
- **BFS traversal** (`graph-traversal.ts`) — pure BFS over `relatedTo` edges, cycle-safe
- **Recall orchestrator** (`recall.ts`) — search → BFS → rank → token budget (4000 default) → return + frontier
- **Recording** (`record.ts`) — creates node file + appends to index

### Session Manager (`src/memory/session.ts`)
- **Status:** Stable (tested)
- Project-level token/cost stats in `.agent/session.json`
- Full conversation history to `.agent/sessions/session_<id>.json`
- Summary update, history load for session resume

### Session Logger (`src/memory/logger.ts`)
- **Status:** Stable (tested)
- Structured debug logs to `.logs/session_<timestamp>.log`
- Auto-creates `.logs/` and appends to `.gitignore`

### Global Usage Logger (`src/memory/global.ts`)
- **Status:** Stable (tested)
- Cumulative token/cost to `~/.agent/usage.log`

---

## 6. LLM Providers

### Provider Factory (`src/providers/factory.ts`)
- **Status:** Stable (tested)
- Resolves alias → provider type → returns `AnthropicMessagesProvider` or `OpenAiCompatibleProvider`
- Supports custom providers in `config.providers` map (override API key/endpoint per alias)

### Anthropic Provider (`src/providers/anthropic.ts`)
- **Status:** Stable (tested with SDK mocking)
- Uses `@anthropic-ai/sdk`
- Prompt caching: `cache_control: { type: 'ephemeral' }` on last user message + last tool definition
- Extended thinking support (Claude 3.7) with `budget_tokens: 2000`, `max_tokens: 8000`
- Cost tracking via token usage response

### OpenAI-Compatible Provider (`src/providers/openai.ts`)
- **Status:** Stable (tested with fetch mocking)
- Uses standard `fetch()` to `/chat/completions`
- Compatible with DeepSeek, OpenAI, OpenRouter, Ollama, local models
- Extracts `reasoning_content` and inline `<think>` tags (DeepSeek R1, Ollama)
- Tool definitions converted to OpenAI `functions` format

---

## 7. Planning System

### Planning Manager (`src/planning/planner.ts`)
- **Status:** Stable (tested)
- `draftPlan(goal)` — fast model + `planner_draft_system.txt` (or custom planner skill)
- `critiqueAndRewrite(draft)` — smart model + `planner_critique_system.txt` (or custom plan-review skill)
- `savePlan(id, content)` — to `.agent/plans/<id>.md`
- `listPlans()` — scans `.agent/plans/` and `.agent/plans/archived/`
- `archivePlan(id)` — moves to archived
- `loadImprovisationContext()` — reads memory.md + agent/project-overview.md + agent/folder-structure.md + agent/code-conventions.md

---

## 8. Skills System

### Skill Loader (`src/skills/loader.ts`)
- **Status:** Stable (tested)
- Three source locations: built-in (`<installDir>/skills/`), project (`<cwd>/skills/`), project hidden (`.agent/skills/`)
- Dynamic path resolution for dev (src/) vs prod (dist/) layouts

### Skill Parser (`src/skills/parser.ts`)
- **Status:** Stable (tested)
- Parses YAML front-matter (`name`, `description`) + markdown body from `SKILL.md`
- Naive colon-split parsing (not a full YAML parser)

### Skill Matcher (`src/skills/matcher.ts`)
- **Status:** Stable (tested)
- Deterministic matching rules:
  - `/analyze` → exclusive `analyze` skill
  - `coding-efficiency` always active
  - `nextjs-conventions` activates if `next` in `package.json`
  - Keyword substring matching on skill name in task description
  - Refactor/migrate/rewrite/unanalyzed project → activates `analyze`

---

## 9. DB Admin Agent

### DB CLI Commands (`src/cli/db-menu.ts`, `db-actions.ts`)
- **Status:** Untested (core logic tested)
- `/db setup` — interactive connection wizard (SQLite/PostgreSQL/MySQL/MongoDB defaults)
- `/db schema` — introspect + render ASCII/Mermaid ERD, save to `.agent/db/schema.md`
- `/db query <sql>` — execute with write-confirmation prompt
- `/db ask <question>` — dedicated `AgentOrchestrator` sub-session with `db_admin_system.txt`
- `/db memory` — list DB cached schema memory
- `/db revalidate` — force schema re-cache

### DB Config (`src/db/config.ts`)
- **Status:** Untested
- Load/save to `.agent/db/config.json`, interactive setup prompt

### DB Executor (`src/db/executor.ts`)
- **Status:** Stable (tested with process mocking)
- Read-only query detection (SQL: SELECT/SHOW/DESCRIBE/EXPLAIN/PRAGMA, MongoDB: find/count/aggregate)
- Executes via CLI tools: `sqlite3`, `psql`, `mysql`, `mongosh`
- CSV/TSV/plain-text output parsing

### DB Schema Introspector (`src/db/schema.ts`)
- **Status:** Stable (tests exist for rendering)
- Per-engine introspection queries (SQLite `sqlite_master`, PG/MySQL `information_schema`, MongoDB `show collections`)
- ASCII table diagram + Mermaid ER diagram generation

### DB Memory (`src/db/memory.ts`)
- **Status:** Stable (tested)
- Independent memory index at `.agent/db/memory/index.json`
- Schema revalidation: detects table/column additions, drops, type changes
- Records changes as memory nodes

### DB Formatter (`src/db/formatter.ts`)
- **Status:** Untested
- Bordered ASCII table renderer for query results

---

## 10. Config System

### App Config Loader (`src/config/index.ts`)
- **Status:** Stable (tested)
- Priority: env vars → `~/.agent/config.json` → `./config.json` → defaults
- Environment variable auto-loading via `dotenv` (`.env` file in cwd)
- `writeAppConfig()` merges and saves to user-level config

### Constants (`src/config/constants.ts`)
- Hardcoded pricing rates for 8 model families
- Provider profiles: Anthropic, OpenAI, DeepSeek, OpenRouter, Google Gemini
- Token limits, path constants, fallback models

### Prompt/Template Loader (`src/config/prompts.ts`)
- **Status:** Untested
- Synchronous file reads from `prompts/` and `templates/`
- Dynamic path resolution for dev/prod layouts

---

## Stability Map

> See `test/TEST.md` for detailed per-file test analysis. See `skills/SKILLS.md` for skills analysis.

| Feature | Tested? | Lines of Test | Reliability |
|---------|---------|---------------|-------------|
| Model routing | Yes | 103 | ✅ High |
| Safety gate classification | Yes | 94 | ✅ High |
| Backup/undo | Yes | 55 | ✅ High |
| Edit file | Yes | 62 | ✅ High |
| Ask user | Yes | 117 | ✅ High |
| CLI autocomplete | Yes | 83 | ✅ High |
| BFS graph traversal | Yes | 53 | ✅ High |
| Memory recall pipeline | Yes | 97 | ✅ High |
| Session persistence | Yes | 78 | ✅ High |
| Project memory/index | Yes | 103 | ✅ High |
| Session logging | Yes | 68 | ✅ High |
| Global usage logging | Yes | 37 | ✅ High |
| Provider: Anthropic | Yes | 126 | ✅ High |
| Provider: OpenAI | Yes | 159 | ✅ High |
| Provider factory | Yes | 66 | ✅ High |
| Skill parser | Yes | 25 | ⚠️ Medium |
| Skill matcher | Yes | 65 | ⚠️ Medium |
| Skill loader | Yes | 47 | ⚠️ Medium |
| Planner draft/critique | Yes | 94 | ⚠️ Medium |
| DB schema rendering | Yes | 41 | ⚠️ Medium |
| DB memory/revalidation | Yes | 84 | ⚠️ Medium |
| DB executor/read-only detection | Yes | 70 | ⚠️ Medium |
| Bash one-shot | Partial | 34 | ⚠️ Medium |
| Spinner/theme | Yes | 94 | ✅ High |
| Config loader | Yes | 58 | ✅ High |
| REPL prompt processing | Yes | 81 | ✅ High |
| AgentOrchestrator (full loop) | **No** | — | ❌ Untested |
| Write file | **No** | — | ❌ Untested |
| Memory tools (search/recall/record/get) | **No** | — | ❌ Untested |
| Tool registry | **No** | — | ❌ Untested |
| CLI command dispatcher | **No** | — | ❌ Untested |
| Cost estimation | **No** | — | ❌ Untested |
| Prompt/template loader | **No** | — | ❌ Untested |
| DB config/formatting | **No** | — | ❌ Untested |
| Calibration | **No** | — | ❌ Untested |
