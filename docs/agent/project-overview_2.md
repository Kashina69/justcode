# Project Overview

This project is the Next.js frontend application for the Wade Super Admin dashboard, designed for platform administrators to manage agencies, monitor system metrics, configure AI platform settings, configure subscription and billing options, send notifications, and handle administrative settings.

## Tech Stack

- **Language:** TypeScript (`"typescript": "^5.7.2"`)
- **Framework:** Next.js 14 (App Router) (`"next": "^14.2.25"`)
- **Styling:** Tailwind CSS (`"tailwindcss": "^3.4.16"`)
- **Database/Auth Provider:** Supabase via `@supabase/ssr` (`^0.12.0`) and `@supabase/supabase-js` (`^2.108.1`)
- **State Management / Context:** React Context API (`contexts/AuthContext.tsx`)
- **UI Components & Icons:** Recharts (`^3.8.1`), Lucide React (`^0.468.0`), Tabler Icons Webfont (`^3.44.0`)
- **Validation:** Zod (`"zod": "^4.4.3"`)

## Main Capabilities / Feature Areas

- **Authentication:** Secure sign-in, recovery OTP verification, password reset, and session management using Supabase Auth.
- **Agency Management:** Complete oversight of registered agencies including paginated listing, deep-dive detail views, status modification (active/suspended), and plan management.
- **AI Platform Configuration:** Configuration interface for managing models, limits, and provider endpoints.
- **Subscription & Billing Management:** Monitoring subscription plans, statuses, and payment records.
- **Dashboard Metrics:** Real-time data visualization including Registered Agencies, Monthly Revenue, Active User Sessions, and Avg. AI Model Tokens/Sec, accompanied by sparklines and activity logs.
- **Notifications Management:** Panel to dispatch, schedule, and view system-wide or targeted notifications.
- **Settings:** Account settings and admin profile modification.

## Entry Points

- **Application Layout:** [app/layout.tsx](file:///c:/STUFF/code/office/budget-tracker/superadmin/app/layout.tsx) - Configures the root layout structure, imports global styles, and wraps the app with `Providers`.
- **Providers Wrapper:** [components/providers/Providers.tsx](file:///c:/STUFF/code/office/budget-tracker/superadmin/components/providers/Providers.tsx) - Mounts the `AuthProvider` context.
- **Global Stylesheet:** [app/globals.css](file:///c:/STUFF/code/office/budget-tracker/superadmin/app/globals.css) - Main styling file containing Tailwind imports and global style overrides.
- **Routing/Middleware:** [middleware.ts](file:///c:/STUFF/code/office/budget-tracker/superadmin/middleware.ts) - Cryptographically verifies auth session cookies and regulates redirect flows for guest/authorized routes.
- **Database Seeding CLI:** [scripts/seed-super-admin.ts](file:///c:/STUFF/code/office/budget-tracker/superadmin/scripts/seed-super-admin.ts) - Executed using `npm run seed:super-admin` to bootstrap the default super admin credentials in Supabase.
