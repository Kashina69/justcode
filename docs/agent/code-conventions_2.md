# Code Conventions

The Wade Super Admin codebase utilizes specific design principles, styling rules, and naming criteria:

## Naming Conventions

- **Files:**
    - **Routing pages & API handlers:** Always named `page.tsx` or `route.ts`.
    - **Global shared components:** PascalCase (`[ComponentName].tsx`), e.g., [Button.tsx](file:///c:/STUFF/code/office/budget-tracker/superadmin/components/global/Button.tsx).
    - **Page-specific modules:** Follows `[page-name].[role].ts[x]` notation, e.g., [dashboard.types.ts](file:///c:/STUFF/code/office/budget-tracker/superadmin/app/dashboard/dashboard.types.ts).
    - **Services:** Files directly under `services/` use `[service-name].service.ts` (e.g., [agency.service.ts](file:///c:/STUFF/code/office/budget-tracker/superadmin/services/agency.service.ts)), but sub-folders like `services/auth` use camelCase (e.g., [signInWithPassword.ts](file:///c:/STUFF/code/office/budget-tracker/superadmin/services/auth/signInWithPassword.ts)).
- **Functions:**
    - **React Components:** PascalCase, e.g., `export const SignInView` in [SignInView.tsx](file:///c:/STUFF/code/office/budget-tracker/superadmin/components/modules/authentication/SignInView.tsx#L12).
    - **Utilities / Handlers:** camelCase, e.g., `successResponse` in [apiResponse.ts](file:///c:/STUFF/code/office/budget-tracker/superadmin/utils/apiResponse.ts#L3).
- **Variables:**
    - **Global constants:** SCREAMING_SNAKE_CASE, e.g., `FILTER_OPTIONS` in [dashboard.constents.ts](file:///c:/STUFF/code/office/budget-tracker/superadmin/app/dashboard/dashboard.constents.ts#L5).
    - **State / bindings:** camelCase, e.g., `serverError` in [SignInView.tsx](file:///c:/STUFF/code/office/budget-tracker/superadmin/components/modules/authentication/SignInView.tsx#L13).
- **Types / Interfaces:**
    - PascalCase, e.g., `interface SignInViewProps` in [SignInView.tsx](file:///c:/STUFF/code/office/budget-tracker/superadmin/components/modules/authentication/SignInView.tsx#L7).

## Error-Handling Pattern

- **API services:** Caught internally via `try/catch` and returned as a standard envelope `{ data: null, error: ... }` to avoid unhandled promise rejections. E.g., [signInWithPassword.ts](file:///c:/STUFF/code/office/budget-tracker/superadmin/services/auth/signInWithPassword.ts#L34-L36).
- **API Route Handlers:** Captured and converted to client responses via `handleApiError(error)` and `errorResponse(...)`. E.g., [route.ts](file:///c:/STUFF/code/office/budget-tracker/superadmin/app/api/auth/login/route.ts#L29-L31).
- **Frontend views:** Handle API errors by saving them to component state (`serverError`) and rendering them using the `<FieldError />` layout. E.g., [SignInView.tsx](file:///c:/STUFF/code/office/budget-tracker/superadmin/components/modules/authentication/SignInView.tsx#L46).

## Testing Approach

- No unit/integration testing framework is currently configured or implemented.
- The test command inside [package.json](file:///c:/STUFF/code/office/budget-tracker/superadmin/package.json#L14) is a pipeline validating types, styling guidelines, lint checks, and successful production compilation:
  `"test": "rm -rf .next && npm run lint && npm run typecheck && npm run format && npm run build"`

## Formatting / Linting Rules

- **ESLint Configuration ([.eslintrc.json](file:///c:/STUFF/code/office/budget-tracker/superadmin/.eslintrc.json)):**
    ```json
    {
        "extends": ["next/core-web-vitals", "next/typescript"]
    }
    ```
- **Prettier Formatting Options ([.prettierrc](file:///c:/STUFF/code/office/budget-tracker/superadmin/.prettierrc)):**
    ```json
    {
        "tabWidth": 4,
        "useTabs": false,
        "semi": true,
        "singleQuote": false,
        "trailingComma": "es5",
        "printWidth": 100,
        "arrowParens": "always"
    }
    ```

## Architectural Patterns

- **Colocated Route Modules:** Supporting resources (e.g. variables, utility components, local interfaces) are kept adjacent to the corresponding route page files rather than grouped into generic folder blocks. (E.g. [app/agency-management/agency-management.components.tsx](file:///c:/STUFF/code/office/budget-tracker/superadmin/app/agency-management/agency-management.components.tsx)).
- **Context State:** High-level app-state dependencies are handled using React context providers, e.g., [AuthContext.tsx](file:///c:/STUFF/code/office/budget-tracker/superadmin/contexts/AuthContext.tsx).

## Inconsistencies

- **Constants File Spelling Typo:**
    - `dashboard.constents.ts`, `subscription-billing-management.constents.ts`, and `ai-platform-configuration.constents.ts` use the misspelled `constents`.
    - Outliers (correctly spelled): `agency-management.constants.ts` and `notifications.constants.ts`.
- **Hook Naming Convention:**
    - `useAuth.hooks.ts` is pluralized (`.hooks.ts`).
    - Outliers: `useDashboardMetrics.hook.ts` and `useObjectState.hook.ts` use singular `.hook.ts`.
- **Service File Organization:**
    - Files in the root of `services/` use dot-notation (e.g., `agency.service.ts`), while files inside nested folders (`services/auth/` and `services/profile/`) use camelCase names (e.g., `signInWithPassword.ts` and `createHandleUpdateAdminProfile.ts`).
