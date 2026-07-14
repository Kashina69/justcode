# DB Agent Tool Contract

This contract describes the tools that the DB Admin Agent creates inside a target project.

## Read Tool: `.agents/tools/db_query`

Purpose: let AI agents inspect project database state for debugging and context.

Required files:

- `db_query.js` or equivalent runtime-native script.
- `TOOL.md` with actions, inputs, examples, and safety notes.

Required actions:

| Action | Mutation | Purpose |
| --- | --- | --- |
| `listKnownTables` | No | Return the table allowlist/index. |
| `describeTable` | No | Return columns, relations, and optionally a sample row. |
| `select` | No | Bounded table reads with validated filters/order/columns. |
| `rpc` | No | Run allowlisted read-only RPCs/functions. |

Recommended project presets:

- `projectDetails`
- `tenantOverview`
- `userOverview`
- `billingOverview`
- `platformOverview`

Safety requirements:

- Default row limit no higher than 25.
- Hard cap no higher than 200 unless project docs justify it.
- Validate identifiers.
- Reject raw SQL in the read tool.
- Keep RPC/function allowlists explicit.
- Print JSON.

## Admin Tool: `.agents/tools/db_admin`

Purpose: let AI agents perform explicit, reviewed DB mutations or custom admin queries when the user asks for them.

Required files:

- `db_admin.js` or equivalent runtime-native script.
- `TOOL.md` with mutation safety rules and examples.

Allowed actions when implemented:

| Action | Mutation | Required Guard |
| --- | --- | --- |
| `insert` | Yes | Confirm flag and schema validation. |
| `update` | Yes | Confirm flag, scoped filter, preview. |
| `delete` | Yes | Confirm flag, scoped filter, preview. |
| `customQuery` | Maybe | Confirm flag for mutation keywords, parameter binding. |
| `runMigration` | Yes | Confirm flag, migration file path, history entry. |
| `repairData` | Yes | Confirm flag, dry run, history entry. |

Mutation guard checklist:

- Operation is explicitly requested.
- Target table or query is named.
- WHERE/scope is present for update/delete.
- Dry run or preview is shown.
- Confirmation flag is present.
- Result is written to `.agents/db/ADMIN_HISTORY.md` or `.agents/db/MIGRATION_HISTORY.md`.

## Tool Index File

Every initialized project should include `.agents/db/TOOL_INDEX.md`:

```md
# DB Tool Index

Last updated: YYYY-MM-DD

## Tools

- `.agents/tools/db_query`: read-only database inspection.
- `.agents/tools/db_admin`: guarded write/admin operations.

## Read First

1. `.agents/db/DB_INDEX.md`
2. `.agents/tools/db_query/TOOL.md`
3. `.agents/tools/db_admin/TOOL.md` only for explicit mutation tasks

## Safety

- Query tool is read-only.
- Admin tool requires confirmation for mutations.
- Secrets are read from env files and never documented.
```
