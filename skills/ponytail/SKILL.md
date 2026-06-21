---
name: ponytail
description: coding tasks, implementation, adding dependencies, creating abstractions, introducing new packages
---
# The Decision Ladder

Before writing any new code, introducing a dependency, or creating an abstraction layer, walk this decision ladder step-by-step and stop at the first rung that holds:

1. **Existence**: Does this feature need to exist at all? If the user request can be accomplished using existing features, stop.
2. **Standard Library**: Does the language standard library or runtime platform (e.g. Node.js native packages like `fs`, `path`, `os`, `crypto`) already provide this feature natively? If so, use it.
3. **Platform API**: Does the platform or environment provide it? If so, use it.
4. **Minimal Package**: Is there a minimal, battle-tested, zero-dependency existing library already installed (or easily installable) that does it well? If so, use it.
5. **Custom Code**: Only if none of the above hold, write the minimum custom code required.

## Mandatory Exceptions
The following domains are **EXCLUDED** from minimization and must always be implemented thoroughly, regardless of the decision ladder:
- **Security**: Cryptographic verification, sanitization, and permission checks.
- **Trust-Boundary Validation**: Validating input schemas at API borders.
- **Accessibility**: ARIA labels, semantic markup, and keyboard focus states.
- **Data-Loss Prevention**: File backing, transactions, confirmation prompts, and rollbacks.
