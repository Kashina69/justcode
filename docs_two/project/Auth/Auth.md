# Auth Architecture & Flows Knowledge Base

This document serves as the central context file for the project's Authentication module.
AI Agents: Use this file to understand the authentication state, Supabase integration, and frontend auth flows.

---

## 1. Authentication Foundation

The application uses **Supabase Auth** for identity management. The auth flow relies on Supabase SSR (Server-Side Rendering) packages to maintain session state across the client and server via secure cookies.

### Core Auth Utilities
- **`lib/supabase/server.ts` & `browser.ts`**
  - Configures the Supabase client for Server Components/Actions and Client Components.
- **`lib/supabase/middleware.ts`**
  - Supabase Auth middleware that intercepts requests, refreshes expired sessions automatically, and sets secure session cookies. It also handles strict path protection and forces redirection for temporary flow states (such as mandatory password updates).
- **`lib/security-session.ts`**
  - Manages application-level security timeouts and login alerts based on tenant configurations, sitting on top of the base Supabase session.

---

## 2. Authentication Flows

### Sign In (`/login`)
- **Action:** `signInAction` in `lib/actions/auth.ts:120`
- **Logic:** Calls `supabase.auth.signInWithPassword`. Blocks "super_admin" roles from agency dashboard. Initializes security session timeouts based on tenant preferences. Triggers "New sign-in detected" email alerts if enabled.

### Sign Up (`/signup`)
- **Action:** `signUpAction` in `lib/actions/auth.ts:199`
- **Logic:** Calls `supabase.auth.signUp`. Enforces email uniqueness by checking the `profiles` table first. Redirects to `/verify-email`.

### Email Verification (`/verify-email`)
- **Action:** `verifyEmailOtpAction` in `lib/actions/auth.ts:411`
- **Logic:** Verifies the 6-digit OTP using `supabase.auth.verifyOtp` (type: "email"). Upon success, redirects the user to the `/onboarding` flow.

### Forgot Password (`/forgot-password`)
- **Action:** `forgotPasswordAction` in `lib/actions/auth.ts:252`
- **Logic:** Calls `supabase.auth.resetPasswordForEmail`. Sends a 6-digit recovery OTP to the user. Redirects to `/verify-recovery`.

### Recovery Verification (`/verify-recovery`)
- **Action:** `verifyRecoveryOtpAction` in `lib/actions/auth.ts:487`
- **Logic:** Verifies the 6-digit OTP using `supabase.auth.verifyOtp` (type: "recovery"). 
- **Security Control:** Verifying a recovery OTP automatically establishes a session. To prevent bypass, the backend action drops an HTTP-only secure cookie named `requires_password_update`. 
- **Redirect Rule:** The user is redirected to `/update-password`.

---

## 3. Mandatory Password Update Flow (`/update-password`)

To prevent users from navigating away or bypassing account recovery, strict routing controls are implemented.

### Routing Constraints
1. **Guests:** Redirected from `/update-password` to `/login` since they lack an active recovery session.
2. **Standard Users:** Authenticated users trying to access `/update-password` *without* the `requires_password_update` cookie are redirected to `/dashboard`.
3. **Restricted Recovered Users:** Authenticated users *with* the `requires_password_update` cookie are blocked from visiting `/dashboard` or any other path; they are forced back to `/update-password` until the cookie is cleared.

### Password Change Action (`/update-password` form submit)
- **Action:** `updatePasswordAction` in `lib/actions/auth.ts:276`
- **Logic:** Validates match between `password` and `confirmPassword` using Zod validation. Updates user password via `supabase.auth.updateUser`. On success, deletes the `requires_password_update` cookie and redirects the user to `/dashboard`.

---

## 4. UI Standards

- Auth forms must use `AuthReferenceLayout` with appropriate layout panels (`panelPosition="left"` or `"right"`).
- Input fields use `FormStatusBridge` to bind standard React `useFormStatus` to UI loading states.
- Password inputs utilize the `PasswordStrengthIndicator` for UX feedback.
- **Resend Buttons (verify-recovery & verify-email):**
  - Features an animated, `localStorage`-backed 90s cooldown timer. 
  - Clicking the button immediately disables the field and triggers the countdown timer locally, surviving page refreshes or transitions.
- All auth-related server actions (`lib/actions/auth.ts`) handle error state and return URL-encoded error strings for the frontend to render as toasts or field errors.
