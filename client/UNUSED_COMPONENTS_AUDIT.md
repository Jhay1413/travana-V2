# Unused React Components Audit — client/src/

**Date:** 2026-06-16
**Branch:** feat/refactor-server
**Method:** Manual reachability analysis via ripgrep (import-path tracing), fixpoint iteration for transitive chains. No automated tool (knip / ts-prune) was available in devDependencies.

---

## Method and Limitations

1. **Entry points identified:** `client/src/main.tsx` → `App.tsx`. All routes are wired via `React.lazy()` + `import()` with explicit string literals, so they are statically traceable. The `PortalPinGate` and `EmailInbox` are imported statically (non-lazy). No Storybook, no test files, no MDX files exist in `client/src/`.

2. **Reachability graph:** Starting from `main.tsx`, every `import` statement (static and `React.lazy`) was followed recursively. Sub-routers (`agency/index.tsx`, `hub/index.tsx`, `hr/index.tsx`, `hr-v2/index.tsx`, `travana/index.tsx`, `opportunities/index.tsx`, etc.) were each traced to confirm which of their child files are imported.

3. **Fixpoint iteration:** After the first pass, each file identified as "used" was verified to be used *by a reachable file*. Files only used by other dead files are themselves dead (the transitive case). One such chain was found (`toggle-group.tsx` ← `toggle.tsx`).

4. **False-positive guards applied:**
   - Dynamic imports: all `React.lazy(import(...))` calls use string literals — no string-key registries.
   - Barrel files (`index.ts`) checked to confirm consumers exist.
   - Both filename and exported symbol name were searched.
   - No test or Storybook files exist in the codebase (only in `node_modules/`).

5. **Limitations:** This audit covers `client/src/` only. It cannot detect usage via:
   - External consumers outside this monorepo.
   - CSS class names that happen to share a component's name.
   - Runtime string concatenation building an import path (none found).

---

## Summary

| Category | Count |
|---|---|
| Confirmed-unused UI primitives (`components/ui/`) | 27 |
| Confirmed-unused via transitive chain | 1 |
| Confirmed-unused non-component utility | 1 |
| Uncertain / needs human review | 2 |
| **Total confirmed dead files** | **28** |

No **page** files and no **non-UI feature components** are dead. Every page imported in `App.tsx` (including lazy ones) is reachable. Every feature component under `components/` (excluding `components/ui/`) is imported by at least one reachable file.

---

## CONFIRMED UNUSED — UI Primitive Components (`components/ui/`)

These are shadcn/ui scaffolded components that were generated but never wired into any reachable file. Each was verified with `grep -rn "ui/<component>"` across the entire `client/src/` tree (excluding self-references).

| # | File path | Exported symbol(s) | Why it's dead |
|---|---|---|---|
| 1 | `client/src/components/ui/accordion.tsx` | `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent` | No import of `ui/accordion` exists anywhere in `client/src/`. Comments in `app-sidenav.tsx` mention "accordion" conceptually but the component is built without it. |
| 2 | `client/src/components/ui/aspect-ratio.tsx` | `AspectRatio` | 0 external importers. |
| 3 | `client/src/components/ui/avatar.tsx` | `Avatar`, `AvatarImage`, `AvatarFallback` | 0 external importers. The `Avatar` components used in `hr/avatar.tsx` and `hr-v2/avatar.tsx` are *local* custom implementations, not this shadcn primitive. |
| 4 | `client/src/components/ui/breadcrumb.tsx` | `Breadcrumb`, `BreadcrumbList`, `BreadcrumbItem`, etc. | 0 external importers. |
| 5 | `client/src/components/ui/button-group.tsx` | `ButtonGroup` | 0 external importers. |
| 6 | `client/src/components/ui/chart.tsx` | `ChartContainer`, `ChartTooltip`, etc. | 0 external importers. Charts in the app use `recharts` primitives directly, not this wrapper. |
| 7 | `client/src/components/ui/collapsible.tsx` | `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` | 0 external importers. |
| 8 | `client/src/components/ui/context-menu.tsx` | `ContextMenu`, `ContextMenuTrigger`, etc. | 0 external importers. |
| 9 | `client/src/components/ui/drawer.tsx` | `Drawer`, `DrawerTrigger`, etc. | 0 external importers. |
| 10 | `client/src/components/ui/empty.tsx` | `Empty` | 0 external importers. |
| 11 | `client/src/components/ui/field.tsx` | `Field` | 0 external importers. |
| 12 | `client/src/components/ui/hover-card.tsx` | `HoverCard`, `HoverCardTrigger`, `HoverCardContent` | 0 external importers. |
| 13 | `client/src/components/ui/input-group.tsx` | `InputGroup` | 0 external importers. |
| 14 | `client/src/components/ui/input-otp.tsx` | `InputOTP`, `InputOTPGroup`, `InputOTPSlot` | 0 external importers. |
| 15 | `client/src/components/ui/item.tsx` | `Item` | 0 external importers. |
| 16 | `client/src/components/ui/kbd.tsx` | `Kbd` | 0 external importers. |
| 17 | `client/src/components/ui/menubar.tsx` | `Menubar`, `MenubarMenu`, etc. | 0 external importers. |
| 18 | `client/src/components/ui/navigation-menu.tsx` | `NavigationMenu`, `NavigationMenuList`, etc. | 0 external importers. |
| 19 | `client/src/components/ui/pagination.tsx` | `Pagination`, `PaginationContent`, etc. | 0 external importers. The `Pagination` used in `opportunities/components/` is a local custom component, not this shadcn primitive. |
| 20 | `client/src/components/ui/progress.tsx` | `Progress` | 0 external importers. |
| 21 | `client/src/components/ui/radio-group.tsx` | `RadioGroup`, `RadioGroupItem` | 0 external importers. |
| 22 | `client/src/components/ui/resizable.tsx` | `ResizablePanelGroup`, `ResizablePanel`, `ResizableHandle` | 0 external importers. |
| 23 | `client/src/components/ui/sidebar.tsx` | `SidebarProvider`, `Sidebar`, `SidebarTrigger`, etc. | 0 external importers. The app has a custom sidebar built in `components/layout/app-sidenav.tsx` without using this shadcn sidebar primitive. The file begins with a Next.js `"use client"` directive indicating it was copied from shadcn docs verbatim. |
| 24 | `client/src/components/ui/slider.tsx` | `Slider` | 0 external importers. |
| 25 | `client/src/components/ui/sonner.tsx` | `Toaster` (sonner variant) | 0 external importers. The app uses `Toaster` from `ui/toaster` (shadcn toast), not the sonner variant. |
| 26 | `client/src/components/ui/toggle-group.tsx` | `ToggleGroup`, `ToggleGroupItem` | 0 external importers. (See transitive chain below.) |
| 27 | `client/src/components/ui/toggle.tsx` | `Toggle`, `toggleVariants` | **Transitive dead:** its only consumer is `toggle-group.tsx` (item #26 above), which is itself dead. Chain: `toggle.tsx` ← `toggle-group.tsx` ← *(no reachable importer)*. |

---

## CONFIRMED UNUSED — Non-UI / Non-Component Files

| File path | Exported symbol(s) | Why it's dead |
|---|---|---|
| `client/src/hooks/use-sidebar-store.ts` | `setSidebarMobileOpen`, `toggleSidebarMobile`, `useSidebarMobileOpen` | 0 importers in the entire `client/src/` tree. The hook manages a mobile sidebar open/close store but is never called. The app's actual mobile sidebar toggle is implemented directly inside `app-sidenav.tsx` with local state. |

---

## UNCERTAIN / Needs Human Review

| File path | Concern |
|---|---|
| `client/src/hooks/mutations/use-facebook-mutations.ts` and `client/src/hooks/queries/use-facebook-queries.ts` | Both are **barrel-exported** from `hooks/mutations/index.ts` and `hooks/queries/index.ts`, but **no component or page** in `client/src/` calls any of the exported hooks (`useFacebookPages`, `useFacebookConversations`, `useFacebookMessages`, `useDisconnectFacebookPage`, `useSendFacebookMessage`). The Facebook API module (`facebook.api.ts`) also exists. These appear dead, but they are not UI components — they are data-layer hooks that may be planned for future features or used by a feature currently behind a flag. They are outside the strict scope of this component audit but flagged here for visibility. |
| `client/src/components/quote/sections/QuoteTestToggleSection.tsx` | The name "TestToggleSection" is ambiguous — it could be interpreted as a developer debug toggle. Inspecting the file confirms it is a **production UI control** for marking quotes as "Test" quotes (excluded from pipeline/stats). It is imported and rendered in `quote-rhf-form.tsx`. **Not dead** — flagged only for potential naming confusion. |

---

## Reachability Chain Evidence for Key Decisions

### Transitive chain: `toggle.tsx`
```
toggle.tsx (exports toggleVariants)
  ← toggle-group.tsx (imports toggleVariants — only consumer)
    ← (no file in client/src/ imports from ui/toggle-group)
```
Conclusion: Both dead.

### `use-sidebar-store.ts`
```
use-sidebar-store.ts (exports setSidebarMobileOpen, useSidebarMobileOpen, toggleSidebarMobile)
  ← (0 consumers)
```
The mobile sidebar state in the live app is managed via `useState` inside `app-sidenav.tsx` directly.

### `ui/avatar.tsx` vs `hr/avatar.tsx`
`ui/avatar.tsx` has 0 external importers. The `Avatar` symbol seen in `hr/directory-page.tsx`, `hr/profile-page.tsx`, etc., all resolve to the **local** `hr/avatar.tsx` (a custom implementation) via `import { Avatar } from "./avatar"` — not the shadcn primitive at `components/ui/avatar`.

### `ui/pagination.tsx` vs local `pagination.tsx`
`ui/pagination.tsx` has 0 importers. The `Pagination` component in `opportunities/components/enquiries-page.tsx`, `quotes-page.tsx`, and `bookings-page.tsx` imports from the **local** `./pagination` file inside `opportunities/components/` — a completely separate, domain-specific implementation.

---

## Tooling Note

No automated dead-code detection tools (knip, ts-prune, depcheck) were present in `devDependencies`. Analysis was performed manually using ripgrep against the full `client/src/` tree. The `React.lazy(import("..."))` pattern in `App.tsx` uses static string literals (not dynamic expressions), so lazy-loaded pages are fully statically traceable. One genuinely dynamic import exists — `lib/scraper-json-parser.ts` is loaded via `await import("@/lib/scraper-json-parser")` inside `lib/json-import-handler.ts` — and is **reachable** through that mechanism.
