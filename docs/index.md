# docs/ — Project Documentation Index

> Consolidated from the former `docs/` and `docs_two/` folders. Files that existed in both with different content are kept as `filename_2.md` (from `docs_two/`). Identical duplicates were removed.

---

## Project reference

| File | Description |
|------|-------------|
| `project.md` | Canonical project reference for Agency Portal — multi-tenant SaaS for project-based agencies (544 lines) |
| `project req.md` | Client requirements doc: "Budget Manager for Creative Agencies SAAS" — client Zak Kamin (326 lines) |
| `project/docs/project.md` | Brief project docs summary (original) |
| `project/docs/project_2.md` | Brief project docs summary (alternative version) |

## Project subsystem docs

| File | Description |
|------|-------------|
| `project/Auth/Auth.md` | Auth system documentation |
| `project/Auth/auth_refactor_plan.md` | Auth refactoring plan |
| `project/RBAC/SBAC.md` | RBAC/SBAC access control knowledge base for AI agents |
| `project/Settings/Settings.md` | Settings page documentation |

## API & architecture

| File | Description |
|------|-------------|
| `apis.md` | Auth API endpoint catalog (login, OTP, password reset, session) |
| `apis_2.md` | Auth API endpoint catalog (alternative version) |
| `implementations.md` | Feature implementation notes: notification system, broadcast |
| `implementations_2.md` | Feature implementation notes (alternative version) |
| `list triggers.md` | SQL query listing all DB triggers in public schema |
| `list triggers_2.md` | SQL query listing DB triggers (alternative version) |
| `put migartions.md` | Template/prompt for generating Supabase migration INSERT statements |

## Tasks & bugs

| File | Description |
|------|-------------|
| `TASK.md` | Feature task list with completion tracking (Friday tasks — auth, UI, notifications) |
| `TASK_2.md` | Task list (July 7 tasks — stub with emoji legend only) |
| `todays task.md` | Detailed daily task instructions with code quality rules (298 lines) |
| `TODAYS TASKS.md` | Bug tracking for July 8 (overflow issues, theme bugs) (280 lines) |
| `old task.md` | Security audit, rate limiting, code cleanup tasks |
| `TICKETS.md` | Empty — placeholder for ticket tracking |
| `agent task.md` | Empty file |
| `agent.md` | Empty file |

## Bug fix sessions (AI-generated)

| File | Description |
|------|-------------|
| `Fixing Email Branding Consistency updated.md` | Bug fix session: email branding consistency (47KB) |
| `Fixing Team Member Management Bugs.md` | Bug fix session: team member management bugs (47KB) |
| `Fixing Team Member Management Bugsassdfasdfasdf.md` | Bug fix session variant (88KB — appears to be extended) |
| `Hardening UI And Implementing Requirements.md` | UI hardening and requirements implementation (56KB) |
| `Refining and Categorizing Bug Reports.md` | Bug report refinement and categorization (61KB) |
| `Synchronizing Team Lead Selection.md` | Team lead selection sync fix (63KB) |

## AI agent skills & prompting

| File | Description |
|------|-------------|
| `good prompting.md` | Full chat conversation about prompting strategies and variable naming for AI agents (1356 lines) |
| `prompt.md` | Instructions for creating AI knowledge base files for RBAC context |
| `SKILL.md` | Custom AI coding instructions: surgical edits, modular code, senior engineer standards |
| `base prompt and rules.md` | Development workflow philosophy (4 pillars: business logic comments, modular code, precise edits, strict TS) |
| `AI optimization questions chat.md` | Prompt optimization review — how to give AI agents better context (125 lines) |
| `client requirment.md` | Direct client requirements: add client from project creation, remove "spent so far", burn rate calc (45 lines) |
| `agent/ANALYZE_SKILL.MD` | Analyze skill definition for AI codebase analysis |
| `agent/ANALYZE_SKILL_2.MD` | Analyze skill (alternative version) |
| `agent/code-conventions.md` | Code conventions guide for the workspace |
| `agent/code-conventions_2.md` | Code conventions (alternative version) |
| `agent/folder-structure.md` | Folder structure overview |
| `agent/folder-structure_2.md` | Folder structure (alternative version) |
| `agent/project-overview.md` | Project overview summary |
| `agent/project-overview_2.md` | Project overview (alternative version) |

## AI tokens & accounts

| File | Description |
|------|-------------|
| `ai token.md` | List of AI tool accounts and subscription plans (ChatGPT, Copilot, Cursor, etc.) |
| `ai token_2.md` | AI tool accounts (alternative version) |
| `stripe.md` | Stripe price IDs for monthly basic and pro plans |
| `stripe_2.md` | Stripe price IDs (alternative version) |
| `superadmin.md` | Super admin documentation |
| `superadmin_2.md` | Super admin documentation (alternative version) |

## AI chat session logs

| File | Description |
|------|-------------|
| `session 1` | Raw justcode session log — API requests and error responses (auth failure) (22KB) |
| `sessions 2` | Raw justcode session log — complete working session with tool calls and responses (193KB) |
| `antigravity chat` | Antigravity AI chat session transcript (36KB) |

## Database query scripts

| File | Description |
|------|-------------|
| `db_query/check-workspace.js` | Script to check workspace existence and details |
| `db_query/get-tables.js` | List all tables in the database |
| `db_query/list-tables.js` | Alternative table listing script |
| `db_query/print-tenants.js` | Print all tenant records |
| `db_query/query-db.js` | General purpose database query script |
| `db_query/query-project-details.js` | Query project details from database |
| `db_query/query-superadmin.js` | Query super admin data |
| `db_query/scratch-query.js` | Scratch/playground query script |

## Design

| File | Description |
|------|-------------|
| `DESIGN.MD` | Empty — placeholder for design documentation |

## Runtime (auto-generated)

| Path | Description |
|------|-------------|
| `.agent/` | Auto-generated agent runtime data (memory, sessions) |
| `.logs/` | Auto-generated session debug logs |

---

> Each `_2.md` file is the version from the former `docs_two/` folder, kept because its content differed from the version in `docs/`. Review both and decide which to keep or merge.
