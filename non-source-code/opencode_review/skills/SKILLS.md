# skills/ — Skills Analysis & Improvement Guide

> Analysis of the 6 built-in skills that ship with justcode.

---

## Architecture

Skills are loaded from `skills/<name>/SKILL.md`, parsed for YAML frontmatter, and activated by the `SkillMatcher` based on deterministic rules. They inject behavioral instructions into the system prompt per turn.

### Load locations (in priority order)
1. Built-in: `<installDir>/skills/` (these 6)
2. Project: `<cwd>/skills/`
3. Hidden: `<cwd>/.agent/skills/`

### Matching rules (deterministic, no LLM involved)
1. `/analyze` command → exclusive `analyze` skill
2. `coding-efficiency` → always active on every turn
3. `nextjs-conventions` → if `next` in `package.json` dependencies
4. Keyword contains skill name → substring match in task description
5. Big task (refactor/migrate/rewrite) or unanalyzed project → `analyze` skill

### File format

```
---
name: skill-name
description: One-line description
---
Markdown content body...
```

Frontmatter parsed naively (colon-split, not real YAML). Only `name` and `description` are extracted.

---

## Skill-by-skill analysis

### 1. `analyze` — Codebase Analysis ⭐ Strongest skill

**Frontmatter:**
- Name: `analyze`
- Description: Analyzes an existing codebase to produce project overview, folder structure, and code conventions under the agent/ folder.

**Content:** 120 lines. Detailed instructions for analyzing a codebase and producing 3 files in `agent/`:
- `project-overview.md`
- `folder-structure.md`
- `code-conventions.md`

**Strengths:**
- 6 hard rules (cite real examples, report inconsistencies, sample broadly)
- 6-step process (map → identify → determine → sample → extract → write)
- Anti-patterns DO-NOT list prevents hallucination
- Self-contained and complete

**Improvements:**
- Could specify max output size limits per file
- Could add guidance for monorepos vs single-package projects
- Could include example output templates

---

### 2. `coding-efficiency` — Coding Behavior Standards ⭐ Strong

**Frontmatter:**
- Name: `coding-efficiency`
- Description: Always active for coding tasks — implementation, file edits, shell commands, debugging, refactoring, dependency decisions.

**Content:** 38 lines. Behavioral constraints for the coding agent.

**Key rules:**
1. No filler, no restated plans, no explanations before doing
2. One-sentence answers where possible
3. Declare budget: `[budget: ~N lines / files]`
4. Record bugs immediately via `record_memory`
5. Verify ambiguous results (don't assume)
6. Dependency ladder: existence → stdlib → platform → minimal package → custom code
7. Exceptions to ladder: security, trust-boundary, accessibility, data-loss
8. Defensive by default, surgical scope

**Strengths:**
- Pragmatic dependency ladder with sensible exceptions
- Budget declaration for output control
- Memory recording for bugs

**Improvements:**
- "Material caveats" rule (#9) is vague
- Could reference `recall_memory` for prior-approach awareness
- Could add preferred error-handling patterns
- No guidance on when to split vs keep tasks together

---

### 3. `db_admin` — Database Administration ⚠️ Needs work

**Frontmatter:**
- Name: `db_admin`
- Description: Helps in database design, schema introspection, writing query scripts, ERDs, and database optimization.

**Content:** 25 lines. General DB best practices.

**Key rules:**
- Schema design: normalize unless documented reason, explicit FKs, index lookups
- Query optimization: suggest EXPLAIN plans, prevent full scans, parameterized queries
- ERD generation: use Mermaid notation

**Weaknesses:**
- No tool invocation examples (how to run psql/sqlite3)
- No migration safety guidance
- No connection string / security advice
- No dependency-based auto-activation (should trigger on pg, mysql2, prisma, drizzle)
- **Duplicates** `prompts/db_admin_system.txt` content

**Activation:** Requires explicit mention of "db_admin" — no automatic detection.

---

### 4. `nextjs-conventions` — Next.js Gotchas ✅ Concise, effective

**Frontmatter:**
- Name: `nextjs-conventions`
- Description: Next.js projects — detected via `package.json` dependency on "next".

**Content:** 8 lines. Two critical rules:

```
- params/searchParams/cookies()/headers() are async since Next.js 15 — always await
- Don't rely on __dirname for runtime file paths — use process.cwd() or an explicitly passed root path
```

**Strengths:** High-impact-per-byte. These save real debugging time.

**Improvements (if expanding):**
- `'use client'` vs server component rules
- App Router file conventions (layout, loading, error, not-found)
- Metadata API patterns
- Image optimization gotchas
- Route handler conventions
- Version-specific sections (Pages Router vs App Router vs Next.js 15+)

---

### 5. `plan-review` — Plan Critique ✅ Solid but minimal

**Frontmatter:**
- Name: `plan-review`
- Description: Reviews and critiques draft implementation plans, producing a finalized plan.

**Content:** 14 lines.

**Key instructions:**
- Find real flaws, don't invent
- One-line critique + revised checklist
- Include acceptance criteria per step

**Note:** Nearly identical to `prompts/planner_critique_system.txt`. This is intentional — existing prompt is the fallback, skill overrides per project.

**Improvements:**
- Could add specific review categories (security, performance, error handling, test coverage)
- Could define "approved" output format for sound plans
- Could add severity labels (blocking vs minor)

---

### 6. `planner` — Plan Drafting ✅ Solid but minimal

**Frontmatter:**
- Name: `planner`
- Description: Drafts implementation plans. Ground every step in the project's actual structure and conventions.

**Content:** 14 lines.

**Key instructions:**
- Ground in project structure, memory, conventions
- Output only markdown checklist
- One-line acceptance criteria per step

**Note:** Nearly identical to `prompts/planner_draft_system.txt`. Same fallback pattern as plan-review.

**Improvements:**
- Could add dependency ordering guidance (prerequisites first)
- Could specify each step should be independently testable
- Could add "files to read before starting" section template

---

## System-level issues

### 1. Prompt/Skill duplication

`planner` ≈ `prompts/planner_draft_system.txt` and `plan-review` ≈ `prompts/planner_critique_system.txt`. The prompts are fallbacks when no project skill overrides. Valid pattern, but creates maintenance burden.

**Fix:** Consider making prompts the **base** and skills **additive** (extend, don't replace). Or keep skills as the single source and remove prompt fallbacks.

### 2. Naive YAML parser

`parser.ts` uses colon-split — breaks on values containing colons, multi-line YAML, quotes, arrays. Only `name` and `description` fields are parsed; any additional metadata is silently ignored.

**Fix:** Add a lightweight YAML dependency (or accept the limitation and document it).

### 3. No semantic matching

Matching is pure substring detection. `db_admin` only activates if "db_admin" appears in the task description. No synonym detection ("database", "schema", "SQL", "query") or embedding-based similarity.

### 4. No activation order / conflict resolution

When multiple skills are active, all are injected with the `manual_skill_header.txt` prefix. No priority system for when they give contradictory instructions. The header says "skills > developer request" but doesn't handle inter-skill conflicts.

### 5. `db_admin` missing auto-activation

Should trigger when `package.json` contains DB-related packages (pg, mysql2, sqlite3, prisma, drizzle-orm, mongodb, typeorm, sequelize).

### 6. No validation feedback on load

Invalid frontmatter silently returns null. Loader skips the file with no warning. A validation report on startup would help skill authors debug.

---

## Quick improvement roadmap

| Priority | Improvement | Effort |
|---|---|---|
| 🔴 | Add dependency-based auto-activation for `db_admin` | Low |
| 🔴 | Consolidate triplicate skill-creator files in `ai workflow/` | Low |
| 🟡 | Expand `nextjs-conventions` with more gotchas | Medium |
| 🟡 | Resolve prompt/skill duplication (make skills additive) | Medium |
| 🟡 | Add validation warnings on skill load | Low |
| 🟢 | Add more `coding-efficiency` rules (error handling, tool use) | Low |
| 🟢 | Define output format for approved plans in `plan-review` | Low |
