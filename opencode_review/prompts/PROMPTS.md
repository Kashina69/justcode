# prompts/ + templates/ — Analysis & Optimization Guide

## How they load

Both directories are read synchronously at startup by `src/config/prompts.ts`:

- `readPromptSync(filename)` — reads from `prompts/`
- `readTemplateSync(filename)` — reads from `templates/`

Path resolution auto-detects dev layout (`src/`) vs prod layout (`dist/src/`).

---

## File-by-file breakdown

### `prompts/agent_system.txt` — Main agent persona (11 lines)

**Purpose:** The primary system prompt for the coding assistant agent. Sets identity ("you are justcode"), context discipline rules, and planning triage.

**Where used:** `src/agent/index.ts` line 54. Always loaded. Appended with `ask_user_guidance.txt` + shell/platform hint dynamically.

**What's good:**
- Very concise — no fluff
- Explicit context-discipline (don't read files unless needed)
- Clear plan triage (trivial → just do it; multi-file → brief plan; substantial → use `/plan`)

**What could improve:**
- No tool inventory — model discovers tools implicitly through registry. A `## Available Tools` section listing tool categories would improve efficiency.
- No tone/style guidance — produces inconsistent output across models.
- "No flow diagrams, no restating it afterward" is adversarial in tone and some models ignore it.
- The shell/platform hint is appended in code (`process.platform` check in `agent/index.ts` lines 49-59) — could be inlined here with a `{{PLATFORM_HINT}}` placeholder pattern.

---

### `prompts/ask_user_guidance.txt` — ask_user tool rules (6 lines)

**Purpose:** Guidelines for using the `ask_user` tool — batch questions, prefer choices over text, ask early.

**Where used:** `src/agent/index.ts` line 56. Always appended to `agent_system.txt` with a try/catch (silently ignores if missing).

**What's good:**
- Batching requirement prevents multi-turn Q&A loops
- Preference for single/multi-choice over free text

**What could improve:**
- Should merge into `agent_system.txt` directly — it's always loaded and only 6 lines. The try/catch is dead code if the file is always expected.
- Could include examples of what "ambiguous" means vs. when the AI should decide autonomously.

---

### `prompts/planner_draft_system.txt` — Plan drafting prompt (14 lines + example)

**Purpose:** Instructs the fast LLM to produce a rough implementation plan as a markdown checklist.

**Where used:** `src/planning/planner.ts` line 94. Fallback — overridden by project `skills/planner/SKILL.md` if present.

**What's good:**
- "Output ONLY a raw markdown checklist" — strong output constraint
- Example grounds the expectation concretely
- Requires project-specific grounding

**What could improve:**
- **CONFLICT with code:** The prompt says "Read `agent/folder-structure.md` and `agent/code-conventions.md` first", but `loadImprovisationContext()` in the code already injects these as context into the user message. The model may waste a turn trying to re-read files it already has. **Fix:** Remove the read instruction from the prompt (let the injected context cover it).
- No output format schema — checklist style varies across runs.
- No "prerequisites" or "dependencies first" ordering guidance.

---

### `prompts/planner_critique_system.txt` — Plan critique prompt (13 lines + example)

**Purpose:** Instructs the smart LLM to review and improve the draft plan.

**Where used:** `src/planning/planner.ts` line 119. Fallback — overridden by `skills/plan_review/SKILL.md` if present.

**What's good:**
- "Only if they actually exist" — prevents hallucinated critique
- Concise critique statement + revised checklist format

**What could improve:**
- No "approved" output format defined. When the plan is sound, "say so in one line" could produce output that doesn't match what downstream expects.
- The `plan-review` skill duplicates this content — keep one as the source of truth.

---

### `prompts/db_admin_system.txt` — DB admin agent persona (25 lines)

**Purpose:** System prompt for the `/db ask` sub-session. Establishes a senior DBA persona.

**Where used:** `src/cli/db-actions.ts` line 123. Always loaded when `/db ask` is used, then augmented with schema + DB memory.

**What's good:**
- Explicit persona prevents role confusion with main agent
- Safety-conscious (warn before slow queries)
- References `ask_user` tool for ambiguous requirements

**What could improve:**
- **Missing:** The `ask_user_guidance.txt` is NOT appended to this prompt (unlike the main agent). The guidance is partially restated inline (Rule 5) but inconsistently.
- **Missing:** No context-discipline rules from `agent_system.txt` — the DB agent could be overly chatty or waste reads.
- **Missing:** Shell/platform hint not included.
- Rule 4 ("warn the user before running slow queries") is vague — what constitutes "slow"? How to detect it?
- Split between "concise SQL for simple queries" and "detailed explanations for complex" is ambiguous.

---

### `templates/plan_injection_header.txt` — Active plan wrapper (6 lines)

**Purpose:** Injected into system prompt when plans exist. Tells agent to check off steps, work one at a time, flag blockers.

**Where used:** `src/agent/index.ts` line 66 → `buildActiveSystemPrompt()`.

**What's good:**
- Strong execution discipline (check off steps, don't deviate)
- Blocker flagging prevents silent workarounds
- File path IS injected: `buildActiveSystemPrompt()` prepends `### Plan File: ".agent/plans/${p.name}.md"` before plan content (line 155 of `agent/index.ts`)

**What could improve:**
- No guidance on what to do when all steps are complete (archive? report?).

---

### `templates/manual_skill_header.txt` — Skill wrapper (5 lines)

**Purpose:** Injected before matched skills. Tells agent the skills are harness-selected and must be followed.

**Where used:** `src/agent/index.ts` line 67 → `buildActiveSystemPrompt()`.

**What's good:**
- Clarifies authority model (skills > developer request)
- Forces transparency ("say why in one line" when overriding)

**What could improve:**
- "Follow the skill and say why in one line" is abrasive — could offer alternatives instead.
- No mention of what to do if the developer explicitly rejects a skill.

---

### `templates/session_summary_system.txt` — Session summarizer (4 lines)

**Purpose:** One-shot prompt for summarizing a completed session. Produces markdown stored in `.agent/sessions/`.

**Where used:** `src/memory/project.ts` line 129.

**What's good:**
- Very concise
- "Do not include introductory text" prevents "Here is a summary..." boilerplate

**What could improve:**
- **No structured output format** — "single, concise markdown paragraph" varies across models. Should define sections (goals, files changed, decisions) for consistency.
- No length limit — long sessions could produce very long summaries.
- No example.

---

## Structural issues

### 1. Prompts vs Templates distinction is fuzzy

The only real difference per `readPromptSync`'s JSDoc:
- **Prompts** = substantive system instructions (persona, behavior)
- **Templates** = "short glue strings injected around dynamic content"

But `session_summary_system.txt` defines a persona ("you are a technical documenter") yet lives in `templates/`. Meanwhile `ask_user_guidance.txt` is a short glue-like appendix but lives in `prompts/`. Recommend a clear convention:
- Everything that defines a persona → `prompts/`
- Everything that wraps/structures dynamic content (plans, skills) → `templates/`

Move `session_summary_system.txt` to `prompts/` (it assigns a persona).

### 2. Duplication between prompts and skills

- `planner_draft_system.txt` ≈ `skills/planner/SKILL.md` (nearly identical)
- `planner_critique_system.txt` ≈ `skills/plan_review/SKILL.md` (nearly identical)
- `db_admin_system.txt` ≈ `skills/db_admin/SKILL.md` (related but different levels of detail)

The prompts are **fallbacks** used when no project skill overrides them. This is a valid pattern but the duplication must be maintained carefully. Consider moving all default skill content into prompts and having skills be **additive** (extend, not replace).

### 3. Missing content

| What's missing | Where it should go |
|---|---|
| Available tool inventory | `agent_system.txt` |
| Communication style/tone | `agent_system.txt` |
| Platform hint (currently in code) | `agent_system.txt` via placeholder |
| Plan file path for edit_file | `plan_injection_header.txt` |
| Approved-plan output format | `planner_critique_system.txt` |
| Session summary structured sections | `session_summary_system.txt` |
| DB agent's ask_user guidance | `db_admin_system.txt` (inlined from `ask_user_guidance.txt`) |

---

## Quick wins (sorted by impact)

1. **Merge `ask_user_guidance.txt` into `agent_system.txt`** — always loaded, only 6 lines, removes dead try/catch
2. **Remove "read these files" from planner prompts** — code already injects them, model wastes a turn
3. **Move `session_summary_system.txt` to `prompts/`** — it's a persona prompt, not a structural template
4. **Add structured output format to session summary** — sections reduce variance
5. **Add tool inventory to main agent prompt** — reduces wasteful exploration
6. **Inline platform hint** — remove from `agent/index.ts` code, use placeholder in `agent_system.txt`
7. **Consolidate planner prompts** — keep fallback in prompts, make skills additive

> Note: plan file path IS already injected by `buildActiveSystemPrompt()` — no change needed there.
