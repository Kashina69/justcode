# Project DB Index

Last updated: YYYY-MM-DD
Status: draft

## Provider

- Database:
- Client/ORM:
- Runtime for tools:
- Env files checked for variable names:

## Source Of Truth

- Migrations:
- ORM/schema files:
- Existing DB scripts:

## Core Domains

- Domain:
  - Tables:
  - Notes:

## Important Tables

| Table | Domain | Purpose | Key Relations |
| --- | --- | --- | --- |
| `example_table` | Example | Short purpose | `tenant_id -> tenants.id` |

## Tenant/Auth Boundaries

- Tenant scope:
- Auth/user scope:
- RLS/policy notes:

## Functions And RPCs

### Read

- `function_name(args)` - purpose

### Write/Admin

- `function_name(args)` - purpose and risk

## Query Presets To Build

- `projectDetails`
- `tenantOverview`
- `userOverview`

## Risk Areas

- Stale or uncertain fact:
- Migration drift risk:
- Large-table scan risk:

## Evidence

- `path/to/migration.sql`
- `path/to/schema.file`
- `path/to/app/query.file`
