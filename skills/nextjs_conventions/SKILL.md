---
name: nextjs-conventions
description: Next.js projects — detected via package.json dependency on "next"
---
# Next.js-Specific Gotchas

- params/searchParams/cookies()/headers() are async since Next.js 15 — always await before accessing properties.
- Don't rely on __dirname for runtime file paths — webpack/Turbopack bundling doesn't preserve it reliably. Use process.cwd() or an explicitly passed root path.
