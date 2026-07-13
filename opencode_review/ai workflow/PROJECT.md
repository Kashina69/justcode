# ai workflow/ — Project File Inventory

> Supporting materials for skill development: Python tooling, agent prompts, skill drafts, and eval infrastructure.

---

## Quick reference

| Category | Files | Purpose |
|---|---|---|
| **Skills** | 5 | Skill definitions (skill-creator ×3 dupes, frontend-design ×2 variants) |
| **Agent prompts** | 3 | Subagent instructions (analyzer, comparator, grader) |
| **Python scripts** | 9 | Eval, validation, packaging, improvement, benchmarking |
| **Eval viewer** | 2 | HTML+Python for human review of skill outputs |
| **Templates** | 1 | HTML for description-optimization eval set editor |
| **Reference** | 1 | JSON schemas for all data formats |
| **Archives** | 2 | Distributable skill bundles (zip) |
| **Scratch** | 1 | Personal AI model notes |
| **Legal** | 1 | Apache 2.0 license |

---

## File-by-file inventory

### Root

**`ai models list.md`** (52 lines)
Personal scratchpad: AI models, tool names, rough ideas about building a "workflow skill project specific instruction and harness." Not loaded by any code. Stale — can archive.

### skills/ — Skill definitions

**`skills/SKILL.md`** (485 lines)
Skill Creator meta-skill. Exact duplicate of `skill-creator/SKILL.md`.

**`skills/SKILLS-CREATOR-SKILL.md`** (485 lines)
Skill Creator meta-skill. Exact duplicate of `skill-creator/SKILL.md`.

**`skills/FRONTEND_DESIGN_SKILL.md`** (55 lines)
Polished frontend design skill. Teaches the agent to act as a design lead creating distinctive visual identities. Covers: design principles (hero as thesis, typography as personality, structure as information, deliberate motion), brainstorm-critique-code process, anti-AI-aesthetic guidance. **Active.**

**`skills/FRONTEND_DESIGN_SKILLmd`** (42 lines)
Earlier draft of frontend design skill. Missing `.md` extension (broken filename). Stale — delete.

### skills/skill-creator/ — Core skill-creator package

**`skill-creator/SKILL.md`** (485 lines)
**Canonical** Skill Creator meta-skill. Teaches full skill creation lifecycle:
- Capture intent → interview → draft SKILL.md → create evals
- Parallel subagent runs (with-skill vs baseline)
- Grade results → aggregate benchmarks → launch eval viewer
- Iterate: run eval → improve description → re-evaluate → select best
- Blind A/B comparison → post-hoc analysis
- Packaging into `.skill` files
- Platform-specific: Claude.ai, Claude Code, Cowork

**`skill-creator/LICENSE.txt`** (202 lines)
Apache License 2.0.

### skill-creator/agents/ — Subagent prompts

**`agents/analyzer.md`** (274 lines)
Two-part agent prompt:
1. **Post-hoc Analyzer** — after blind comparison, determines WHY winner won, identifies strengths/weaknesses, prioritizes improvements
2. **Benchmark Analyzer** — reviews benchmark data for patterns, anomalies, non-discriminating assertions

**`agents/comparator.md`** (202 lines)
Blind Comparator — receives two skill outputs (A/B), generates rubric, scores each, checks assertions, determines winner. Outputs structured JSON.

**`agents/grader.md`** (223 lines)
Grader — evaluates assertions against execution transcript, PASS/FAIL with evidence, extracts implicit claims, critiques eval quality. Outputs `grading.json`.

### skill-creator/scripts/ — Python tooling

**`scripts/__init__.py`** (0 lines)
Empty package init.

**`scripts/utils.py`** (47 lines)
`parse_skill_md()` — parses SKILL.md frontmatter (name, description) with multiline YAML support.

**`scripts/run_loop.py`** (328 lines)
Main optimization loop. Stratified train/test split, iterates eval→improve→re-evaluate, selects best description by test score. Generates live HTML reports.

**`scripts/run_eval.py`** (310 lines)
Trigger evaluation: spawns `claude -p` subprocesses in parallel, detects skill triggering via streaming JSON events. Configurable runs/query, threshold, model.

**`scripts/quick_validate.py`** (146 lines)
Validates skill directory: SKILL.md exists, one SKILL.md, valid YAML, kebab-case name, length limits, allowed properties.

**`scripts/package_skill.py`** (136 lines)
Packages skill into `.skill` ZIP. Runs `quick_validate` first. Excludes __pycache__, node_modules, .pyc, .DS_Store, evals/.

**`scripts/improve_description.py`** (247 lines)
Calls `claude -p` with eval failures + previous attempts + full SKILL.md to propose improved description. Safety net: shortens if over 1024 chars.

**`scripts/generate_report.py`** (326 lines)
Generates HTML table from `run_loop.py` JSON output. Shows iterations × query results, train/test scores, highlights best row.

**`scripts/aggregate_benchmark.py`** (401 lines)
Aggregates grading results → benchmark stats (mean/stddev/min/max per config). Outputs `benchmark.json` + `benchmark.md`. Validates schema.

### skill-creator/eval-viewer/ — Human review UI

**`eval-viewer/generate_review.py`** (471 lines)
Discovers run outputs, embeds files (text, images, PDF, xlsx) as base64, injects into `viewer.html` template. Runs HTTP server with auto-saving feedback API. Supports iteration comparison and benchmark embedding.

**`eval-viewer/viewer.html`** (1325 lines)
Self-contained HTML/CSS/JS review UI. Two tabs: Outputs (prompts, file rendering, grades, feedback) and Benchmark (stats table, per-eval detail). Keyboard nav, auto-save, submit-all-reviews.

### skill-creator/assets/

**`assets/eval_review.html`** (146 lines)
HTML template for eval set editor during description optimization. Edit queries, toggle should_trigger, export as `eval_set.json`. Three placeholders for injection.

### skill-creator/references/

**`references/schemas.md`** (430 lines)
Complete JSON schemas for: `evals.json`, `history.json`, `grading.json`, `metrics.json`, `timing.json`, `benchmark.json`, `comparison.json`, `analysis.json`. Annotated examples.

### skill-creator/zips/ — Distribution archives

**`zips/skills-bundle.zip`** (82 KB)
Likely distributable archive of the skill-creator + frontend-design skills.

**`zips/files.zip`** (95 KB)
Unknown — likely backup. Duplicate content risk.

---

## Cleanup needed

| File | Issue | Action |
|---|---|---|
| `skills/SKILL.md` | Exact duplicate of canonical `skill-creator/SKILL.md` | Delete |
| `skills/SKILLS-CREATOR-SKILL.md` | Exact duplicate of canonical `skill-creator/SKILL.md` | Delete |
| `skills/FRONTEND_DESIGN_SKILLmd` | Broken filename (no `.` before `md`); stale draft | Delete |
| `ai models list.md` | Personal scratch notes, not code | Archive or delete |
| `zips/files.zip` | Unknown content, may duplicate `skills-bundle.zip` | Check and clean up |
