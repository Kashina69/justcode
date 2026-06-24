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
- **Dynamic model routing** — auto-routes prompts to `fast`, `smart`, or `planner` model based on query complexity
- **Three-tier safety gate** — `safe` commands run silently, `write` commands run and are logged, only truly `dangerous` commands prompt `y/N`
- **Background process job handles** — `start_process` returns a `jobId`; `check_process` / `wait_process` poll it — agent never re-issues the same command to check status
- **Non-blocking bash execution** — servers and long-running commands run in the background; REPL is never blocked
- **Interactive CLI spinner** — animated loading indicator while AI thinks or tools run
- **Flow logs** — dim single-line trace of every internal step (skill match, model route, tool classification) printed live; toggle with `/debug off`
- **Collapsible tool output** — results over 15 lines fold automatically; type `e` to expand the last one
- **Tab autocomplete** — press Tab to complete `/skill pin <name>`, slash commands, and file paths; gitignore-aware file suggestions
- **Manual skill control** — `/skill pin <name>` forces a skill active; `/skill mute <name>` excludes it; `/skill reset` returns to automatic matching
- **Structured memory graph** — persistent, interconnected knowledge nodes stored per-project in `.agent/memory/`
- **Single-pass BFS recall** — recall relevant memory clusters in one deterministic tool call, never a loop
- **Token budget enforcement** — memory retrieval is hard-capped by `MAX_MEMORY_RECALL_TOKENS`
- **Session cost tracking** — per-response cost, model latency, and tool execution latency displayed separately
- **Resumable sessions** — save and reload past conversation histories
- **Skills system** — drop Markdown skill files into `skills/` to modify agent behavior
- **Planning workflow** — `/plan <goal>` generates, critiques, and saves agent execution plans
- **Project memory log** — session summaries appended to `.agent/memory.md` after every session
- **File safety** — every file write is backed up; `/undo` rolls back the last change
- **External prompts & templates** — all system prompts in `prompts/`, all injection glue strings in `templates/` — edit without touching code
- **Extensive session logging** — full request/response logs written to `.logs/session_*.log`
- **Global cost history** — cumulative token and cost stats in `~/.agent/usage.log`; view with `/cost`

---

## REPL Commands

| Command | Action |
|---|---|
| `exit` / `quit` | Save session summary and exit |
| `e` / `expand` | Expand the last collapsed tool output |
| `/undo` | Roll back the last file modification |
| `/cost` | Print total global API cost stats |
| `/memory` | Show the project timeline memory log |
| `/skills` | List all skills with pin/mute status |
| `/skill list` | Same as `/skills` with pin/mute indicators |
| `/skill pin <name>` | Force a skill active for this session |
| `/skill mute <name>` | Force a skill excluded for this session |
| `/skill reset` | Clear all pins and mutes, back to auto-matching |
| `/debug on\|off` | Toggle flow log trace lines (default: on) |
| `/plan <goal>` | Draft and critique an implementation plan |
| `/plans` | List active and archived plans |
| `/plans archive <id>` | Archive an active plan |
| `/sessions` | List all project sessions with cost summaries |
| `/session resume <id>` | Resume a past conversation |
| `Ctrl+C` | Save session and exit |

### Tab Autocomplete

| Input | Completes to |
|---|---|
| `/[TAB]` | All slash commands |
| `/skill pin [TAB]` | Available skill names |
| `/skill mute [TAB]` | Available skill names |
| `src/cli/[TAB]` | Files in `src/cli/` (gitignore-filtered) |
| `./[TAB]` | Files in current dir (node_modules etc. excluded) |

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
       ├─ Load active plans (.agent/plans/*.md)
       ├─ Load + match skills → apply pin/mute session overrides
       │     └─ flow_event: "skill_match  2 active [caveman, ponytail] (12ms)"
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
  ├─ SessionMemory: summary (from templates/session_summary_system.txt) → .agent/sessions/
  ├─ SessionManager: transcript → .agent/sessions/session_<id>.json
  └─ BashTool.cleanup() → kill background processes + job registry
```

---

## File & Function Reference

### `src/cli/`
| File | Function / Export | Purpose |
|---|---|---|
| `index.ts` | `main()` | REPL boot, onboarding, command dispatcher |
| `index.ts` | `runOnboarding()` | Interactive first-run config setup |
| `index.ts` | `saveSessionMemoryAndExit()` | Save summary & transcripts, cleanup |
| `index.ts` | `estimateCost()` | Per-model token cost estimation |
| `index.ts` | `onConfirmDangerousTool()` | Safety prompt (y/N) |
| `index.ts` | `completer()` | Tab autocomplete: skill names, slash commands, file paths |
| `spinner.ts` | `CliSpinner` | Terminal loading spinner with cursor hide/show |
| `gitignore-filter.ts` | `buildIgnoreFilter()` | Reads `.gitignore` + hardcoded patterns; returns path filter fn for tab completer |

### `src/agent/`
| File | Function | Purpose |
|---|---|---|
| `index.ts` | `AgentOrchestrator.runTurn()` | Main agentic loop: context injection, LLM call, tool dispatch, flow events |
| `index.ts` | `routeModelAlias()` | Auto-routes query to fast/smart/planner model |

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
| `prompts.ts` | `readPromptSync()` | Loads system prompt text from `prompts/` directory |
| `prompts.ts` | `readTemplateSync()` | Loads structural glue strings from `templates/` directory |

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
| `project.ts` | `ProjectMemoryManager` | Session summaries (prompt from `templates/`), `.agent/memory.md` timeline |
| `session.ts` | `SessionManager` | Project-level cost/token stats in `.agent/session.json`, history transcripts |
| `global.ts` | `logTokenUsage()` | Appends global usage to `~/.agent/usage.log` |
| `logger.ts` | `SessionLogger` | Structured per-session log files in `.logs/` |

### `src/tools/`
| File | Tool Name | Purpose |
|---|---|---|
| `bash.ts` | `bash` | Executes short shell commands synchronously |
| `bash.ts` | `start_process` | Starts a long command in the background; returns `jobId` immediately |
| `bash.ts` | `check_process` | Polls a background job by `jobId`; returns status + new output since last check |
| `bash.ts` | `wait_process` | Blocks up to a timeout until a background job completes; returns exit code + full output |
| `read_file.ts` | `read_file` | Reads file contents |
| `write_file.ts` | `write_file` | Writes new file contents |
| `edit_file.ts` | `edit_file` | Targeted inline file edits |
| `grep.ts` | `grep` | Regex pattern search in files |
| `glob.ts` | `glob` | File pattern matching |
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

### `src/skills/`
| File | Function | Purpose |
|---|---|---|
| `loader.ts` | `SkillLoader.loadSkills()` | Scans `skills/**/*.md` for custom agent behavior files |
| `matcher.ts` | `SkillMatcher.matchSkills()` | Semantically matches skills to current task via LLM |
| `parser.ts` | `parseSkillFile()` | Parses YAML front-matter + content from skill markdown |

---

## Project Data Directories

```
<your-project>/
  .agent/
    memory.md             ← timeline of session summaries
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
  skills/
    <skill-name>/
      SKILL.md            ← custom behavior skill (built-in: caveman, ponytail)
  prompts/                    ← main system prompts (loaded via readPromptSync)
    agent_system.txt
    planner_draft_system.txt
    planner_critique_system.txt
    skills_match_system.txt
  templates/                  ← structural glue strings (loaded via readTemplateSync)
    plan_injection_header.txt
    skill_injection_header.txt
    session_summary_system.txt

~/.agent/
  config.json             ← global API keys and model config
  usage.log               ← global cumulative token & cost log
```

---

## Development

```bash
npm run dev          # run in development (tsx, no build step)
npm run build        # compile TypeScript to dist/
npm run test         # run all 63 unit and integration tests
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



find . -iname "*justcode*"