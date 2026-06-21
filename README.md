# justcode

A terminal-based, agentic AI coding assistant. Type code requests in natural language — it plans, executes, and remembers decisions across sessions. Works with Anthropic Claude or any OpenAI-compatible API (DeepSeek, OpenAI, Ollama, etc.).

---

## Setup

### Requirements
- Node.js 20+ (uses native `glob` API)
- npm

### Install from Git (Global)

```bash
npm install -g git+https://github.com/kasahina69/justcode.git
```

npm will automatically build TypeScript to `dist/` via the `prepare` hook and link the `justcode` binary.

### Install Locally (Development)

```bash
git clone https://github.com/kahsina/justcode.git
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

On startup the tool initializes a session log, loads config, and boots the interactive REPL.

---

## What it does

`justcode` is an autonomous coding agent in your terminal. It reads your codebase, executes commands, modifies files, and builds structured memory of project decisions — all driven by natural language requests.

---

## Features

- **Agentic task execution** — reads, writes, edits, and runs shell commands in your project directory
- **Dynamic model routing** — auto-routes prompts to `fast`, `smart`, or `planner` model based on query complexity
- **Non-blocking bash execution** — servers and long-running commands run in the background; REPL is never blocked
- **Interactive CLI spinner** — animated loading indicator while AI thinks or tools run
- **Structured memory graph** — persistent, interconnected knowledge nodes stored per-project in `.agent/memory/`
- **Single-pass BFS recall** — recall relevant memory clusters in one deterministic tool call, never a loop
- **Token budget enforcement** — memory retrieval is hard-capped by `MAX_MEMORY_RECALL_TOKENS`
- **Session cost tracking** — per-response cost and cumulative session cost displayed live
- **Resumable sessions** — save and reload past conversation histories
- **Skills system** — drop Markdown skill files into `skills/` to modify agent behavior
- **Planning workflow** — `/plan <goal>` generates, critiques, and saves agent execution plans
- **Project memory log** — session summaries appended to `.agent/memory.md` after every session
- **File safety** — every file write is backed up; `/undo` rolls back the last change
- **Interactive safety gate** — dangerous shell commands require explicit `y/N` confirmation
- **External prompts** — all system prompts live in `prompts/` — edit without touching code
- **Extensive session logging** — full request/response logs written to `.logs/session_*.log`
- **Global cost history** — cumulative token and cost stats in `~/.agent/usage.log`; view with `/cost`

---

## REPL Commands

| Command | Action |
|---|---|
| `exit` / `quit` | Save session summary and exit |
| `/undo` | Roll back the last file modification |
| `/cost` | Print total global API cost stats |
| `/memory` | Show the project timeline memory log |
| `/skills` | List loaded skills |
| `/plan <goal>` | Draft and critique an implementation plan |
| `/plans` | List active and archived plans |
| `/plans archive <id>` | Archive an active plan |
| `/sessions` | List all project sessions with cost summaries |
| `/session resume <id>` | Resume a past conversation |
| `Ctrl+C` | Save session and exit |

---

## How it Works — Flow

```
User Input (REPL)
       │
       ├─ Slash Command? → handle locally and return
       │
       ▼
AgentOrchestrator.runTurn()
       │
       ├─ Load project memory (.agent/memory.md)
       ├─ Load active plans (.agent/plans/*.md)
       ├─ Match relevant skills
       ├─ routeModelAlias() → 'fast' | 'smart' | 'planner'
       │
       ▼
LLM Provider (Anthropic / OpenAI-compat)
       │
       ├─ Emits request_start → spinner.start()
       ├─ Streaming complete()
       └─ Emits request_end  → spinner.stop()
       │
       ▼
Response Processing
       ├─ thinkingContent  → print thought block
       ├─ textContent      → print agent response
       ├─ stats            → print metrics + session cost
       └─ toolCalls?
              │
              ▼
       Safety Gate (classifyToolCall)
              ├─ safe/write → execute directly
              │                 └─ backup file if write
              └─ dangerous  → prompt user (y/N)
                                   └─ execute if approved
              │
              ▼
       Tool execution result → append to conversation
              │
              ▼
       Recurse → runTurn() with tool results
              │
              ▼
       Final answer printed, REPL prompts for next input

On Exit:
  ├─ SessionMemory: summary → .agent/sessions/ + .agent/memory.md
  ├─ SessionManager: transcript → .agent/sessions/session_<id>.json
  └─ BashTool.cleanup() → kill background processes
```

---

## File & Function Reference

### `src/cli/`
| File | Function | Purpose |
|---|---|---|
| `index.ts` | `main()` | REPL boot, onboarding, command dispatcher |
| `index.ts` | `runOnboarding()` | Interactive first-run config setup |
| `index.ts` | `saveSessionMemoryAndExit()` | Save summary & transcripts, cleanup |
| `index.ts` | `estimateCost()` | Per-model token cost estimation |
| `index.ts` | `onConfirmDangerousTool()` | Safety prompt (y/N) |
| `spinner.ts` | `CliSpinner` | Terminal loading spinner with cursor hide/show |

### `src/agent/`
| File | Function | Purpose |
|---|---|---|
| `index.ts` | `AgentOrchestrator.runTurn()` | Main agentic loop: context injection, LLM call, tool dispatch |
| `index.ts` | `routeModelAlias()` | Auto-routes query to fast/smart/planner model |

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
| `project.ts` | `ProjectMemoryManager` | Session summaries, `.agent/memory.md` timeline, `.agent/sessions/` |
| `session.ts` | `SessionManager` | Project-level cost/token stats in `.agent/session.json`, history transcripts |
| `global.ts` | `logTokenUsage()` | Appends global usage to `~/.agent/usage.log` |
| `logger.ts` | `SessionLogger` | Structured per-session log files in `.logs/` |

### `src/tools/`
| File | Tool Name | Purpose |
|---|---|---|
| `bash.ts` | `bash` | Executes shell commands; non-blocking for servers |
| `read_file.ts` | `read_file` | Reads file contents |
| `write_file.ts` | `write_file` | Writes new file contents |
| `edit_file.ts` | `edit_file` | Targeted inline file edits |
| `grep.ts` | `grep` | Regex pattern search in files |
| `glob.ts` | `glob` | File pattern matching |
| `memory_tools.ts` | `search_memory` | Index-only keyword lookup |
| `memory_tools.ts` | `recall_memory` | Full BFS graph context retrieval (primary memory tool) |
| `memory_tools.ts` | `record_memory` | Write a new memory node |
| `memory_tools.ts` | `get_memory_node` | Drill-down fetch for a single node by ID |
| `registry.ts` | `ToolRegistry` | Registers all tools; dispatches by name |

### `src/safety/`
| File | Function | Purpose |
|---|---|---|
| `gate.ts` | `SafetyGate.classifyToolCall()` | Tags tool calls as `safe`, `write`, or `dangerous` |
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
  prompts/
    agent_system.txt      ← main agent system prompt
    planner_draft_system.txt
    planner_critique_system.txt
    skills_match_system.txt

~/.agent/
  config.json             ← global API keys and model config
  usage.log               ← global cumulative token & cost log
```

---

## Development

```bash
npm run dev          # run in development (tsx, no build step)
npm run build        # compile TypeScript to dist/
npm run test         # run all 56 unit and integration tests
npm install -g .     # install globally from local source
```

## Model Aliases

Three aliases route requests automatically based on query complexity:

| Alias | Default Model | Used For |
|---|---|---|
| `fast` | claude-3-5-haiku / deepseek-chat | Conversational queries, plan execution steps, session summaries |
| `smart` | claude-3-5-sonnet / deepseek-coder | Complex code tasks, refactoring, general agent responses |
| `planner` | claude-3-5-sonnet / deepseek-coder | `/plan` drafting and critiquing |
