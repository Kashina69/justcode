# RBAC & SBAC Knowledge Base

This document serves as the central context file for the project's Role-Based Access Control (RBAC) and Subscription-Based Access Control (SBAC). 
AI Agents: Use this file to understand where and how access controls are enforced across the frontend, backend, and database layers.

---

## 1. Role-Based Access Control (RBAC)

RBAC controls what users can *do* based on their role and permissions.

### Frontend Implementation
- **`useDashboardSession()`**
  - **Location:** `agency/components/providers/dashboard-session-provider.tsx:119`
  - **Logic:** React hook that returns the current dashboard context, including the `permissions` array for the active user.
  - **Usage:** Call this inside any Client Component to get the user's permissions array.

- **`hasPermission(permissions: string[], permission: PermissionKey)`**
  - **Location:** `agency/lib/rbac.ts:416`
  - **Logic:** Synchronous utility function that returns `true` or `false` indicating if the required permission exists in the array.
  - **Usage:** Used primarily in UI components to hide/show buttons or disable fields (e.g., `canCreateMembers = hasPermission(permissions, "team.create_member")`).

### Backend (Server Actions & Services) Implementation
- **`ensurePermission(context: WorkspaceContext, permission: PermissionKey)`**
  - **Location:** `agency/lib/workspace-service.ts:412`
  - **Logic:** Validates if the user can perform an action. If the user's role is `owner` or `admin`, it immediately passes. Otherwise, it checks the `context.permissions` array. Throws a `WorkspaceAccessError (403)` if unauthorized.
  - **Usage:** Must be called at the very beginning of any data mutation or sensitive read function inside `workspace-service.ts` (e.g., `ensurePermission(context, 'clients.view')`).

### Backend (Page & API Routes) Implementation
- **`requireDashboardAccess(permission?: PermissionKey)`**
  - **Location:** `agency/lib/dashboard-context.ts:441`
  - **Logic:** Checks the user's session and role. If they lack the passed `permission`, it redirects them to the default authorized route.
  - **Usage:** Used inside React Server Components (`page.tsx`) or API route handlers (`route.ts`) to prevent access to unauthorized pages entirely.

---

## 2. Subscription-Based Access Control (SBAC)

SBAC controls *how many* resources a user can create or *which features* they can access, based on their subscription tier (e.g., Free vs Premium).

### Core Data & Types
- **`PlanLimits`**
  - **Location:** `agency/lib/subscription-gate.ts:5`
  - **Structure:** Interface containing `maxUsers`, `maxProjects`, `aiMonthlyTokenLimit`, `features` (boolean flags), and `isExpiredOrCancelled`.
  - **Hydration:** Populated during the initial context fetch in `buildDashboardContext()` (`agency/lib/dashboard-context.ts:258-280`) by querying the `tenant_subscriptions` table.

### Shared Logic Helpers
- **`checkFeatureAccess(limits: PlanLimits, featureKey: string)`**
  - **Location:** `agency/lib/subscription-gate.ts:18`
  - **Logic:** Returns `true` if the subscription is active and the specific feature flag is toggled on.
- **`checkResourceLimit(limits: PlanLimits, currentCount: number, limitType: 'maxUsers' | 'maxProjects')`**
  - **Location:** `agency/lib/subscription-gate.ts:29`
  - **Logic:** Returns `true` if the resource is below the allowed max capacity, or if the limit is `null` (unlimited).

### Hard-Enforced Backend Limits (Examples)
- **Team Members (User Limit)**
  - **Location:** `createWorkspaceInvite` (`agency/lib/workspace-service.ts:2727`)
  - **Condition:** Evaluates `isMemberRole = !["owner", "admin"].includes(resolvedRole.appRole)`.
  - **Logic:** The limit (e.g., 2 seats on Free) ONLY applies to non-admin roles (e.g., `member` and `manager`). Agency Admin and Agency Owner roles are exempt. It checks the DB for active users with `role` in `['member', 'manager']` and blocks the invite (throws a 402 Error) if `count >= maxUsers`.
  - **Frontend Note:** Because of this exemption, the frontend `team-page-client.tsx` explicitly checks `isAtLimit` and applies a validation error to the role field if the user tries to assign a non-admin role while at capacity, rather than disabling the entire modal, because users can still invite admins. Legacy role names have been unified to "Agency Admin / Owner" and "Team Member / User" respectively to simplify mapping.

- **Projects Limit**
  - **Location:** `createWorkspaceProject` (`agency/lib/workspace-service.ts:3760-3786`)
  - **Logic:** Counts all projects for the tenant where `archived_at` is `null`. If `count >= maxProjects`, creation is blocked. Archived projects do not count against the limit.

### Unlimited Resources (No Hard DB Limits)
- **Clients, Team Roles, Timesheets, Expenses:** 
  - There are currently no quantity constraints (`maxCount`) checked for these entities during their creation in `workspace-service.ts`. The only restrictions applied to them would be boolean feature flags (e.g., restricting access to the entire reports tab).

---

## 3. Database Layer (Tenant Isolation)
- **Logic:** Access control at the DB level is handled via application-layer tenant isolation. Almost every query explicitly filters by tenant using: `.eq("tenant_id", context.tenant.id)`. This ensures cross-tenant data leakage is structurally impossible without compromising the `WorkspaceContext`.
