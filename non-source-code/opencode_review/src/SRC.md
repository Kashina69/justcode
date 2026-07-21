# src/ — Source Code Architecture

## Entry point: `cli/index.ts`

```
cli/index.ts (main)
  ├── Config loading (config/index.ts → constants.ts)
  ├── Onboarding (cli/onboarding.ts) — first-run API key setup
  ├── ToolRegistry init — registers all 14 tools
  ├── SafetyGate init — three-tier classification
  ├── BackupManager init — file backup/undo
  ├── AgentOrchestrator init — the core agent loop
  ├── SkillLoader init — preload skill names for autocomplete
  ├── Readline REPL — promptUser() → orchestrator.runTurn()
  └── SIGINT → saveSessionMemoryAndExit()
```

## Directory map

```
src/
├── agent/           Agent orchestration loop & routing
│   ├── index.ts        AgentOrchestrator — turns, tool dispatch, context assembly
│   ├── router.ts       routeByTaskDescription() — keyword routing to fast/smart/planner
│   ├── calibration.ts  buildCalibrationNote() — prior-turn token note
│   └── types.ts        TurnMetrics, AgentOptions, ProgressEvent types
│
├── cli/             Terminal UI, REPL, commands
│   ├── index.ts        Entrypoint (main()) — init components, start REPL
│   ├── repl.ts         promptUser() — the prompt loop, progress event rendering
│   ├── command-dispatcher.ts  handleCommand() — all /commands
│   ├── context.ts      CliContext — shared mutable session state
│   ├── colors.ts       ANSI themes (6 themes, persisted)
│   ├── spinner.ts      Braille-frame CLI spinner
│   ├── autocomplete.ts Tab completer (slash commands, skills, files)
│   ├── gitignore-filter.ts  .gitignore-based path filter
│   ├── ask-question.ts      Text prompt helper
│   ├── select-option.ts     Arrow-key single-select
│   ├── multi-select.ts      Arrow-key + space multi-select
│   ├── onboarding.ts        First-run API key wizard
│   ├── models.ts            Model alias config UI
│   ├── sessions.ts          Session list/resume UI
│   ├── config-menu.ts       API provider config editor
│   ├── cost.ts              estimateCost() + printCostSummary()
│   ├── db-menu.ts           Route /db commands
│   └── db-actions.ts        Execute /db actions (schema, query, ask, revalidate)
│
├── config/          Application configuration
│   ├── index.ts        loadAppConfig() — env → global → local → defaults
│   ├── constants.ts    MAX_MEMORY_RECALL_TOKENS, pricing, provider profiles
│   └── prompts.ts      readPromptSync() + readTemplateSync() — file loaders
│
├── db/              Database admin agent
│   ├── types.ts        DbConfig, DbColumn, DbTable, DbSchema, QueryResult
│   ├── config.ts       Load/save/interactive-setup for DB connections
│   ├── executor.ts     Query execution via CLI tools (sqlite3, psql, mysql, mongosh)
│   ├── schema.ts       Schema introspection + ASCII/Mermaid ERD rendering
│   ├── formatter.ts    Query result → bordered ASCII table
│   └── memory.ts       DB-specific memory nodes + schema revalidation
│
├── memory/          Persistent knowledge graph
│   ├── types.ts        MemoryNode, MemoryIndex, MemoryRecallResult
│   ├── node-store.ts     Per-node JSON I/O (.agent/memory/nodes/mem_<id>.json)
│   ├── index-store.ts    Global index cache (.agent/memory/index.json)
│   ├── keyword-search.ts Substring + tag scoring against index
│   ├── graph-traversal.ts  Pure BFS over relatedTo edges
│   ├── recall.ts          search → BFS → rank → token budget → result
│   ├── record.ts          Create node + append to index
│   ├── project.ts         ProjectMemoryManager — timeline, file index, session summaries
│   ├── session.ts         SessionManager — project stats, history persistence
│   ├── logger.ts          SessionLogger — debug logs to .logs/
│   └── global.ts          logTokenUsage() — cumulative to ~/.agent/usage.log
│
├── planning/        Draft/critique/save plans
│   ├── types.ts        PlanList
│   └── planner.ts      PlanningManager — draftPlan, critiqueAndRewrite, save, list, archive
│
├── providers/       LLM API abstraction
│   ├── types.ts        ConversationMessage, ToolCall, ModelProvider interface
│   ├── factory.ts      getProviderForAlias() — resolve alias → provider instance
│   ├── anthropic.ts    AnthropicMessagesProvider — SDK, prompt caching, extended thinking
│   └── openai.ts       OpenAiCompatibleProvider — fetch(), reasoning extraction, tool calls
│
├── safety/          Security & undo
│   ├── gate.ts         SafetyGate — three-tier tool classification + KNOWN_TOOLS set
│   └── backup.ts       BackupManager — pre-write backups, undoLast()
│
├── skills/          Skill system (external .md behavior files)
│   ├── types.ts        Skill interface {name, description, content}
│   ├── parser.ts       parseSkillFile() — YAML frontmatter extraction
│   ├── loader.ts       SkillLoader — scan skills dirs, load all *.md
│   └── matcher.ts      SkillMatcher — deterministic rule-based skill selection
│
└── tools/           Executable tools the agent can call
    ├── types.ts        Tool interface {definition, execute}
    ├── registry.ts     ToolRegistry — register all tools, validate vs KNOWN_TOOLS, dispatch
    ├── read_file.ts
    ├── write_file.ts
    ├── edit_file.ts
    ├── grep.ts
    ├── glob.ts
    ├── ask_user.ts
    ├── memory_tools.ts  (search, recall, record, get_memory_node)
    └── bash/
        ├── index.ts         Re-export BashTool + process tools
        ├── state.ts         BackgroundJob interface + JOB_REGISTRY
        ├── bash-tool.ts     One-shot exec with dynamic timeout
        ├── start-process.ts Background job start (returns jobId)
        ├── check-process.ts Poll job status (delta output)
        └── wait-process.ts  Block until job completes
```

## Data flow per turn

```
User Input
    │
    ▼
AgentOrchestrator.runTurn(messages)
    │
    ├── 1. Load skills (cached after first call)
    ├── 2. Load project memory (.agent/memory.md)
    ├── 3. Load active plans (.agent/plans/*.md)
    ├── 4. Match skills → filter by pin/mute
    ├── 5. Route model alias (fast/smart/planner)
    ├── 6. Build system prompt (base + plans + skills + memory)
    ├── 7. Get provider instance
    ├── 8. Inject calibration note from prior turn
    │
    ▼
    LLM provider.complete(system, messages, tools)
    │
    ▼
    Parse response (text + thinking + tool_calls)
    │
    ├── No tool calls → return final message
    │
    └── Tool calls?
            │
            ▼
        SafetyGate.classifyToolCall()
            │
            ├── safe → execute immediately
            ├── write → backup + execute + log
            └── dangerous → prompt y/N → execute if approved
            │
            ▼
        ToolRegistry.executeTool(name, args)
            │
            ▼
        Append result → recurse runTurn() with tool results
            │
            ▼
        Continue until final answer → return to REPL
```

## Key architectural patterns

- **All tools are synchronous** — their `execute()` returns `Promise<string>`. Timeouts and backgrounding are handled inside bash tools, not at the dispatch level.
- **System prompt is assembled per turn** — not cached for the session. Project memory, plans, and skills are re-loaded every turn (skills are cached in memory but re-matched).
- **Progress events stream** — the orchestrator emits events (text, tool_start, tool_end, flow_event, stats, thinking) that the REPL layer renders. This decouples execution from presentation.
- **Session state is mutable** — `CliContext` is passed everywhere. Conversation history grows as `ConversationMessage[]`. No redux/store pattern.
- **Config is read synchronously at startup** — no hot-reload. The `.env` file is read once via `dotenv.config()`.
