# token-efficiency-plan.md — manual skill injection + budget calibration

Two changes, both about cutting token/latency cost that isn't buying anything.
Extends `plan.md`; supersedes the skill-loading design in `plan.md` §6 where they
conflict — this document wins for skill-injection mechanics specifically.

---

## Part A — Manual skill injection (remove the LLM classifier call)

### What's being removed
`prompts/skills_match_system.txt` and the API round-trip it represents — delete the
file. Every turn currently pays for an extra call just to decide which skills apply.
For `coding-efficiency`, which is relevant to essentially every coding task, that
call's answer is "yes" close to 100% of the time. Paying a model call to learn
something deterministic is waste, not safety.

Also delete: `skills/caveman/SKILL.md`, `skills/ponytail/SKILL.md`,
`templates/skill_injection_header.txt` — all superseded by
`skills/coding-efficiency/SKILL.md` and `templates/manual_skill_header.txt`.

### What replaces it
Skill selection becomes plain code, not a model decision:

```ts
function selectActiveSkills(
  taskContext: TaskContext,
  projectMetadata: ProjectMetadata
): SkillDefinition[] {
  const active: SkillDefinition[] = [codingEfficiencySkill]; // always on

  // project-specific skills: deterministic checks, not semantic matching
  if (projectMetadata.dependencies.includes("next")) {
    active.push(nextjsConventionsSkill);
  }
  // extend with further checks as project-specific skills are added —
  // package.json dependency checks, file-extension checks, simple keyword
  // matches against the task description. Never an LLM call.

  return active;
}
```

The harness injects `templates/manual_skill_header.txt` followed by the full text of
whatever `selectActiveSkills` returns. The agent is told which skills are active; it
doesn't decide, and nothing decides via inference.

### Acceptance criteria
- [ ] No API call happens solely to determine skill relevance
- [ ] `coding-efficiency` is present in every coding-task request
- [ ] Adding a new project-specific skill requires only a new entry in
      `selectActiveSkills`, no other prompt changes

---

## Part B — Token-budget self-declaration and calibration feedback

### Where this stands, honestly
Two mechanisms were proposed together; they don't have equal evidence behind them,
and this design keeps the strong ones and drops the weak one.

- **"You are being scored," as motivational/game framing** — not a verified
  technique. No real scoring happens at inference time; it's prompt text dressed up
  as stakes. May have a mild effect from being a more emphatic instruction, but it's
  not load-bearing here and isn't included as written.
- **Pre-committing to an explicit length budget before generating** — real,
  reasonably well-supported. A concrete target gives the model something to
  self-monitor against, the same way stated acceptance criteria improve plan quality.
- **Feeding back actual prior-turn token usage as calibration data** — the strongest
  part of the original idea, and consistent with this project's own "measure, don't
  assume" principle from `plan.md` §2.5. Concrete numbers are a real signal; vague
  encouragement isn't.

### Design

**Declaration** — model-side, one line, before substantive output:
```
[budget: ~N lines / files]
```
Already added as rule 6 in `skills/coding-efficiency/SKILL.md`, with an explicit
override: correctness and required defensive checks are never sacrificed to hit a
self-declared number. Ship the override in the same sentence as the mechanism —
without it, this creates a real Goodhart's-law risk of truncating correct output
just to match a number the model picked itself.

**Calibration** — harness-side, injected dynamically, never part of the cached
static prefix since it changes every turn:
```ts
function buildCalibrationNote(previousTurn: TurnMetrics | null): string {
  if (!previousTurn) return "";
  return `[prior turn: declared ~${previousTurn.declaredBudget}, used ${previousTurn.actualOutputTokens}]`;
}
```
Prepend to the user-turn portion of the next request. Small, recurring cost (roughly
15-20 tokens/turn) for a real feedback signal rather than a hypothetical one.

### What NOT to build
- No verbose post-hoc self-grading paragraph ("I used X tokens, my target was Y,
  here's my analysis...") — that costs more tokens than the mechanism could ever
  save.
- No hard reject/retry when a response exceeds its declared budget — that's another
  round-trip, and `fix.md` already identified repeated round-trips as the single
  costliest pattern observed so far in this project. Don't reintroduce it here.

### Acceptance criteria
- [ ] Every substantive coding-task response opens with a one-line budget
      declaration
- [ ] The harness logs declared-vs-actual per turn, extending the usage logging
      already specified in `fix.md`
- [ ] After a week of normal use, compare average output tokens for comparable
      tasks before and after this change. If it isn't measurably lower, drop the
      calibration note — don't carry a permanent per-turn cost for no measured
      effect
- [ ] No instance found where a response was observably wrong or incomplete because
      it was truncated to fit a self-declared budget
