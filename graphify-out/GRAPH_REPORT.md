# Graph Report - .  (2026-08-10)

## Corpus Check
- Large corpus: 152 files · ~2,372,931 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 681 nodes · 1201 edges · 79 communities (30 shown, 49 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- App Shell & Navigation
- Build & Lint Config
- Sheet & Separator UI
- Router & Error Reporting
- Accordion, Avatar & Menus
- Admin & Staff Server Functions
- TypeScript & Vite Config
- Badges, Popovers & Toggles
- Alert Dialog UI
- Supabase Admin Client & DB Types
- Auth Attacher & Error Capture
- shadcn Component Registry
- Command Palette
- Menubar UI
- Package Dependencies
- Form Primitives
- Session & Guest Wallet
- Carousel UI
- Charts
- Dropdown Menu UI
- breadcrumb
- drawer
- navigation-menu
- toggle
- alert
- input-otp
- class-variance-authority
- clsx
- date-fns
- embla-carousel-react
- framer-motion
- @hookform/resolvers
- input-otp
- @lovable.dev/cloud-auth-js
- lucide-react
- @radix-ui/react-accordion
- @radix-ui/react-alert-dialog
- @radix-ui/react-aspect-ratio
- @radix-ui/react-avatar
- @radix-ui/react-checkbox
- @radix-ui/react-collapsible
- @radix-ui/react-context-menu
- @radix-ui/react-dialog
- @radix-ui/react-dropdown-menu
- @radix-ui/react-hover-card
- @radix-ui/react-label
- @radix-ui/react-menubar
- @radix-ui/react-navigation-menu
- @radix-ui/react-popover
- @radix-ui/react-progress
- @radix-ui/react-radio-group
- @radix-ui/react-scroll-area
- @radix-ui/react-select
- @radix-ui/react-separator
- @radix-ui/react-slider
- @radix-ui/react-slot
- @radix-ui/react-switch
- @radix-ui/react-tabs
- @radix-ui/react-toggle
- @radix-ui/react-toggle-group
- react
- react-dom
- react-hook-form
- react-icons
- react-resizable-panels
- recharts
- sonner
- tailwindcss
- @tanstack/react-router
- @tanstack/react-start
- @tanstack/router-plugin
- tw-animate-css
- vaul
- vite-tsconfig-paths
- zod

## God Nodes (most connected - your core abstractions)
1. `cn()` - 220 edges
2. `compilerOptions` - 22 edges
3. `Layout()` - 12 edges
4. `Button` - 12 edges
5. `toast()` - 11 edges
6. `useSession()` - 10 edges
7. `buttonVariants` - 9 edges
8. `requireStaff()` - 9 edges
9. `getPool` - 9 edges
10. `formatCurrency()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `AlertDialogOverlay` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/alert-dialog.tsx → src/lib/utils.ts
- `AlertDialogContent` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/alert-dialog.tsx → src/lib/utils.ts
- `AlertDialogHeader()` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/alert-dialog.tsx → src/lib/utils.ts
- `AlertDialogFooter()` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/alert-dialog.tsx → src/lib/utils.ts
- `AlertDialogTitle` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/alert-dialog.tsx → src/lib/utils.ts

## Import Cycles
- None detected.

## Communities (79 total, 49 thin omitted)

### Community 0 - "App Shell & Navigation"
Cohesion: 0.08
Nodes (46): AnyLink, Layout(), navLinks, Button, Card, CardContent, CardDescription, CardFooter (+38 more)

### Community 1 - "Build & Lint Config"
Cohesion: 0.04
Nodes (46): eslint, eslint-config-prettier, @eslint/js, eslint-plugin-prettier, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, @lovable.dev/vite-tanstack-config (+38 more)

### Community 2 - "Sheet & Separator UI"
Cohesion: 0.06
Nodes (39): Separator, SheetContent, SheetContentProps, SheetDescription, SheetFooter(), SheetHeader(), SheetOverlay, SheetTitle (+31 more)

### Community 3 - "Router & Error Reporting"
Cohesion: 0.06
Nodes (35): Toaster(), ToasterProps, LovableErrorOptions, LovableEvents, reportLovableError(), Window, getRouter(), Route (+27 more)

### Community 4 - "Accordion, Avatar & Menus"
Cohesion: 0.09
Nodes (35): AccordionContent, AccordionItem, AccordionTrigger, Avatar, AvatarFallback, AvatarImage, ContextMenuCheckboxItem, ContextMenuContent (+27 more)

### Community 5 - "Admin & Staff Server Functions"
Cohesion: 0.09
Nodes (31): createSupabaseFetch(), isNewSupabaseApiKey(), requireSupabaseAuth, adjustPlayerBalance, getAdminOverview, logLedger(), PoolUpdate, ProfileUpdate (+23 more)

### Community 6 - "TypeScript & Vite Config"
Cohesion: 0.06
Nodes (31): DOM, DOM.Iterable, ES2022, eslint.config.js, src/**/*.ts, src/**/*.tsx, vite/client, vite.config.ts (+23 more)

### Community 7 - "Badges, Popovers & Toggles"
Cohesion: 0.09
Nodes (11): Badge(), BadgeProps, badgeVariants, Checkbox, HoverCardContent, PopoverContent, Progress, ScrollArea (+3 more)

### Community 8 - "Alert Dialog UI"
Cohesion: 0.11
Nodes (20): AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay, AlertDialogTitle (+12 more)

### Community 9 - "Supabase Admin Client & DB Types"
Cohesion: 0.13
Nodes (18): createSupabaseAdminClient(), createSupabaseFetch(), isNewSupabaseApiKey(), supabaseAdmin, CompositeTypes, Constants, Database, DatabaseWithoutInternals (+10 more)

### Community 10 - "Auth Attacher & Error Capture"
Cohesion: 0.16
Nodes (14): attachSupabaseAuth, consumeLastCapturedError(), describeError(), describeStatus(), originalConsoleError, safeStringify(), renderErrorPage(), fetch() (+6 more)

### Community 11 - "shadcn Component Registry"
Cohesion: 0.11
Nodes (18): aliases, components, hooks, lib, ui, utils, iconLibrary, registries (+10 more)

### Community 12 - "Command Palette"
Cohesion: 0.12
Nodes (14): Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut() (+6 more)

### Community 13 - "Menubar UI"
Cohesion: 0.12
Nodes (11): Menubar, MenubarCheckboxItem, MenubarContent, MenubarItem, MenubarLabel, MenubarRadioItem, MenubarSeparator, MenubarShortcut() (+3 more)

### Community 14 - "Package Dependencies"
Cohesion: 0.13
Nodes (15): cmdk, dependencies, cmdk, @radix-ui/react-tooltip, react-day-picker, @supabase/supabase-js, tailwind-merge, @tailwindcss/vite (+7 more)

### Community 15 - "Form Primitives"
Cohesion: 0.19
Nodes (12): FormControl, FormDescription, FormFieldContext, FormFieldContextValue, FormItem, FormItemContext, FormItemContextValue, FormLabel (+4 more)

### Community 16 - "Session & Guest Wallet"
Cohesion: 0.30
Nodes (13): loadAuthedUser(), SessionUser, useSession(), ensureGuest(), fresh(), GUEST_STARTING_BALANCE, GuestState, randomName() (+5 more)

### Community 17 - "Carousel UI"
Cohesion: 0.19
Nodes (13): Carousel, CarouselApi, CarouselContent, CarouselContext, CarouselContextProps, CarouselItem, CarouselNext, CarouselOptions (+5 more)

### Community 18 - "Charts"
Cohesion: 0.25
Nodes (9): ChartConfig, ChartContainer, ChartContext, ChartContextProps, ChartLegendContent, ChartTooltipContent, getPayloadConfigFromPayload(), THEMES (+1 more)

### Community 19 - "Dropdown Menu UI"
Cohesion: 0.20
Nodes (9): DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuShortcut(), DropdownMenuSubContent (+1 more)

### Community 20 - "breadcrumb"
Cohesion: 0.25
Nodes (7): Breadcrumb, BreadcrumbEllipsis(), BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator()

### Community 21 - "drawer"
Cohesion: 0.25
Nodes (6): DrawerContent, DrawerDescription, DrawerFooter(), DrawerHeader(), DrawerOverlay, DrawerTitle

### Community 22 - "navigation-menu"
Cohesion: 0.29
Nodes (7): NavigationMenu, NavigationMenuContent, NavigationMenuIndicator, NavigationMenuList, NavigationMenuTrigger, navigationMenuTriggerStyle, NavigationMenuViewport

### Community 23 - "toggle"
Cohesion: 0.43
Nodes (5): ToggleGroup, ToggleGroupContext, ToggleGroupItem, Toggle, toggleVariants

### Community 24 - "alert"
Cohesion: 0.50
Nodes (4): Alert, AlertDescription, AlertTitle, alertVariants

### Community 25 - "input-otp"
Cohesion: 0.40
Nodes (4): InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot

## Knowledge Gaps
- **209 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `css` (+204 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **49 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `Accordion, Avatar & Menus` to `App Shell & Navigation`, `Sheet & Separator UI`, `Badges, Popovers & Toggles`, `Alert Dialog UI`, `Command Palette`, `Menubar UI`, `Form Primitives`, `Carousel UI`, `Charts`, `Dropdown Menu UI`, `breadcrumb`, `drawer`, `navigation-menu`, `toggle`, `alert`, `input-otp`?**
  _High betweenness centrality (0.266) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Package Dependencies` to `Build & Lint Config`, `class-variance-authority`, `clsx`, `date-fns`, `embla-carousel-react`, `framer-motion`, `@hookform/resolvers`, `input-otp`, `@lovable.dev/cloud-auth-js`, `lucide-react`, `@radix-ui/react-accordion`, `@radix-ui/react-alert-dialog`, `@radix-ui/react-aspect-ratio`, `@radix-ui/react-avatar`, `@radix-ui/react-checkbox`, `@radix-ui/react-collapsible`, `@radix-ui/react-context-menu`, `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-hover-card`, `@radix-ui/react-label`, `@radix-ui/react-menubar`, `@radix-ui/react-navigation-menu`, `@radix-ui/react-popover`, `@radix-ui/react-progress`, `@radix-ui/react-radio-group`, `@radix-ui/react-scroll-area`, `@radix-ui/react-select`, `@radix-ui/react-separator`, `@radix-ui/react-slider`, `@radix-ui/react-slot`, `@radix-ui/react-switch`, `@radix-ui/react-tabs`, `@radix-ui/react-toggle`, `@radix-ui/react-toggle-group`, `react`, `react-dom`, `react-hook-form`, `react-icons`, `react-resizable-panels`, `recharts`, `sonner`, `tailwindcss`, `@tanstack/react-router`, `@tanstack/react-start`, `@tanstack/router-plugin`, `tw-animate-css`, `vaul`, `vite-tsconfig-paths`, `zod`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _209 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App Shell & Navigation` be split into smaller, more focused modules?**
  _Cohesion score 0.07643600180913614 - nodes in this community are weakly interconnected._
- **Should `Build & Lint Config` be split into smaller, more focused modules?**
  _Cohesion score 0.0425531914893617 - nodes in this community are weakly interconnected._
- **Should `Sheet & Separator UI` be split into smaller, more focused modules?**
  _Cohesion score 0.0595959595959596 - nodes in this community are weakly interconnected._
- **Should `Router & Error Reporting` be split into smaller, more focused modules?**
  _Cohesion score 0.06161616161616162 - nodes in this community are weakly interconnected._