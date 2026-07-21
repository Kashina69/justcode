You are given a Supabase migration file.

Generate a PostgreSQL INSERT statement for the Supabase migration history table:

supabase_migrations.schema_migrations

The table schema is:

- version TEXT
- statements TEXT[]
- name TEXT

Rules:

1. Extract the migration version from the filename.
   Example:
   0017_project_team_allocation.sql
   -> version = '0017'
   -> name = 'project_team_allocation'

2. Split the migration into individual SQL statements.
3. Preserve the SQL exactly as written.
4. Escape any single quotes correctly for PostgreSQL.
5. Put each SQL statement as a separate element inside the ARRAY[].
6. Return ONLY the SQL INSERT statement. No explanation. No markdown.

Filename:
<filename_here>

Migration SQL:

```sql
<paste migration here>
```

Example Input

Filename:

0017_project_team_allocation.sql

Migration:

ALTER TABLE "public"."projects"
ADD COLUMN "team_id" uuid;

ALTER TABLE "public"."projects"
ADD CONSTRAINT "projects_team_id_fkey"
FOREIGN KEY ("team_id")
REFERENCES "public"."tenant_teams"("id")
ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "idx_projects_team_id"
ON "public"."projects"("team_id");

The AI should output only:

INSERT INTO supabase_migrations.schema_migrations (
version,
statements,
name
)
VALUES (
'0017',
ARRAY[
'ALTER TABLE "public"."projects" ADD COLUMN "team_id" uuid;',
'ALTER TABLE "public"."projects" ADD CONSTRAINT "projects_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."tenant_teams"("id") ON DELETE SET NULL;',
'CREATE INDEX IF NOT EXISTS "idx_projects_team_id" ON "public"."projects"("team_id");'
],
'project_team_allocation'
);
