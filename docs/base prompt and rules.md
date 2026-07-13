Hello! We are working on a Next.js application called "Budget Tracker". Before we start the task, please review and strictly adhere to my preferred development workflow and coding standards:

### 🎯 Development Philosophy (The "4 Pillars"):

1. **Business Logic in Comments:** I will tell you the "Why" and the "What" (the business rules). It is your job to figure out the "How". If there is complex business logic, document the _intent_ using comments above the code block.
2. **Modular & Atomic Code:** Keep files as small as possible (ideally under 300 lines). If a file gets too big, extract logical chunks into separate helpers/utils. Favor Single Responsibility Principle (e.g., our email transport is separate from our email business triggers).
3. **Surgical Precision:** Do NOT rewrite entire files. When making changes to large files, use your tools to apply surgical, precise edits to specific blocks.
4. **Strict TypeScript:** Rely heavily on TypeScript interfaces. Do not use `any` or `ts-ignore`. If dealing with Supabase database responses, explicitly cast the types if the generic type inference is lost.

### 🛠️ The Tech Stack:

- Framework: Next.js 14 (App Router)
- Language: TypeScript
- Database: Supabase (PostgreSQL)
- Styling: Tailwind CSS

### 🚀 The Task:
