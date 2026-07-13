# Auth & Settings Refactor Plan

## Objectives
1. Fix the "Forgot Password -> OTP -> Update Password" flow to explicitly require setting and confirming a new password.
2. Upgrade the UI for `/update-password` to match the "Super Admin" look, utilizing proper `confirmPassword` and existing `PasswordStrengthIndicator` logic.
3. Clean up the monolithic `settings-page-client.tsx` file (3000+ lines) by extracting it into modular components.
4. Clean up `lib/actions/auth.ts` error handling by improving toast integration.

---

## Task 1: Refactor `update-password` Page (Auth Flow)
**Target File:** `agency/app/(auth)/update-password/page.tsx`
**Action Plan:**
- [x] Currently, the page only has a single `new password` field and sends a generic submit action.
- [x] Refactor to use a `useState` client-side approach (similar to super admin) to track `password` and `confirmPassword`.
- [x] Add the `PasswordStrengthIndicator` (from `agency/components/password-strength-indicator.tsx`) under the confirm password field.
- [x] Add validation: The form cannot be submitted unless `password === confirmPassword` and both fields are non-empty. Disable the submit button until both fields are populated.
- [x] If validation fails, display a clean error message.

## Task 2: Update Server Action for Password Update
**Target File:** `agency/lib/actions/auth.ts`
**Function:** `updatePasswordAction` (around line 276)
**Action Plan:**
- [x] Update `updatePasswordSchema` in `agency/lib/validators.ts` to include `confirmPassword` and use `refine((data) => data.password === data.confirmPassword)`.
- [x] Ensure `updatePasswordAction` throws well-formatted error messages that the client can easily catch and display as a toast, rather than relying strictly on URL search params if it's a client component.

## Task 3: Force Password Reset Middleware (Optional / Recommended)
**Target File:** `agency/lib/supabase/middleware.ts`
**Action Plan:**
- [x] When a user verifies a recovery OTP, Supabase establishes a session. But we shouldn't let them hit `/dashboard` without changing their password.
- [x] Added `requires_password_update` cookie on recovery success and enforced it in Next.js middleware to intercept and redirect bypass attempts to `/update-password`.

## Task 4: Modularize `settings-page-client.tsx`
**Target File:** `agency/components/settings-page-client.tsx`
**Current State:** 3000+ lines of monolithic inline React components.
**Action Plan:**
- [ ] Create directory: `agency/components/modules/settings/`
- [ ] Extract the following internal functions into their own `.tsx` files:
  - `ProfileSettings` -> `profile-settings.tsx`
  - `PasswordChangeSettings` -> `password-settings.tsx`
  - `AccountPreferencesSettings` -> `account-settings.tsx`
  - `CompanyProfileSettings` -> `company-profile-settings.tsx`
  - `AgencyBrandingSettings` -> `agency-branding-settings.tsx`
  - `TimezoneSettings` -> `timezone-settings.tsx`
  - `NotificationSettings` -> `notification-settings.tsx`
  - `SecurityPreferences` -> `security-settings.tsx`
  - `BillingPreferences`, `BillingStat`, `BillingInfoCard` -> `billing-settings.tsx`
  - `ReportsExportsSettings` -> `reports-settings.tsx`
- [ ] Remove these functions from `settings-page-client.tsx` and import them from the `modules/settings/` directory.

## Task 5: Standardize Settings Components Structure
**Target File:** `agency/components/settings-page-client.tsx`
**Action Plan:**
- [ ] Move shared UI abstractions like `Section`, `Input`, `Toggle`, `ReadOnlyField`, and `YesNoButton` into `agency/components/modules/settings/settings.ui.tsx`.
- [ ] Fix any import/eslint errors caused by the extraction.
- [ ] Test the entire build via `npm run test`.
