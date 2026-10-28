import { Link, Outlet } from "@tanstack/react-router";
import { LayoutGrid, ScanLine, Thermometer, ShieldCheck, ChefHat, CalendarDays, Leaf } from "lucide-react";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutGrid },
  { to: "/recognition", label: "Food Recognition", icon: ScanLine },
  { to: "/freshness", label: "Freshness Detector", icon: Thermometer },
  { to: "/hygiene", label: "Hygiene Monitor", icon: ShieldCheck },
  { to: "/kitchen", label: "Smart Kitchen", icon: ChefHat },
  { to: "/planner", label: "Meal Planner", icon: CalendarDays },
] as const;

export function AppShell() {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-4 md:flex">
        <Link to="/" className="mb-8 flex items-center gap-3 px-2">
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-glow">
            <Leaf className="size-5" />
          </span>
          <span className="font-display text-lg font-semibold">FoodVerse</span>
        </Link>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === "/" }}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-secondary"
              activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground font-medium" }}
            >
              <Icon className="size-4" /> {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto rounded-xl border border-sidebar-border bg-card p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">System Status</span>
            <span className="flex items-center gap-1 text-success">
              <span className="size-1.5 rounded-full bg-success" /> Online
            </span>
          </div>
          <p className="mt-2 text-muted-foreground">History is stored only on this device.</p>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <nav className="flex gap-1 overflow-x-auto border-b border-border bg-sidebar p-2 md:hidden">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === "/" }}
              className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs text-sidebar-foreground"
              activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
            >
              <Icon className="size-4" /> {label}
            </Link>
          ))}
        </nav>
        <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="mt-1 text-muted-foreground">{subtitle}</p>
    </div>
  );
}

export function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-border bg-card p-5 ${className}`}>{children}</div>;
}

export function errMsg(e: unknown) {
  return e instanceof Error ? e.message : "Something went wrong.";
}
