# System Route Map

| URL Path | Required Role | Access/Function |
|---|---|---|
| `/login` | Public | Single login gateway for every employee role. |
| `/profile/security` | Authenticated | Authenticator MFA enrolment and removal. |
| `/` | Authenticated | Middleware redirects the user to their role dashboard. |
| `/admin` | `ADMIN` | System admin console with health, logs reference, and master user visibility. |
| `/admin-console` | `ADMIN` | Legacy direct URL for the user-management console; `/admin/users` is the native Admin-workspace route. |
| `/admin/users` | `ADMIN` | Complete employee, role assignment, password reset, and account status management inside the Admin workspace. |
| `/salesman` | `SALESMAN`, `ADMIN` | Mobile salesman dashboard with sales, collections, and debt summary. |
| `/salesman/new-order` | `SALESMAN`, `ADMIN` | Mobile new order workflow for customer, cylinders, pricing, and payment capture. |
| `/salesman/receipt/[invoiceId]` | `SALESMAN`, `ADMIN` | Salesman post-sale receipt handoff screen with print format options. |
| `/loader` | `LOADER`, `ADMIN` | Daily salesman load list showing morning load or evening return state. |
| `/loader/load/[salesmanId]` | `LOADER`, `ADMIN` | Morning full-cylinder allocation for a salesman. |
| `/loader/return/[salesmanId]` | `LOADER`, `ADMIN` | Evening return and invoice-matched reconciliation. |
| `/admin/inventory` | `Inventory_Update` | Audited full/empty cylinder stock adjustments. |
| `/admin/finance` | `ADMIN` | Company-wide finance and debt oversight inside the Admin workspace. |
| `/admin/sales` | `ADMIN` | Company-wide invoice ledger inside the Admin workspace. |
| `/admin/reconciliation` | `ADMIN` | Company-wide operational reconciliation and discrepancy oversight. |
| `/manager` | `MANAGER`, `ADMIN` | Consolidated branch operations, finance, debt, pricing, and user-management dashboard. |
| `/manager/settings` | `MANAGER`, `ADMIN` | Product min/max price management for branch selling controls. |
| `/manager/users` | `Users_Update` | Manager-native branch team management for loaders and salespeople. |
| `/manager/inventory` | `Inventory_Update` | Manager-native audited branch inventory ledger. |
| `/manager/reconciliation` | `Finance_Read` | Manager-native loader-to-invoice review and discrepancy approval. |
| `/finance/reconciliation-overview` | `Finance_Read` | Branch-scoped reconciliation review and management approval of discrepancies. |
| `/general-manager` | `GENERAL_MANAGER`, `ADMIN` | Global dashboard with company-wide revenue, debt, cylinder volume, and branch comparisons. |
| `/general-manager/users` | `GENERAL_MANAGER`, `ADMIN` | Legacy user-management screen retained under GM area; admin console is the system-level authority. |
| `/general-manager/finance` | `Finance_Read` | Global finance and debt view inside the General Manager workspace. |
| `/general-manager/reconciliation` | `Finance_Read` | Company-wide loader-to-invoice reconciliation review. |
| `/general-manager/branches` | `Branches_Update` | Branch administration inside the General Manager workspace. |
| `/general-manager/products` | `Products_Update` | Product administration inside the General Manager workspace. |
| `/general-manager/inventory` | `Inventory_Update` | Global audited inventory ledger. |
| `/general-manager/roles` | `Roles_Update` | Permission-profile administration inside the General Manager workspace. |
| `/print/[invoiceId]?size=mobile` | `SALESMAN`, `LOADER`, `MANAGER`, `ADMIN` | Unified 80mm mobile receipt print view. |
| `/print/[invoiceId]?size=a4` | `SALESMAN`, `LOADER`, `MANAGER`, `ADMIN` | Unified A4 full invoice print view. |
