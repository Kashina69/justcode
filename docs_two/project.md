# Agency Portal — Project Reference

This document is the **canonical reference** for any developer or AI agent working on this codebase. Read this before touching any file.

---

## 1. What This Application Is

**Agency Portal** is a multi-tenant SaaS platform for project-based agencies. Each customer is a **Tenant** (an agency workspace). The platform lets agencies manage:

- Projects with phases, milestones, budget items, and document uploads
- Client relationships and communications
- Team members, departments, and custom role-based access
- Timesheets (submit → approve / reject workflow)
- Expenses (draft → submit → approve / reject workflow)
- AI-powered project health insights
- Agency settings: billing, branding, notifications, security

There is also a separate **Superadmin** portal (`/superadmin` workspace) for platform-level administration — that is a completely separate Next.js app and is NOT part of this directory.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS |
| Database | Supabase (PostgreSQL + Row Level Security) |
| Auth | Supabase Auth (email/password + magic link) |
| Payments | Stripe (subscription billing) |
| Email | Custom email via `lib/email.ts` |
| Icons | Lucide React |
| State | React `useState` / `useContext` (no Redux or Zustand) |
| AI | LangChain / LLM pipeline via `lib/ai-insights.ts` |

---

## 3. Full Directory & File Map

```
agency/
├── app/
│   ├── layout.tsx                        # Root layout (fonts, metadata)
│   ├── globals.css                       # Tailwind base, global scrollbars, brand color tokens
│   ├── page.tsx                          # Root redirect → /dashboard or /login
│   ├── error.tsx                         # Global error boundary
│   ├── loading.tsx                       # Suspense fallback
│   ├── not-found.tsx                     # 404 page
│   │
│   ├── (auth)/                           # Authentication route group
│   │   ├── login/                        # Login page
│   │   └── signup/                       # Signup page
│   │
│   ├── auth/                             # Supabase auth callback handler
│   │
│   ├── onboarding/                       # First-run onboarding flow (profile + membership setup)
│   │
│   ├── (public)/                         # Public-facing pages (no auth required)
│   │
│   └── (dashboard)/                      # Protected dashboard route group
│       ├── layout.tsx                    ← CRITICAL: Auth gate, RBAC check, DashboardSessionProvider
│       ├── loading.tsx
│       ├── dashboard/                    # KPI overview page
│       ├── projects/                     # Project list + detail drawer
│       ├── clients/                      # Client CRM module
│       ├── team/                         # Team members + departments
│       ├── roles/                        # Custom role builder
│       ├── timesheets/                   # Timesheet submission + approval
│       ├── expenses/                     # Expense recording + approval
│       ├── ai-analytics/                 # AI insights dashboard
│       ├── notifications/                # Notification center
│       └── settings/                     # Agency settings (billing, branding, security, etc.)
│
├── app/api/
│   ├── billing/                          # Stripe webhook + checkout
│   ├── queries/                          # Generic query helpers
│   └── workspace/
│       ├── ai-insights/
│       │   ├── route.ts                  # GET: fetch cached AI insights for workspace
│       │   └── stream/route.ts           # POST: trigger SSE AI generation pipeline
│       ├── clients/                      # CRUD for client records + contacts + communications
│       ├── dashboard/                    # GET: dashboard KPI aggregation
│       ├── expenses/
│       │   ├── route.ts                  # GET (list), POST (create)
│       │   └── [id]/
│       │       ├── route.ts              # PATCH (update), DELETE
│       │       └── approval/route.ts     # PATCH: approve or reject
│       ├── members/                      # Team member CRUD
│       ├── notifications/                # Notification fetch + mark-read
│       ├── projects/
│       │   ├── route.ts                  # GET (list), POST (create)
│       │   └── [id]/
│       │       └── route.ts              # GET (detail), PATCH (update), DELETE
│       ├── reports/                      # Export endpoints
│       ├── roles/
│       │   ├── route.ts                  # GET (list), POST (create)
│       │   └── [id]/
│       │       └── route.ts              # PATCH (update permissions), DELETE
│       ├── session/route.ts              # GET: re-fetch session (used by DashboardSessionProvider)
│       ├── teams/
│       │   ├── route.ts                  # GET (list), POST (create)
│       │   └── [id]/route.ts             # PATCH, DELETE
│       └── timesheets/
│           ├── route.ts                  # GET (list), POST (create)
│           └── [id]/
│               ├── route.ts              # PATCH, DELETE
│               └── approval/route.ts     # PATCH: approve or reject
│
├── components/
│   │
│   ├── ui/                               # Primitive UI components
│   │   ├── button.tsx                    # <Button variant="primary|secondary|ghost"> 
│   │   ├── field.tsx                     # <Field> and <ModalField> — label + counter + error wrapper
│   │   ├── input.tsx                     # <Input> — styled text input
│   │   ├── custom-select.tsx             # <CustomSelect> — accessible dropdown
│   │   ├── dialog.tsx                    # <Dialog> — modal overlay
│   │   ├── badge.tsx                     # <Badge>
│   │   ├── card.tsx                      # <Card>
│   │   ├── shiny-text.tsx                # Animated gradient text
│   │   ├── password-input.tsx            # Password field with show/hide toggle
│   │   ├── phone-input.tsx               # International phone input
│   │   └── submit-button.tsx             # Form submit with loading state
│   │
│   ├── providers/
│   │   ├── dashboard-session-provider.tsx  # React Context for session data (permissions, subscription, user)
│   │   ├── session-activity-guard.tsx      # Auto logout on inactivity
│   │   └── ui-provider.tsx                 # Toast/feedback context
│   │
│   ├── dashboard-shell.tsx               # Root layout chrome: sidebar + topbar + content area
│   ├── dashboard-nav.tsx                 # Sidebar navigation links (RBAC-filtered)
│   ├── dashboard-top-actions.tsx         # Top bar: sidebar toggle, user avatar
│   ├── dashboard-sidebar-footer.tsx      # Bottom of sidebar: user menu
│   ├── dashboard-account-menu.tsx        # Account dropdown (settings, logout)
│   ├── dashboard-kpi-card.tsx            # KPI stat card component
│   ├── dashboard-content-skeleton.tsx    # Loading skeleton for dashboard
│   │
│   ├── projects-page-client.tsx          ← LARGEST FILE (~5700 lines). All project UI logic
│   ├── clients-page-client.tsx           # Client CRM UI
│   ├── timesheets-page-client.tsx        # Timesheet management UI
│   ├── expenses-page-client.tsx          # Expense management UI
│   ├── team-page-client.tsx              # Team + member management UI
│   ├── roles-page-client.tsx             # Role builder + permission matrix UI
│   ├── settings-page-client.tsx          # All settings tabs UI
│   ├── notifications-page-client.tsx     # Notification list UI
│   │
│   ├── entity-confirmation-dialog.tsx    # Reusable "confirm destructive action" modal
│   ├── no-permission-page.tsx            # Shown when user lacks route permission
│   ├── feedback-toast.tsx                # Toast notification display
│   ├── help-query-settings.tsx           # In-app help / query panel
│   ├── onboarding-form.tsx               # First-run workspace setup form
│   └── page-header.tsx                   # Reusable page title header
│
├── lib/
│   ├── workspace-service.ts              ← CORE SERVICE (5400+ lines). All DB operations for the workspace
│   ├── rbac.ts                           # Permission keys, groups, aliases, hasPermission(), normalizePermissions()
│   ├── dashboard-context.ts              # Server-side session builder (getDashboardContext, requireDashboardAccess)
│   ├── ai-insights.ts                    # AI insight generation, storage, and retrieval
│   ├── timesheet-service.ts              # Timesheet-specific DB operations
│   ├── timesheets.ts                     # Timesheet utility types/helpers
│   ├── reporting.ts                      # Report generation and export logic
│   ├── subscription-gate.ts              # PlanLimits type, checkFeatureAccess(), checkResourceLimit()
│   ├── workspace-management-store.ts     # Workspace-level data aggregation helpers
│   ├── workspace-notifications.ts        # Notification creation utilities
│   ├── workspace-helpers.ts              # Generic workspace utility functions
│   ├── auth.ts                           # Supabase auth helpers
│   ├── email.ts                          # Email sending (invites, alerts)
│   ├── env.ts                            # Typed environment variable access
│   ├── navigation.ts                     # Navigation helper utilities
│   ├── notification-settings.ts          # Notification preference types + normalizer
│   ├── queries.ts                        # Shared query helpers
│   ├── security-session.ts               # Session cookie management
│   ├── stripe-service.ts                 # Stripe API calls
│   ├── stripe.ts                         # Stripe client initialization
│   ├── timezone.ts                       # Date/time formatting and timezone utilities
│   ├── user-display.ts                   # getDisplayName, getInitials, getRoleLabel
│   ├── utils.ts                          # cn() classname utility
│   ├── validators.ts                     # Shared validation helpers
│   └── supabase/
│       ├── server.ts                     # createSupabaseServerClient()
│       ├── client.ts                     # createSupabaseBrowserClient()
│       └── admin.ts                      # createSupabaseAdminClient() (service role)
│
├── types/
│   ├── app.ts                            # AppRole type: "owner" | "admin" | "manager" | "member"
│   └── database.ts                       # Auto-generated Supabase database types
│
└── supabase/
    └── migrations/                       # SQL migration files (source of truth for schema)
```

---

## 4. Authentication & Session Flow

### How a request becomes authenticated:

1. **Supabase Auth** stores a JWT in an HTTP-only cookie.
2. **`app/(dashboard)/layout.tsx`** runs server-side on every dashboard page load:
   - Calls `getDashboardContextState()` (cached per request via React `cache()`)
   - Builds `DashboardContext`: user, tenant, permissions, subscription
   - Redirects to `/login` if no session, `/onboarding` if incomplete profile
   - Renders `<DashboardSessionProvider value={context}>` — passes session to all client components
3. **Client components** call `useDashboardSession()` to access:
   - `permissions: PermissionKey[]` — used for every action gate
   - `subscription: PlanLimits` — used for feature flags
   - `tenantTimezone`, `userEmail`, `userDisplayName`, etc.
4. **`emitDashboardSessionChanged()`** — call this after any action that changes permissions/roles. It fires a custom browser event → `DashboardSessionProvider` re-fetches `/api/workspace/session` → updates the in-memory session. Used after creating/editing roles.

---

## 5. RBAC System (`lib/rbac.ts`)

### AppRole hierarchy (system roles):
| Role | Description |
|---|---|
| `owner` | Unrestricted access to everything |
| `admin` | Unrestricted access to everything |
| `manager` | Pre-defined broad set (projects, clients, team, timesheets, expenses, etc.) |
| `member` | Read-only for most modules, can submit timesheets |

### Custom Roles:
- Admins can create custom roles with any subset of permissions via the Roles page.
- If a member has a `custom_role_id`, their permissions come from `tenant_role_permissions` table instead of the default role map.
- `normalizePermissions()` resolves permission aliases (e.g., `expenses.approve` implies `expenses.view`).

### Using permissions in components:
```tsx
import { hasPermission } from "@/lib/rbac";
const { permissions } = useDashboardSession();

const canEditProjects = hasPermission(permissions, "projects.edit");
```

### Full Permission Key List:
```
dashboard.view
ai-analytics.view / ai-analytics.regenerate
projects.view / .create / .edit / .archive / .delete / .upload_documents / .add_revision
clients.view / .create / .edit / .deactivate / .add_contact / .add_communication
team.view / .create / .manage / .delete / .view_members / .create_member / .edit_member / .delete_member
roles.view / .create / .edit / .delete
timesheets.view / .create / .edit / .approve
expenses.view / .create / .edit / .approve / .reject
notifications.view
agency-settings.company-profile.view / .edit
agency-settings.branding.view / .edit
agency-settings.timezone.view / .edit
agency-settings.notification-settings.view / .edit
agency-settings.security-preferences.view / .edit
agency-settings.billing.view / .edit
agency-settings.reports-exports.view / .export
```

---

## 6. Core Service Layer (`lib/workspace-service.ts`)

This is the single-source of truth for all database operations. All API routes call functions from here.

### Key exported functions:

```
getWorkspaceContext()                    # Build WorkspaceContext from the current session (used in every route handler)

# Projects
listWorkspaceProjects(context)
getWorkspaceProjectDetail(context, id)
createWorkspaceProject(context, data)    # Validates: phase dates within project dates, progress ≤ 100
updateWorkspaceProject(context, id, data) # Same validation as create

# Phases & Milestones (nested in project create/update)

# Clients
listWorkspaceClients(context)
createWorkspaceClient(context, data)
updateWorkspaceClient(context, id, data)
deactivateWorkspaceClient(context, id)

# Team
listWorkspaceMembers(context)
createWorkspaceMember(context, data)
updateWorkspaceMember(context, id, data)
deactivateWorkspaceMember(context, id)

listWorkspaceTeams(context)
createWorkspaceTeam(context, data)
updateWorkspaceTeam(context, id, data)
deleteWorkspaceTeam(context, id)

# Roles
listWorkspaceRoles(context)
createWorkspaceRole(context, data)
updateWorkspaceRolePermissions(context, id, permissions)
deleteWorkspaceRole(context, id)

# Timesheets
listWorkspaceTimesheets(context)
createWorkspaceTimesheet(context, data)
updateWorkspaceTimesheet(context, id, data)
approveWorkspaceTimesheet(context, id, status, comment)

# Expenses
listWorkspaceExpenses(context)
createWorkspaceExpense(context, data)
updateWorkspaceExpense(context, id, data)
approveWorkspaceExpense(context, id, status)
deleteWorkspaceExpense(context, id)

# AI Insights
listWorkspaceAiInsights(context)
```

### Error handling pattern:
```ts
// In service functions, throw:
throw new WorkspaceAccessError("Phase start date cannot be before project start date", 400);

// In API route handlers:
} catch (error) {
  return workspaceErrorResponse(
    error,
    error instanceof WorkspaceAccessError ? error.status : 500
  );
}
```

---

## 7. Subscription & Feature Flags

### `PlanLimits` type (from `lib/subscription-gate.ts`):
```ts
interface PlanLimits {
  planName: string;
  status: SubscriptionStatus;
  maxUsers: number | null;        // null = unlimited
  maxProjects: number | null;
  aiMonthlyTokenLimit: number | null;
  features: Record<string, boolean>;  // e.g. { ai_analytics: true, reports_exports: true }
  isExpiredOrCancelled: boolean;
}
```

### Checking feature access in components:
```tsx
const { subscription } = useDashboardSession();

// Block AI analytics if not on paid plan:
if (!subscription.features.ai_analytics) {
  return <UpgradePlanPrompt />;
}
```

### Checking resource limits (server-side):
```ts
import { checkResourceLimit } from "@/lib/subscription-gate";

if (!checkResourceLimit(context.subscription, currentProjectCount, "maxProjects")) {
  throw new WorkspaceAccessError("Project limit reached for your plan.", 403);
}
```

---

## 8. Key Page Components

### `projects-page-client.tsx` (~5700 lines)
The largest and most complex file. Contains:
- Project list view (grid + table modes)
- Multi-step create wizard: `overview → budget → phases → milestones → budgetItems → review`
- Project detail drawer with tabs: `overview | budgets | phases | milestones | ai`
- Phase management with date validation (must be within project date bounds)
- Budget revision tracking
- Document upload/preview
- AI notes tab: fetches from `/api/workspace/ai-insights`, filters by `projectId`, renders severity-coded cards
- Progress field: capped at 100% (auto-clamp + error display)

**Important state variables:**
```ts
const [projectDrawerTab, setProjectDrawerTab] = useState<"overview"|"budgets"|"phases"|"milestones"|"ai">("overview");
const [projectAiInsights, setProjectAiInsights] = useState<ProjectAiInsight[]>([]);
const [isAiInsightsLoading, setIsAiInsightsLoading] = useState(false);
```

### `timesheets-page-client.tsx`
- List + grid views, filtering by date/member/status
- Approve/Reject flows via `openApprovalDialog([id], "approved" | "rejected")`
- Three-dot action menu via `createPortal` to `document.body` (prevents overflow clipping)
- Status workflow: `draft → submitted → approved | rejected`
- Buttons gated by: `canApproveTimesheets` AND `entry.status === "submitted"`

### `expenses-page-client.tsx`
- Left panel: "Quick add" button
- Right panel: expense cards with inline workflow actions
- Status workflow: `draft → submitted → approved | rejected`
- Field limits: vendor `maxLength={60}`, description `maxLength={255}` (no `required` on description)
- `isExpenseDraftOverLimit` derived boolean gates all save buttons
- `savingAction` state: `"draft" | "submitted" | "delete" | null`

### `team-page-client.tsx`
- Members table with sort, search (with ✕ clear button), pagination
- Three-dot actions via `createPortal`
- Separate team management modal
- Team form field limits: name `60`, focus `100`, description `255`
- `isTeamDraftOverLimit` derived boolean gates Save Team button

### `roles-page-client.tsx`
- Role cards with expandable permission list
- Permission matrix modal for editing a role
- Create role wizard with template copying
- `emitDashboardSessionChanged()` called after role changes to refresh session

---

## 9. UI Patterns & Standards

### `ModalField` (the standard form field wrapper)
Always use `ModalField` for form inputs inside dialogs/modals:
```tsx
import { ModalField } from "@/components/ui/field";

<ModalField
  label="Vendor"
  htmlFor="expense-vendor"
  required              // shows red * after label
  maxLength={60}        // shows "0 / 60" counter; turns red when exceeded
  currentLength={draft.vendor.length}
  error={errors.vendor} // shows error message below field
>
  <Input id="expense-vendor" value={draft.vendor} onChange={...} />
</ModalField>
```

### Disabling buttons when character limit exceeded
Whenever a form has `maxLength` limits, compute a derived boolean and add it to `disabled`:
```tsx
const isOverLimit = draft.name.length > 60 || draft.description.length > 255;

<Button disabled={isSaving || isOverLimit}>Save</Button>
```

### Action menus (three-dot dropdowns)
Use `createPortal(menu, document.body)` to avoid overflow clipping in scrollable containers:
```tsx
{menuOpen ? createPortal(
  <div className="fixed z-[120] ..." style={{ left: x, top: y }}>
    {/* menu items */}
  </div>,
  document.body
) : null}
```

### Error handling in client components
```tsx
} catch (error) {
  showToast(error instanceof Error ? error.message : "Unable to save.", "error");
}
```

### Loading states
Use `Loader2` from `lucide-react` with `animate-spin` for inline loading:
```tsx
{isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
```

---

## 10. Data Validation Rules

### Project Phase Dates (enforced BOTH client-side and server-side):
- Phase `startDate` must be **≥** project `startDate`
- Phase `endDate` must be **≤** project `endDate`
- Phase `endDate` must be **≥** phase `startDate`
- Violation throws `WorkspaceAccessError` in `createWorkspaceProject` / `updateWorkspaceProject`

### Progress Fields:
- Must be `0–100` (integer percent)
- If user enters > 100, auto-clamp to 100 and show error
- Pattern used in project creation wizard and phase forms

### Numeric-only inputs (timesheets, OTPs):
- Use `onKeyDown` to filter non-digit keys, not just `type="number"`

---

## 11. AI Insights System

### Flow:
1. **Generation**: POST `/api/workspace/ai-insights/stream` → triggers LLM pipeline in `lib/ai-insights.ts`
   - Reads project health snapshots, budget data, phase velocity from DB
   - Sends to AI model, streams structured JSON back via SSE
   - Stores results in `public.ai_insights` table
2. **Retrieval**: GET `/api/workspace/ai-insights` → reads from `public.ai_insights`, returns array
3. **Display**: In `projects-page-client.tsx`, when `projectDrawerTab === "ai"`:
   - `useEffect` fetches all insights on drawer open
   - Filters by `insight.projectId === selectedProjectId`
   - Renders severity-coded cards: `critical` = red, `warning` = amber, `info` = emerald
   - Shows upgrade prompt if `!subscription.features.ai_analytics`
   - Shows `<Loader2>` spinner while loading

### `ProjectAiInsight` interface:
```ts
interface ProjectAiInsight {
  id: string;
  title: string;
  body: string;
  recommendation: string;
  severity: "info" | "warning" | "critical";
  category: string;
  evidence: string[];
  estimatedOverrunAmount: number | null;
  metricLabel: string;
  metricValue: number | null;
  projectId: string | null;
}
```

---

## 12. Known Architecture Constraints

1. **Single large service file**: `workspace-service.ts` is 5400+ lines. All DB work goes here — do not create parallel service files.
2. **No global state library**: State lives in `useState` within each page client component. Shared state flows through `useDashboardSession()` context only.
3. **Server Components for page shells**: Pages under `app/(dashboard)/*/page.tsx` are Server Components that pass data to a `*-page-client.tsx` Client Component.
4. **Supabase RLS**: Every query in workspace-service is scoped to the tenant via RLS policies. Never use the admin client for regular workspace operations.
5. **`getWorkspaceContext()`**: Always call this at the top of every API route handler — it validates the session and builds the typed context object.
6. **Migrations**: Any schema change must have a corresponding file in `supabase/migrations/`. Do not modify the DB directly.

---

## 13. Rules for Agent Development

1. **Always check permissions before rendering actions**: `hasPermission(permissions, "resource.action")` — never assume a user can do something.
2. **Never use `disabled` alone on form buttons**: Also compute an `isOverLimit` boolean from all `maxLength` fields and include it: `disabled={isSaving || isOverLimit}`.
3. **Never hardcode placeholder text for async data**: Use loading spinners and empty states — no static "Coming soon" or hardcoded content.
4. **Portal for floating menus**: Any dropdown/context menu that could be inside a scrollable container must use `createPortal(..., document.body)`.
5. **`emitDashboardSessionChanged()` after role/permission changes**: Required to keep the client session in sync without a full page reload.
6. **Throw `WorkspaceAccessError` for business rule violations**: Not generic `Error`. Include the HTTP status code as second argument.
7. **Both client AND server validation for critical rules**: Date range validation and progress caps are enforced in both places.
8. **Preserve scrollbar styles**: The custom scrollbar theme is defined in `globals.css` — do not override it with per-component styles.
9. **`required` on description fields is optional**: Only mark truly required fields. Description fields in expense forms are NOT required.
10. **`ModalField` is the standard — use it everywhere**: Do not create inline `<label><span>Field</span><Input /></label>` patterns in dialogs.
