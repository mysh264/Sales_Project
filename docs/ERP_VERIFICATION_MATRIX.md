# ERP Verification Matrix

This document is the dry-run checklist for system testing and operations. It reflects the current `app/` route tree, middleware rules, and permission constants in `lib/permissions.ts`.

## Test Accounts

| Role Name | Suggested Username | Suggested Password | Test Description |
|---|---|---|---|
| Admin | `admin@mahmoudbox.com` | `SuperSecure123!` | Full system access, including admin, audit, branches, and role management. |
| General Manager | `gm@test.local` | `Pass123!` | Company-wide oversight, branch setup, and user management. |
| Manager | `manager@test.local` | `Pass123!` | Branch finance view, sales review, and settings management. |
| Accountant | `accountant@test.local` | `Pass123!` | Finance dashboard, debt collection, and pricing control. |
| Loader | `loader@test.local` | `Pass123!` | Morning load and evening return workflows. |
| Salesman A | `salesman-a@test.local` | `Pass123!` | Assign to Branch A for branch isolation testing. |
| Salesman B | `salesman-b@test.local` | `Pass123!` | Assign to Branch B for branch isolation testing. |

## Functional Verification Matrix

| Module | Path/URL | Action to Test | Expected Behavior | Test Status |
|---|---|---|---|---|
| Auth | `/login` | Login with valid credentials | Session cookie is created and middleware routes the user to the correct home page. |  |
| Auth | `/login` | Login with invalid credentials | Login is rejected and no session is created. |  |
| Root Routing | `/` | Open the root path after login | Redirects to the correct role home path. |  |
| Sales | `/salesman` | Open salesman dashboard | Shows today sales, debt list, payment breakdown, and action buttons. |  |
| Sales | `/salesman/new-order` | Create invoice | Invoice is saved, receipt route opens, and local draft storage is cleared. |  |
| Sales | `/salesman/new-order` | Submit incomplete form | Validation error is shown without losing the current form data. |  |
| Sales | `/salesman/history` | View own invoices | Only invoices for the authenticated salesman appear. |  |
| Sales | `/salesman/customer/[id]` | Open customer history | Shows the selected customer’s debt history only. |  |
| Sales | `/salesman/receipt/[invoiceId]` | Open receipt after sale | Thermal receipt page renders with print controls. |  |
| Sales | `/print/[invoiceId]?size=mobile` | Print small receipt | Mobile receipt format renders correctly. |  |
| Sales | `/print/[invoiceId]?size=a4` | Print full invoice | A4 invoice format renders correctly. |  |
| Sales | `/salesman/*` as non-salesman | Try direct access | Unauthorized user is redirected or blocked. |  |
| Logistics | `/loader` | Open loader dashboard | Shows truck cards with Morning Load or Evening Return actions. |  |
| Logistics | `/loader/load/[truckId]` | Record morning load | Load session is saved and inventory is deducted. |  |
| Logistics | `/loader/return/[sessionId]` | Record evening return | Return items are saved and inventory is restored. |  |
| Logistics | `/logistics/reconciliation` | Record morning and evening reconciliation | Daily reconciliation is saved with product-level line items. |  |
| Logistics | `/logistics/reconciliation` as unauthorized role | Open reconciliation page | Unauthorized user is blocked. |  |
| Finance | `/manager` | Open branch manager dashboard | Shows branch KPIs and latest invoices. |  |
| Finance | `/manager/dashboard` | Open finance dashboard | Shows financial summary, debt table, and recent audit entries. |  |
| Finance | `/manager/settings` | Update price rule | Min and max pricing are saved and immediately enforced. |  |
| Finance | `/manager/all-sales` | View all sales | Shows branch-scoped sales unless global sales access is enabled. |  |
| General Manager | `/general-manager` | Open global overview | Shows global KPIs and branch performance table. |  |
| General Manager | `/general-manager/users` | Create or update user | User is saved with role and branch assignment. |  |
| Branch Admin | `/admin/branches` | Create or edit branch | Branch is saved with name, code, and location. |  |
| Role Admin | `/admin/roles` | Create role | Role is created with selected permissions. |  |
| Role Admin | `/admin/roles?cloneFrom=[id]` | Clone role | New role starts with the same permissions as the source role. |  |
| Audit Admin | `/admin/audit-logs` | View audit logs | Admin-only audit table loads with filters and JSON details. |  |
| Admin Console | `/admin-console` | Open system console | Shows system-wide counts and master user visibility. |  |
| Admin Root | `/admin` | Open admin home | Shows admin navigation and summary view. |  |
| Branch Isolation | Any branch-scoped route | Tamper with IDs in the URL | Data from the other branch must not leak into the page. |  |
| Admin Override | Same branch-scoped routes | Log in as Admin | Admin can see records from both branches. |  |

## Audit Log Logic

| Test Outcome | Required Log Entry | What Must Be Captured |
|---|---|---|
| Success | `ACTION_NAME` | The business action name, target model, target ID, old value, new value, timestamp, IP address, and user agent. |
| Unauthorized | `SECURITY_BREACH` | The denied permission, user role, target route or model, and reason for rejection. |
| Update action | `ACTION_NAME` with JSON diff | Before and after snapshots should be stored in `oldValue` and `newValue`. |
| Create action | `ACTION_NAME` | The created object should appear in `newValue`. |
| Delete action | `ACTION_NAME` | The removed object should appear in `oldValue` before deletion. |

## Branch Isolation Logic

| Rule | Verification Method | Expected Result |
|---|---|---|
| Branch A user sees only Branch A data | Log in as the Branch A test user and open branch-scoped pages. | Only Branch A records appear. |
| Branch B user sees only Branch B data | Log in as the Branch B test user and open the same branch-scoped pages. | Only Branch B records appear. |
| Cross-branch URL tampering | Use a valid Branch A session and manually change IDs in the URL to Branch B records. | The page must block, redirect, or return empty scoped data. |
| Admin override | Log in as Admin and open the same routes. | Admin can see records from both branches. |
| No silent leakage | Compare counts and detail pages across branches. | Results must match the assigned branch only. |

## Clone Logic

| Rule | Verification Method | Expected Result |
|---|---|---|
| Clone copies permissions | Clone an existing role such as Salesman. | The new role starts with the same permission set as the source. |
| Clone is independent | Modify the cloned role after saving. | The source role stays unchanged. |
| Permission changes persist | Refresh the role list after editing the clone. | The cloned role keeps its updated permissions. |
| User assignment follows cloned role | Assign a user to the cloned role and log in. | The user receives only the cloned role’s permissions. |

## Security Notes

| Area | Rule |
|---|---|
| Unauthorized access | Any blocked access attempt must create a `SECURITY_BREACH` audit entry. |
| Successful action | Any business action should log its exact action name. |
| Branch scoping | Non-admin data queries should be filtered by `branchId` through the branch scope helper. |
| Admin scope | Admin can override branch restrictions and see all branches. |
| Review workflow | Use this matrix as the dry-run checklist before production sign-off. |

