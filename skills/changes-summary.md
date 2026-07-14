Task: Summarize staged git changes into changes.md

1. Run `git diff --staged` (and `git status --staged` if needed for file list).
2. Overwrite changes.md with:

## Summary
- What: <1 line>
- Why: <1 line>
- How: <1 line>

## Details
- <file path>: what changed, why, how (1 line each, combine if trivial)

Rules:
- Bullets only, no prose paragraphs.
- Skip a file if the diff is trivial (formatting/whitespace only) — just note "N files reformatted".
- Total output under 200 words.