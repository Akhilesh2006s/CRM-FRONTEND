# Dynamic RBAC — Developer cheat sheet

**Full roadmap (phases, module status, exit criteria):** [../../docs/RBAC-ROADMAP.md](../../docs/RBAC-ROADMAP.md)

Permission keys use dot notation: `{module}.{resource}.{action}`.

| Type | Example | Usage |
|------|---------|--------|
| module | `expenses.module.view` | Roles UI grouping (toggle all keys in module) |
| page | `warehouse.completed_dc.page.view` | Routes + nav links + RouteGuard |
| button | `warehouse.completed_dc.replace_pdf` | UI actions + API mutations |

## Backend

1. Add keys to `backend/constants/permissionsCatalog.js` (`PAGE_ENTRIES`, `BUTTON_ENTRIES`).
2. Run `node backend/scripts/seedPermissions.js` after catalog changes.
3. Protect routes:

```js
const { requirePermission } = require('../middleware/permissionMiddleware');
router.put('/:id/approve', authMiddleware, requirePermission('payments.approval_cash.page.view'), approvePayment);
```

Conditional checks:

```js
const { requirePermissionWhen } = require('../middleware/permissionMiddleware');
router.put('/:id', authMiddleware, requirePermissionWhen(
  (req) => req.body?.poDocument !== undefined,
  'warehouse.completed_dc.replace_pdf'
), updateDC);
```

Super Admin bypasses permission checks (existing Executive-scoped data rules in controllers still apply).

## Frontend

1. Map routes in `lib/nav-permissions.ts` (`HREF_PERMISSION_MAP`).
2. Add pages to `lib/rbac-nav.ts` (`RBAC_NAV_MODULES`).
3. Sidebar: when `rbacActive`, use `buildRbacSidebarNav(permUser)` in `components/dashboard/Sidebar.tsx` (plus role-specific extras not in the catalog).
4. Deep links: `lib/route-permissions.ts` + `RouteGuard` in `app/dashboard/layout.tsx`.
5. Buttons:

```tsx
import { Can } from '@/components/permissions/Can'

<Can permission="warehouse.completed_dc.replace_pdf">
  <Button onClick={replacePdf}>Replace PDF</Button>
</Can>
```

6. Legacy fallback: when `permissions` is missing on the user, `hasPermission` returns true (pre-RBAC behavior).

## Roles (Super Admin)

- UI: `/dashboard/settings/roles`
- APIs: `GET/POST /api/roles`, `PUT /api/roles/:id/permissions`, `PUT /api/users/:id/role`
- Clone a system template, customize keys, assign `roleId` on Active Employees.
- After changing a role, users must **sign out and sign in** or click **Refresh my permissions** on the Roles page.

## Pilot pages (reference)

| Page | Permission keys |
|------|-----------------|
| Completed DC | `warehouse.completed_dc.view_pdf`, `warehouse.completed_dc.replace_pdf` |
| Closed Sales | `clients.closed_sales.request_dc`, `clients.closed_sales.approve_dc` |
| Active employees | `employees.active.edit`, `employees.active.delete` |
| Returns WH exec / mgr | `returns.warehouse.verify`, `returns.warehouse.approve` |

Always add the same key on the matching API route.
