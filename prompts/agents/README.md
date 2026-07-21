# Agents Index

This folder contains reusable agent specifications for JustCode. Agents are orchestration layers: they combine skills, project context files, and tool contracts into a repeatable workflow for a class of work.

## Available Agents

| Agent | Purpose | Primary Skills | Status |
| --- | --- | --- | --- |
| `db-admin-agent` | Initializes and maintains project database schema indexes, read query tools, optional guarded admin/write tools, and DB feature history for other AI agents. | `db_admin`, `analyze`, `planner` | Draft implementation spec |

## Feature History

### 2026-07-14 - db-admin-agent added

- Added an agent spec for project-level database context initialization.
- Defines the minimal DB index files other agents should read first.
- Defines read-only query tool and guarded admin/write tool expectations.
- Extends the existing `db_admin` skill so it can produce schema indexes and tool contracts, not only general DBA advice.
