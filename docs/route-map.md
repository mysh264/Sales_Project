# System Route Map

| URL Path | Required Role | Access/Function |
|---|---|---|
| `/login` | Public | Single login gateway for every employee role. |
| `/` | Authenticated | Middleware redirects the user to their role dashboard. |
| `/admin` | `ADMIN` | System admin console with health, logs reference, and master user visibility. |
| `/admin-console` | `ADMIN` | Alias route that redirects to `/admin`. |
| `/salesman` | `SALESMAN`, `ADMIN` | Mobile salesman dashboard with sales, collections, and debt summary. |
| `/salesman/new-order` | `SALESMAN`, `ADMIN` | Mobile new order workflow for customer, cylinders, pricing, and payment capture. |
| `/salesman/receipt/[invoiceId]` | `SALESMAN`, `ADMIN` | Salesman post-sale receipt handoff screen with print format options. |
| `/loader` | `LOADER`, `ADMIN` | Loader truck list showing morning load or evening return state. |
| `/loader/load/[truckId]` | `LOADER`, `ADMIN` | Morning full-cylinder loading workflow for a truck. |
| `/loader/return/[sessionId]` | `LOADER`, `ADMIN` | Evening return workflow for remaining full and collected empty cylinders. |
| `/manager` | `MANAGER`, `ACCOUNTANT_MANAGER`, `ACCOUNTANT`, `ADMIN` | Branch dashboard with monthly revenue, debt, cylinder movements, latest invoices, and print options. |
| `/manager/settings` | `MANAGER`, `ACCOUNTANT_MANAGER`, `ACCOUNTANT`, `ADMIN` | Product min/max price management for branch selling controls. |
| `/general-manager` | `GENERAL_MANAGER`, `ADMIN` | Global dashboard with company-wide revenue, debt, cylinder volume, and branch comparisons. |
| `/general-manager/users` | `GENERAL_MANAGER`, `ADMIN` | Legacy user-management screen retained under GM area; admin console is the system-level authority. |
| `/print/[invoiceId]?size=mobile` | `SALESMAN`, `LOADER`, `MANAGER`, `ACCOUNTANT_MANAGER`, `ACCOUNTANT`, `ADMIN` | Unified 80mm mobile receipt print view. |
| `/print/[invoiceId]?size=a4` | `SALESMAN`, `LOADER`, `MANAGER`, `ACCOUNTANT_MANAGER`, `ACCOUNTANT`, `ADMIN` | Unified A4 full invoice print view. |

