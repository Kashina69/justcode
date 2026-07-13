---
name: analyze
description: Analyzes an existing codebase to produce project overview, folder structure, and code conventions under the agent/ folder.
---

ROLE
You are analyzing an existing codebase to produce a written profile of it. This
profile will be loaded into every future coding session as static context, so
future AI-assisted work matches this codebase's actual conventions instead of
generic defaults. Accuracy matters more than completeness — a wrong claim here
actively misleads every future session that reads it.

OBJECTIVE
Produce three files in a new top-level `agent/` folder (not `.agent/` — this one
is meant to be human-readable and version-controlled):

  agent/project-overview.md   — what this project is and does
  agent/folder-structure.md   — annotated map of the codebase
  agent/code-conventions.md   — observed coding standards, with evidence

HARD RULES — read these before starting
1. Document what IS, not what SHOULD be. You are not writing a style guide of
   best practices — you are recording the actual, current conventions of this
   specific codebase, even if they're imperfect or inconsistent.
2. Never state a convention without pointing to a real example. Every claim in
   code-conventions.md must cite at least one specific file and, where useful,
   a line number or function name. "This codebase uses camelCase for functions"
   is not acceptable on its own — "Functions use camelCase, e.g. getUserById in
   src/services/user.ts" is.
3. If you find inconsistency, report it as inconsistency. Do not silently pick
   the version you think is cleaner and present it as the standard. State which
   pattern is dominant (with a rough file count) and which files are outliers.
   Future sessions need to know the codebase isn't uniform, not be told a lie
   that it is.
4. Trust config files over inferred patterns. eslint configs, prettier configs,
   tsconfig.json, .editorconfig, and similar are ground truth — read them
   directly rather than guessing the standard from a handful of code samples.
5. No padded prose. Bullet points and short, concrete statements. A future
   session reading this should get the facts in seconds, not paragraphs.
6. Sample broadly, not narrowly. Read files from every major directory, not
   just the first few you encounter — conventions can differ between, say, the
   API layer and the frontend, and you need to catch that.

PROCESS

Step 1 — Map the structure
- Get a full directory tree, excluding node_modules, build output, .git, lock
  files, and other generated/vendored content.
- For each top-level and significant second-level directory, open 2-3
  representative files to determine its actual purpose (don't guess from the
  folder name alone — "utils" can mean very different things).

Step 2 — Identify the stack
- Read package.json / requirements.txt / go.mod / Cargo.toml / etc.
- Note the language(s), frameworks, major dependencies, build tooling, and
  package manager in use.
- Note the framework's major version specifically (e.g. "Next.js 15.2") — this
  matters more than it sounds like it should, since framework conventions
  shift between major versions.

Step 3 — Determine what the project actually does
- Read the README if one exists.
- Read the package/project description field if present.
- Look at entry points: main files, route definitions, CLI command
  registrations, exported public API surface.
- Summarize: what does this software do, who is it for, what are its main
  user-facing or system-facing capabilities.

Step 4 — Sample real code across the codebase
- Read at least 2-3 files from each major directory identified in Step 1.
- Look specifically for: naming conventions (files, functions, variables,
  types), function length/decomposition style, error-handling approach
  (exceptions vs return codes vs Result types, etc.), comment density and
  style, import/module organization, testing approach and coverage level,
  any consistent architectural pattern (e.g. repository pattern, MVC, hooks-
  based, etc.).

Step 5 — Extract conventions, with evidence
- For each convention you identify, note: the pattern itself, a specific
  example (file + line/function), and whether it's consistent throughout or
  has exceptions.
- Cross-check against any linter/formatter config found in Step 2 — if a
  config exists, quote its actual rules rather than re-deriving them from
  code samples.

Step 6 — Write the three output files

  agent/project-overview.md
    - One paragraph: what this project is and who it's for
    - Tech stack (language, framework + version, key dependencies)
    - Main capabilities / feature areas (bullet list)
    - Entry points (where execution starts, where routes/commands are defined)

  agent/folder-structure.md
    - Annotated directory tree (major folders only, not every file)
    - One line per folder: its actual purpose, based on what you read in it,
      not what its name implies
    - Note any folder whose contents don't match what its name suggests

  agent/code-conventions.md
    - Naming conventions (files, functions, variables, types) — with examples
    - Error-handling pattern — with examples
    - Testing approach (framework, location, what's covered) — with examples
    - Formatting/linting rules — quoted directly from config files if present
    - Any consistent architectural pattern in use — with examples
    - A clearly labeled "Inconsistencies" section listing anywhere the
      codebase doesn't follow one rule uniformly, with the dominant pattern
      and the outliers named by file

DO NOT
- Invent conventions the codebase doesn't actually demonstrate
- Smooth over inconsistencies into a single idealized rule
- Pad output with generic software-engineering advice not grounded in what you
  actually read
- Skip directories because they look unimportant — an undocumented convention
  in a "minor" folder is still a convention a future session needs to match

WHEN DONE
Report which files you read to produce each claim, so a human can spot-check
this analysis before it becomes load-bearing context for every future session.