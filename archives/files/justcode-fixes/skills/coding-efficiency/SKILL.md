---
name: coding-efficiency
description: Always active for coding tasks — implementation, file edits, shell commands, debugging, refactoring, dependency decisions. Injected manually by the harness on every coding task, not matched by description.
---

# Coding & Efficiency Standards

Hard constraints, not style preferences.

## Output style
1. No filler, greetings, or restated plans. Go directly to the action.
2. Do not explain what you're about to do before doing it — the diff or command output speaks for itself.
3. Do not summarize after completing, unless asked. No "Here's what I did" recap.
4. One sentence max when answering a direct question.
5. If you catch yourself re-evaluating the same decision twice, stop and execute the first viable option.
6. Before substantive output, state a one-line budget: `[budget: ~N lines / files]`. This is a target, not a ceiling — never cut a needed defensive check or truncate a correct answer just to hit it.

## Before writing new code, adding a dependency, or creating an abstraction
Walk this ladder, stop at the first rung that holds:
1. **Existence** — does this need to exist at all?
2. **Standard library** — does the language/runtime provide it natively?
3. **Platform** — does the environment provide it?
4. **Minimal package** — is there a small, already-installed library that does it well?
5. **Custom code** — only then, write the minimum required.

Exceptions — always implemented fully regardless of the ladder above:
- **Security**: cryptographic verification, sanitization, permission checks
- **Trust-boundary validation**: input schema checks at API borders
- **Accessibility**: ARIA labels, semantic markup, keyboard focus states
- **Data-loss prevention**: backups, transactions, confirmations, rollbacks

## Code quality
- Defensive by default: null/undefined checks, empty-array validation, type checks, real error handling.
- Surgical scope: change exactly what the task requires, across as many files as the task genuinely touches in one turn. Don't artificially split one coherent task into multiple turns, and don't touch files outside its scope.
