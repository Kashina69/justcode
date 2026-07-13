# Settings Architecture Knowledge Base

This document serves as the central context file for the project's Settings module (`/agency/settings`).
AI Agents: Use this file to understand the settings structure, data flow, and Role-Based Access Control (RBAC) integrations.

---

## 1. Core Architecture & Layout

The settings module is divided into two primary categories: **Personal Settings** (global to the user) and **Workspace Settings** (tenant-specific). 

### File Structure (Planned Modularization)
The monolithic `settings-page-client.tsx` is structured to be broken down into individual functional modules under `agency/components/modules/settings/`:
- `profile-settings.tsx` - Personal name/email management
- `password-settings.tsx` - Personal password updates
- `account-settings.tsx` - Account deletion / global preferences
- `company-profile-settings.tsx` - Workspace metadata (Name, Industry, Website, Size)
- `agency-branding-settings.tsx` - Workspace logo / visual identity
- `timezone-settings.tsx` - Default workspace timezone configurations
- `notification-settings.tsx` - Workspace-wide notification preferences
- `security-settings.tsx` - Workspace session timeouts and login alerts
- `billing-settings.tsx` - Stripe subscription management, invoices, and plan limits
- `reports-settings.tsx` - Global workspace data exports
- `settings.ui.tsx` - Reusable layout components (`Section`, `Toggle`, `Input`, `YesNoButton`)

---

## 2. Role-Based Access Control (RBAC) in Settings

Unlike most pages where RBAC blocks the entire page, the Settings page is accessible to all users. Instead, RBAC is enforced **per tab/section**.

If a user lacks a specific permission, the corresponding tab is hidden from the sidebar navigation.
*Reference: `agency/components/settings-page-client.tsx` tab generation logic.*

### Permission Mappings:
- **Company Profile:** Requires `agency-settings.company-profile.view`
- **Branding:** Requires `agency-settings.branding.view`
- **Timezone:** Requires `agency-settings.timezone.view`
- **Notification Settings:** Requires `agency-settings.notification-settings.view`
- **Security Preferences:** Requires `agency-settings.security-preferences.view`
- **Billing:** Requires `agency-settings.billing.view`
- **Reports & Exports:** Requires `agency-settings.reports-exports.view`

*(Personal settings tabs like Profile, Password, and Account are always visible to the authenticated user).*

---

## 3. Key Functionalities & Workflows

### Billing & Subscriptions
- Uses `lib/stripe-service.ts` for Stripe integrations.
- The `BillingPreferences` component surfaces subscription tier limitations (e.g., max users, max projects) utilizing the `PlanLimits` context (SBAC).
- Allows generating Customer Portal links for users to manage credit cards and invoices.

### Security Preferences
- **Session Timeouts:** Enforces application-level timeouts. This modifies how long the secure JWT/session cookie remains valid before prompting re-authentication. (Managed via `lib/security-session.ts`).
- **Login Alerts:** Toggles email notifications for new sign-ins on a workspace level.

### User Profile & Password
- **Profile Updates:** Interacts with the `profiles` Supabase table.
- **Password Updates:** Currently relies on providing the `old password` to set a `new password`. (Tightly coupled with the Auth flow recovery logic).

---

## 4. API & State Management
- Most settings are fetched initially via server-side rendering (SSR) and passed down as props to the Client Components.
- Updates are handled via Server Actions (e.g., `updateProfileSettingsAction`) or localized API endpoints.
- Optimistic UI updates are recommended via `useFormStatus` or React `useState` while mutations resolve.
