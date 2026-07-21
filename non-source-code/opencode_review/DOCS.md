# docs/ — Full Documentation Index

> The `docs/` folder has been consolidated from the former `docs/` and `docs_two/` folders. See `docs/index.md` for the complete file-by-file index with descriptions.

---

## Consolidation summary

`docs_two/` existed as a parallel documentation folder with significant overlap. We analyzed every file pair and consolidated as follows:

| Action | Count |
|--------|-------|
| **Identical files** → removed from `docs_two/`, kept in `docs/` | 3 |
| **Different content** → both kept, `_2` suffix added to `docs_two/` version | 12 |
| **Unique to `docs_two/docs/`** → moved to `docs/` as-is | 9 |
| **Unique to `docs_two/` root** → moved to `docs/` as-is | 13 files + 3 subdirectories |
| **`docs_two/` folder** → deleted entirely | 1 |

## `docs/` folder structure

```
docs/
├── index.md                          ← This index
├── .agent/                           ← Runtime data (auto-generated)
├── .logs/                            ← Debug logs (auto-generated)
├── agent/                            ← AI agent skill files
│   ├── ANALYZE_SKILL.MD
│   ├── ANALYZE_SKILL_2.MD
│   ├── code-conventions.md
│   ├── code-conventions_2.md
│   ├── folder-structure.md
│   ├── folder-structure_2.md
│   ├── project-overview.md
│   └── project-overview_2.md
├── db_query/                         ← Database query helper scripts
│   ├── check-workspace.js
│   ├── get-tables.js
│   ├── list-tables.js
│   ├── print-tenants.js
│   ├── query-db.js
│   ├── query-project-details.js
│   ├── query-superadmin.js
│   └── scratch-query.js
├── project/                          ← Project subsystem documentation
│   ├── Auth/
│   │   ├── Auth.md
│   │   └── auth_refactor_plan.md
│   ├── RBAC/
│   │   └── SBAC.md
│   └── Settings/
│       └── Settings.md
├── project docs/                     ← Project docs subfolder
│   ├── project.md
│   └── project_2.md
└── (40+ files — see docs/index.md)
```

## What to review next

Many files have `_2` counterparts (different versions from `docs_two/`). These pairs need human review to decide:

| Pair | Decision needed |
|------|----------------|
| `ai token.md` / `ai token_2.md` | Which AI account list to keep? |
| `apis.md` / `apis_2.md` | Which API catalog to keep? |
| `implementations.md` / `implementations_2.md` | Which implementation notes to keep? |
| `list triggers.md` / `list triggers_2.md` | Which DB trigger query to keep? |
| `stripe.md` / `stripe_2.md` | Which stripe price list to keep? |
| `superadmin.md` / `superadmin_2.md` | Which super admin doc to keep? |
| `TASK.md` / `TASK_2.md` | Which task list to keep? |
| `agent/*.md` / `agent/*_2.md` | Which agent files to keep? (4 pairs) |
| `project docs/project.md` / `project docs/project_2.md` | Which project summary to keep? |
| `todays task.md` / `TODAYS TASKS.md` | Different content — keep both or merge? |

**Empty/placeholder files** that may be deleted: `agent.md`, `agent task.md`, `DESIGN.MD`, `TICKETS.md`
