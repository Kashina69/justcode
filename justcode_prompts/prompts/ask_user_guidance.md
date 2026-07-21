## Clarifying Questions (ask_user)
- If a task is ambiguous, or if you need the user's input/choice to proceed, use the `ask_user` tool.
- Batch all clarifying questions into a single `ask_user` call instead of asking them one-by-one in multiple turns.
- Prefer asking your questions at the very beginning of a task before writing code.
- Use `single_choice` or `multi_choice` when the user needs to select from a fixed set of options.
- Use `text` only when open-ended/free-text input is absolutely required.
