# justcode

A terminal-based, agentic AI coding assistant. Type code requests in natural language — it plans, executes, and remembers decisions across sessions. Works with Anthropic Claude or any OpenAI-compatible API (DeepSeek, OpenAI, Ollama, etc.).

---

## Setup

### Requirements
- Node.js 20+ (uses native `glob` API)
- npm

### Install from Git (Global)

#### Windows
On Windows, due to an npm bug where git URL installations are sometimes created as temporary broken symlinks, it is recommended to install via the GitHub tarball URL:

```bash
npm install -g https://github.com/kashina69/justcode/tarball/master

# Or run on demand without global installation
npx https://github.com/kashina69/justcode/tarball/master
```

#### macOS / Linux
On macOS or Linux, you can install directly using the GitHub repository shortcode. If your npm is configured in a system directory (non-nvm), you may need to prefix global commands with `sudo`:

```bash
# Standard install (use sudo npm install -g ... if permission error occurs)
npm install -g github:kashina69/justcode

# Or run on demand without global installation
npx github:kashina69/justcode
```

### Updating

To update `justcode` to the latest version, run the installation command again with the `--force` flag to clear the local npm cache and pull the latest commits from GitHub:

#### Windows
```bash
npm install -g https://github.com/kashina69/justcode/tarball/master --force
```

#### macOS / Linux
```bash
npm install -g github:kashina69/justcode --force
```

### Install Locally (Development)

```bash
git clone https://github.com/Kashina69/justcode.git
cd justcode
npm install
npm run build
npm install -g .
```

### Configuration

On first run, `justcode` will prompt for setup. You can also pre-create `~/.agent/config.json` (global) or `config.json` in your project root (local override):

```json
{
    "openaiApiKey": "sk-...",
    "openaiEndpoint": "https://api.deepseek.com",
    "modelAliases": {
        "fast":    { "provider": "openai-compat", "modelId": "deepseek-chat" },
        "smart":   { "provider": "openai-compat", "modelId": "deepseek-coder" },
        "planner": { "provider": "openai-compat", "modelId": "deepseek-coder" }
    }
}
```

For Anthropic Claude, use:
```json
{
    "anthropicApiKey": "sk-ant-...",
    "modelAliases": {
        "fast":    { "provider": "anthropic", "modelId": "claude-3-5-haiku-20241022" },
        "smart":   { "provider": "anthropic", "modelId": "claude-3-5-sonnet-20241022" },
        "planner": { "provider": "anthropic", "modelId": "claude-3-5-sonnet-20241022" }
    }
}
```

Or set environment variables: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `OPENAI_API_ENDPOINT`.

---

## Running

```bash
justcode          # from any project folder — works on the current working directory
npm run dev       # for development from project source
```

On startup the tool initializes a session log, loads config, preloads skill names for tab completion, and boots the interactive REPL.

---

## What it does

`justcode` is an autonomous coding agent in your terminal. It reads your codebase, executes commands, modifies files, and builds structured memory of project decisions — all driven by natural language requests.

---

## Features

- **Agentic task execution** — reads, writes, edits, and runs shell commands in your project directory
- **Dynamic model routing** — auto-routes prompts to `fast`, `smart`, or `planner` model based on query complexity using centralized `routeByTaskDescription`
- **DB Admin Agent** — Interactive database administration sub-session (`/db`) for schema introspection, query execution (with confirm safety gate), text/Mermaid ERDs, and AI DB design engineer helper
- **AI Question Asker** — AI agent can query the user for missing parameters/details mid-execution using checkbox menus, single-select, or text inputs via the `ask_user` tool
- **Three-tier safety gate** — `safe` commands run silently, `write` commands run and are logged, only truly `dangerous` commands prompt `y/N`
- **Background process job handles** — `start_process` returns a `jobId`; `check_process` / `wait_process` poll it — agent never re-issues the same command to check status
- **Non-blocking bash execution** — servers and long-running commands run in the background; REPL is never blocked
- **Interactive CLI spinner** — animated loading indicator while AI thinks or tools run
- **Flow logs** — dim single-line trace of every internal step (skill match, model route, tool classification) printed live; toggle with `/debug off`
- **Collapsible tool output** — results over 15 lines fold automatically; type `e` to expand the last one
- **Enhanced Tab Autocomplete** — press Tab to complete slash commands, skill names, and file/folder locations (with gitignore-aware auto-suggestions).
- **Manual skill control** — pin skills using `/skill pin` or typing `@skillname` in your message; mute skills using `/skill mute` or typing `!@skillname` in your message; `/skill reset` returns to automatic matching.
- **File & Line Context Injection** — hyperfocus the AI on specific files or lines by writing `@filepath` or `@filepath:lines` (e.g. `@src/cli/repl.ts:30-50`) in your prompt to inject target file blocks directly into context.
- **Structured memory graph** — persistent, interconnected knowledge nodes stored per-project in `.agent/memory/`
- **Single-pass BFS recall** — recall relevant memory clusters in one deterministic tool call, never a loop
- **Token budget enforcement** — memory retrieval is hard-capped by `MAX_MEMORY_RECALL_TOKENS`
- **Session cost tracking** — per-response cost, model latency, and tool execution latency displayed separately
- **Resumable sessions** — save and reload past conversation histories
- **Skills system** — drop Markdown skill files into `skills/` to modify agent behavior
- **Planning workflow** — `/plan <goal>` generates, critiques, and saves agent execution plans
- **Project memory log** — session summaries appended to `.agent/memory.md` after every session
- **File safety** — every file write is backed up; `/undo` rolls back the last change
- **Project context initialization** — `/init` scans the codebase and generates `.agent/project.md`, `.agent/agents.md`, `.agent/taste/project-taste.md`, and `.agent/modules/*.md` for richer agent context on every turn
- **Taste system** — learns user preferences (framework choices, code style, architecture patterns) with confidence scores; project taste in `.agent/taste/`, global taste in `~/.justcode/taste/`; auto-injected into every request
- **External prompts & templates** — all system prompts and injection glue strings in `prompts/` — edit without touching code
- **Extensive session logging** — full request/response logs written to `.logs/session_*.log`
- **Global cost history** — cumulative token and cost stats in `~/.agent/usage.log`; view with `/cost`

---

## REPL Commands

| Command | Action |
|---|---|
| `exit` / `quit` | Save session summary and exit |
| `e` / `expand` | Expand the last collapsed tool output |
| `/undo` | Roll back the last file modification |
| `/init` | Scan project and generate `.agent/` context files (project.md, agents.md, taste/, modules/) |
| `/cost` | Print total global API cost stats |
| `/memory` | Show the project timeline memory log |
| `/skills` | List all skills with pin/mute status |
| `/skill list` | Same as `/skills` with pin/mute indicators |
| `/skill pin <name>` | Force a skill active for this session |
| `/skill mute <name>` | Force a skill excluded for this session |
| `/skill reset` | Clear all pins and mutes, back to auto-matching |
| `/debug on\|off` | Toggle flow log trace lines (default: on) |
| `/mode` | Show current model mode (fast / smart / planner) |
| `/mode <fast\|smart\|planner>` | Switch model mode for this session |
| `/plan <goal>` | Draft and critique an implementation plan |
| `/plans` | List active and archived plans |
| `/plans archive <id>` | Archive an active plan |
| `/sessions` | List all project sessions with cost summaries |
| `/session resume <id>` | Resume a past conversation |
| `/db` / `/db help` | Show DB agent sub-commands and help |
| `/db setup` | Run interactive connection setup wizard |
| `/db schema` | Introspect database schema and show diagrams |
| `/db query <sql>` | Execute read/write queries (mutations prompt y/N) |
| `/db ask <question>` | Start a sub-session with the senior DB agent |
| `/db memory` | View database schema cached memory nodes |
| `/db revalidate` | Force schema introspection and cache revalidation |
| `/theme` | Choose a premium color theme for the terminal output |
| `@<skillname>` | Pin a skill for the rest of the chat session |
| `!@<skillname>` | Mute/ignore a skill for the rest of the chat session |
| `@<filepath>` | Inject whole file contents into the chat context |
| `@<filepath>:<lines>` | Inject specific line range or line (e.g. `@src/index.ts:10-25`) |
| `Ctrl+C` | Save session and exit |


### Tab Autocomplete

| Input | Completes to |
|---|---|
| `/[TAB]` | All slash commands |
| `/skill pin [TAB]` | Available skill names |
| `/skill mute [TAB]` | Available skill names |
| `@[TAB]` | Available skill names and matching files/directories in current dir |
| `!@[TAB]` | Available skill names |
| `[partial path][TAB]` | Files and directories matching the input prefix in current dir (gitignore-filtered) |
| `src/cli/[TAB]` | Files/directories inside `src/cli/` |

---

## Safety Gate — Three Tiers

| Tier | Examples | Prompt? |
|---|---|---|
| **safe** | `ls`, `cat`, `git status`, `node -v`, all read tools | ❌ Silent |
| **write** | `npm install`, `write_file`, `edit_file`, `record_memory` | ❌ Runs, logged |
| **dangerous** | `rm -rf`, `git push --force`, unknown tools, path escape | ✅ `y/N` required |

---

## How it Works — Flow

```
User Input (REPL)
       │
       ├─ Slash command / e / expand? → handle locally and return
       │
       ▼
AgentOrchestrator.runTurn()
       │
        ├─ Load project memory (.agent/memory.md)
        ├─ Load taste preferences (.agent/taste/ + ~/.justcode/taste/)
        ├─ Load active plans (.agent/plans/*.md)
        ├─ Load + match skills → apply pin/mute session overrides
        │     └─ flow_event: "skill_match  2 active [coding_efficiency, nextjs_conventions] (0ms)"
       ├─ routeModelAlias() → 'fast' | 'smart' | 'planner'
       │     └─ flow_event: "model_route  → smart (deepseek-coder)"
       │
       ▼
LLM Provider (Anthropic / OpenAI-compat)
       │
       ├─ request_start → spinner.start()
       ├─ provider.complete()          ← modelLatencyMs tracked here
       └─ request_end  → spinner.stop()
       │
       ▼
Response Processing
       ├─ thinkingContent  → print collapsible thought block
       ├─ textContent      → print agent response
       ├─ stats            → Model: Xs | Tool: Ys | Speed: Z t/s | Cost: $N
       └─ toolCalls?
              │
              ▼
       SafetyGate.classifyToolCall()         ← uses KNOWN_TOOLS as single source of truth
              │    flow_event: "tool_classify  bash → write"
              ├─ safe  → execute immediately
              ├─ write → backup file, execute, log
              └─ dangerous → prompt y/N → execute if approved
              │                            toolExecutionLatencyMs tracked here
              ▼
       Tool result → fold if >15 lines ("type e to expand")
              │
              ▼
       Append to conversation → recurse runTurn() with tool results
              │
              ▼
       Final answer printed, REPL prompts for next input

On Exit:
  ├─ SessionMemory: summary (from prompts/session_summary_system.txt) → .agent/sessions/
  ├─ SessionManager: transcript → .agent/sessions/session_<id>.json
  └─ BashTool.cleanup() → kill background processes + job registry
```

---

## File & Function Reference

### `src/cli/`
| File | Function / Export | Purpose |
|---|---|---|
| `index.ts` | `main()` | REPL boot, command dispatcher |
| `index.ts` | `saveSessionMemoryAndExit()` | Save summary & transcripts, cleanup |
| `index.ts` | `estimateCost()` | Per-model token cost estimation |
| `index.ts` | `onConfirmDangerousTool()` | Safety prompt (y/N) |
| `index.ts` | `completer()` | Tab autocomplete: skill names, slash commands, file paths |
| `multi-select.ts` | `multiSelect()` | Checkbox-style multi-select CLI helper |
| `db-menu.ts` | `handleDbCommand()` | Handles /db commands and launches sub-sessions |
| `spinner.ts` | `CliSpinner` | Terminal loading spinner with cursor hide/show |
| `gitignore-filter.ts` | `buildIgnoreFilter()` | Reads `.gitignore` + hardcoded patterns; returns path filter fn for tab completer |

### `src/agent/`
| File | Function | Purpose |
|---|---|---|
| `index.ts` | `AgentOrchestrator.runTurn()` | Main agentic loop: context injection, LLM call, tool dispatch, flow events |
| `router.ts` | `routeByTaskDescription()` | Centralized model routing utility based on complexity |
| `router.ts` | `routeModelAlias()` | Auto-routes query using `routeByTaskDescription` |

`AgentOrchestrator` accepts `pinnedSkills` and `mutedSkills` sets from the CLI session state. These override the automatic skill matcher result on every turn.

### `src/providers/`
| File | Purpose |
|---|---|
| `factory.ts` | Resolves the correct provider instance for a model alias |
| `anthropic.ts` | Anthropic Claude API provider (streaming complete) |
| `openai.ts` | OpenAI-compatible API provider (DeepSeek, OpenAI, Ollama) |
| `types.ts` | Shared types: `ConversationMessage`, `ToolCall`, `ModelAlias` |

### `src/config/`
| File | Function | Purpose |
|---|---|---|
| `index.ts` | `loadAppConfig()` | Loads config from env vars, global `~/.agent/config.json`, or local `config.json` |
| `index.ts` | `writeAppConfig()` | Writes settings back to global config file |
| `index.ts` | `MAX_MEMORY_RECALL_TOKENS` | Named constant for memory token budget (default 4000) |
| `prompts.ts` | `prompts` | `PromptProvider` singleton — lazy-loads and caches prompts on first `get()` |
| `prompts.ts` | `readPromptSync()` / `readTemplateSync()` | Backward-compatible wrappers around `prompts.get()` |

### `src/memory/`
| File | Function | Purpose |
|---|---|---|
| `types.ts` | — | `MemoryNode`, `MemoryIndex`, `MemoryRecallResult` interfaces |
| `node-store.ts` | `NodeStore.readMemoryNode()` / `writeMemoryNode()` | Per-node JSON I/O in `.agent/memory/nodes/` |
| `index-store.ts` | `IndexStore.loadMemoryIndex()` / `appendToMemoryIndex()` | Lightweight index cache in `.agent/memory/index.json` |
| `keyword-search.ts` | `searchMemoryIndexByKeyword()` | Substring + tag overlap scoring against the index |
| `graph-traversal.ts` | `walkRelatedNodesBreadthFirst()` | Pure BFS over `relatedTo` edges, cycle-safe, no I/O |
| `recall.ts` | `recallMemoryContext()` | Orchestrates: search → BFS → rank → token budget → single result |
| `record.ts` | `recordMemoryNode()` | Creates node file + appends to index |
| `project.ts` | `loadMemory()` / `appendMemory()` | Read/write `.agent/memory.md` project timeline |
| `project.ts` | `loadIndex()` / `saveIndex()` | Read/write `.agent/index.json` file index |
| `project.ts` | `createSessionSummary()` / `saveSessionSummary()` | AI-generated session summaries via `fast` LLM, saved to `.agent/sessions/` |
| `session.ts` | `SessionManager` | Project-level cost/token stats in `.agent/session.json`, history transcripts |
| `global.ts` | `logTokenUsage()` | Appends global usage to `~/.agent/usage.log` |
| `logger.ts` | `SessionLogger` | Structured per-session log files in `.logs/` |

### `src/tools/`
| File | Tool Name | Purpose |
|---|---|---|
| `bash/bash-tool.ts` | `bash` | Executes short shell commands synchronously |
| `bash/start-process.ts` | `start_process` | Starts a long command in the background; returns `jobId` immediately |
| `bash/check-process.ts` | `check_process` | Polls a background job by `jobId`; returns status + new output since last check |
| `bash/wait-process.ts` | `wait_process` | Blocks up to a timeout until a background job completes; returns exit code + full output |
| `read_file.ts` | `read_file` | Reads file contents |
| `write_file.ts` | `write_file` | Writes new file contents |
| `edit_file.ts` | `edit_file` | Targeted inline file edits |
| `grep.ts` | `grep` | Regex pattern search in files |
| `glob.ts` | `glob` | File pattern matching |
| `ask_user.ts` | `ask_user` | Ask user clarifying questions mid-execution (text/select/checkbox) |
| `memory_tools.ts` | `search_memory` | Index-only keyword lookup |
| `memory_tools.ts` | `recall_memory` | Full BFS graph context retrieval (primary memory tool) |
| `memory_tools.ts` | `record_memory` | Write a new memory node |
| `memory_tools.ts` | `get_memory_node` | Drill-down fetch for a single node by ID |
| `registry.ts` | `ToolRegistry` | Registers all tools; startup assertion that dispatcher and `KNOWN_TOOLS` are in sync |

### `src/safety/`
| File | Function | Purpose |
|---|---|---|
| `gate.ts` | `KNOWN_TOOLS` | Single source of truth for all valid tool names — used by both safety gate and dispatcher |
| `gate.ts` | `SafetyGate.classifyToolCall()` | Three-tier classification: safe allowlist / write tier / dangerous denylist |
| `backup.ts` | `BackupManager.createBackup()` / `undoLast()` | Pre-write file backups; `/undo` support |

### `src/planning/`
| File | Function | Purpose |
|---|---|---|
| `planner.ts` | `PlanningManager.draftPlan()` | Draft plan via fast model |
| `planner.ts` | `PlanningManager.critiqueAndRewrite()` | Critique plan via smart model |
| `planner.ts` | `PlanningManager.savePlan()` / `archivePlan()` | Persist plans to `.agent/plans/` |

### `src/onboarding/`
| File | Function | Purpose |
|---|---|---|
| `index.ts` | `ensureAppConfigured()` | Root function: checks if onboarding needed → runs interactive setup → validates config → returns config or exits |
| `interactive.ts` | `runInteractiveSetup()` | Interactive provider selection and API key input flow |
| `validate.ts` | `needsOnboarding()` | Checks whether API keys are missing |
| `validate.ts` | `validateProviderConfig()` | Validates active provider credentials |

### `src/skills/`
| File | Function | Purpose |
|---|---|---|
| `loader.ts` | `loadSkills()` | Scans `skills/*/SKILL.md` for custom agent behavior files |
| `loader.ts` | `stripFrontmatter()` | Strips YAML front-matter from skill markdown |
| `matcher.ts` | `matchSkills()` | Deterministic skill matching (returns all skills — classifier was removed per token-efficiency plan) |

---

## Project Data Directories

```
<your-project>/
  .agent/
    memory.md             ← timeline of session summaries
    project.md            ← project overview, tech stack, detected features (generated by /init)
    agents.md             ← agent guidance for this project (generated by /init)
    taste/
      project-taste.md    ← project-level user preferences with confidence scores (auto-updated)
    modules/
      <name>.md           ← per-module file listing (generated by /init)
    db/
      config.json         ← database connection settings
      schema.md           ← auto-generated database schema diagrams
      memory/             ← database cached schema memory
    memory/
      index.json          ← lightweight memory graph index (ids, summaries, tags)
      nodes/
        mem_<id>.json     ← individual memory graph node files
    plans/
      <plan-id>.md        ← active agent plans (checked off by agent)
      archived/           ← completed/rejected plans
    sessions/
      <timestamp>_summary.md  ← AI-generated prose session summary
      session_<id>.json       ← full conversation transcript (for resume)
    session.json          ← project-level cumulative cost & token stats
  .logs/
    session_<timestamp>.log   ← full request/response debug logs
  prompts/                    ← all prompts, templates, skills & agent docs (loaded via PromptProvider)
    agent_system.txt
    ask_user_guidance.txt
    db_admin_system.txt
    planner_draft_system.txt
    planner_critique_system.txt
    plan_injection_header.txt
    manual_skill_header.txt
    session_summary_system.txt
    skills/                         ← built-in skill library (loaded at runtime)
      <skill-name>/SKILL.md
    agents/                         ← agent specs & workflow docs (informational)
      README.md
      agentic_workflow.md

~/.agent/
  config.json             ← global API keys and model config
  usage.log               ← global cumulative token & cost log
  theme.json              ← active terminal color theme setting

~/.justcode/
  taste/
    global-taste.md       ← global user preferences with confidence scores (auto-updated)
```

---

## Development

```bash
npm run dev          # run in development (tsx, no build step)
npm run build        # compile TypeScript to dist/
npm run test         # run all unit and integration tests
npm install -g .     # install globally from local source
```

## Model Aliases

Three aliases route requests automatically based on query complexity:

| Alias | Default Model | Used For |
|---|---|---|
| `fast` | claude-3-5-haiku / deepseek-chat | Conversational queries, plan execution steps, session summaries |
| `smart` | claude-3-5-sonnet / deepseek-coder | Complex code tasks, refactoring, general agent responses |
| `planner` | claude-3-5-sonnet / deepseek-coder | `/plan` drafting and critiquing |

Routing is keyword-based on the last user message — no extra LLM call.