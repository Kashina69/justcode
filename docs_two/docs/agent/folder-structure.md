# Folder Structure

Below is an annotated map of the major directories in the Wade Super Admin codebase:

- **[app/](file:///c:/STUFF/code/office/budget-tracker/superadmin/app)** — Core router directory defining the page routes, layout wrappers, and Next.js backend API routes.
    - **[(auth)/](<file:///c:/STUFF/code/office/budget-tracker/superadmin/app/(auth)>)** — Guest-accessible routes for user authentication flows (sign-in, forgot-password, update-password).
    - **[api/](file:///c:/STUFF/code/office/budget-tracker/superadmin/app/api)** — Next.js Route Handlers implementing backend REST APIs (auth, agencies, dashboard, etc.).
    - **[agency-management/](file:///c:/STUFF/code/office/budget-tracker/superadmin/app/agency-management)** — Front-end routes, components, data loaders, types, and constants for managing registered agencies.
    - **[ai-platform-configuration/](file:///c:/STUFF/code/office/budget-tracker/superadmin/app/ai-platform-configuration)** — Routing and page files for configuring AI provider credentials and token limits.
    - **[dashboard/](file:///c:/STUFF/code/office/budget-tracker/superadmin/app/dashboard)** — Front-end layout, charts, activity logs, and metric cards display.
    - **[notifications/](file:///c:/STUFF/code/office/budget-tracker/superadmin/app/notifications)** — Front-end routes and component files for dispatching system notifications.
    - **[settings/](file:///c:/STUFF/code/office/budget-tracker/superadmin/app/settings)** — Form-based routing for updating the admin profile.
    - **[subscription-billing-management/](file:///c:/STUFF/code/office/budget-tracker/superadmin/app/subscription-billing-management)** — Route, tables, and data models for managing subscription models.
- **[components/](file:///c:/STUFF/code/office/budget-tracker/superadmin/components)** — Reusable UI modules, layout wrappers, and primitives.
    - **[common/](file:///c:/STUFF/code/office/budget-tracker/superadmin/components/common)** — Shared tabular structures, pagination controls, and generic headers.
    - **[global/](file:///c:/STUFF/code/office/budget-tracker/superadmin/components/global)** — Standard stateless design-system components (buttons, input fields, badges, loaders, modals).
    - **[layout/](file:///c:/STUFF/code/office/budget-tracker/superadmin/components/layout)** — Framework layout parts (sidebar navigation, header wrappers, main layout shell).
    - **[modules/](file:///c:/STUFF/code/office/budget-tracker/superadmin/components/modules)** — Modular component files specific to high-level features (e.g. `authentication`, `dashboard`, `agency-management`).
    - **[providers/](file:///c:/STUFF/code/office/budget-tracker/superadmin/components/providers)** — Global context providers that wrap the App Router root.
- **[contexts/](file:///c:/STUFF/code/office/budget-tracker/superadmin/contexts)** — React state context systems (e.g., [AuthContext.tsx](file:///c:/STUFF/code/office/budget-tracker/superadmin/contexts/AuthContext.tsx) to manage auth sessions).
- **[hooks/](file:///c:/STUFF/code/office/budget-tracker/superadmin/hooks)** — Reusable React hook files containing stateful logic (e.g. metric aggregations, input bindings).
- **[libs/](file:///c:/STUFF/code/office/budget-tracker/superadmin/libs)** — External API SDK clients, specifically client wrappers for Supabase (client, server, and administrative scopes).
- **[scripts/](file:///c:/STUFF/code/office/budget-tracker/superadmin/scripts)** — Back-end CLI files and helper operations, e.g. SQL scripts and database seeding utilities.
- **[services/](file:///c:/STUFF/code/office/budget-tracker/superadmin/services)** — Modularized API request functions separating client network transactions from component logic.
- **[types/](file:///c:/STUFF/code/office/budget-tracker/superadmin/types)** — Global, shared TypeScript interface and type declarations.
- **[utils/](file:///c:/STUFF/code/office/budget-tracker/superadmin/utils)** — Global utility helpers, HTTP request wrappers, error parsers, and API responders.
- **[validations/](file:///c:/STUFF/code/office/budget-tracker/superadmin/validations)** — Zod-based verification schemas for incoming forms and payloads.
