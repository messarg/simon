/**
 * The shell. Below `lg`: status strip on top, the page, and a bottom tab bar within thumb reach
 * (§5.2) — a phone and a tablet both get the reachable layout, since a tablet is held, not moused.
 * From `lg` up every role gets a left rail instead, the owner's carrying all ten destinations and a
 * worker's the four of §5.1. No drawer, no hamburger.
 *
 * The shell publishes its measurements as CSS variables — the rail's width, and the status strip's
 * and tab bar's heights — so a screen's own sticky header or bottom bar sits exactly below the strip
 * or above the tab bar and beside the rail, at every width, without repeating the breakpoints
 * (`components/shared/ActionBar.tsx`, the till's pay bar, the cash count's totals). The heights are
 * measured, not assumed: the text-size setting and the safe area both change them, and a guessed
 * constant left a bar a few pixels under the tabs.
 */
import { FlaskConical, LogOut, MoreHorizontal } from "lucide-react";
import { useState, type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router";
import { Button } from "@/components/ui/button.tsx";
import { Sheet } from "@/components/ui/sheet.tsx";
import { destinationsFor, type Destination } from "@/config/navigation.ts";
import { t } from "@/i18n/t.ts";
import { cn } from "@/lib/cn.ts";
import { useSession } from "@/lib/session-store.ts";
import { useClientSettings } from "@/app/settings.ts";
import { useSignOut } from "@/app/session.ts";
import { usePracticeMode } from "@/app/practice.ts";
import { StatusStrip } from "./StatusStrip.tsx";

function TabLink({ d, compact }: { d: Destination; compact?: boolean }) {
  const Icon = d.icon;
  return (
    <NavLink
      to={d.path}
      className={({ isActive }) => cn(
        "flex flex-1 flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 text-xs font-medium transition-colors min-h-touch",
        isActive ? "text-primary" : "text-muted-foreground",
        compact && "text-[0.7rem]",
      )}
    >
      {({ isActive }) => (
        <>
          <span className={cn("grid h-8 w-14 place-items-center rounded-full transition-colors", isActive && "bg-primary-soft")}>
            <Icon className="size-6" aria-hidden />
          </span>
          {t(d.label)}
        </>
      )}
    </NavLink>
  );
}

/**
 * A ref callback that publishes an element's rendered height on the shell as a CSS variable — 0 when
 * the element is hidden, as the tab bar is on a wide screen.
 */
function publishHeight(variable: string) {
  return (el: HTMLElement | null) => {
    if (!el) return;
    const shell = el.closest<HTMLElement>("[data-shell]");
    if (!shell) return;
    const publish = () => shell.style.setProperty(variable, `${el.offsetHeight}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(el);
    return () => observer.disconnect();
  };
}
const measureTabBar = publishHeight("--tabbar-h");
const measureStrip = publishHeight("--strip-h");

function RailLink({ d }: { d: Destination }) {
  const Icon = d.icon;
  return (
    <NavLink
      to={d.path}
      className={({ isActive }) => cn(
        "flex h-touch items-center gap-3 rounded-lg px-3 text-[0.95rem] font-medium transition-colors",
        isActive ? "bg-primary-soft text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="size-5" aria-hidden />
      {t(d.label)}
    </NavLink>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const session = useSession();
  const settings = useClientSettings();
  const signOut = useSignOut();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const [practiceOpen, setPracticeOpen] = useState(false);
  const practice = usePracticeMode();
  if (!session) return null;
  const { worker, owner } = destinationsFor(session.user.role, settings.data?.debtBookEnabled ?? true);
  const isOwner = owner.length > 0;

  return (
    <div data-shell className="flex min-h-dvh [--rail-w:0px] [--strip-h:0px] [--tabbar-h:0px] lg:[--rail-w:15rem]">
      <aside className="sticky top-0 hidden h-dvh w-(--rail-w) shrink-0 flex-col border-r border-border bg-card px-3 py-4 lg:flex">
        <div className="mb-5 flex items-center gap-2 px-3">
          <img src="/favicon.svg" alt="" width={28} height={28} className="rounded-md" />
          <span className="text-lg font-semibold">{t("app.name")}</span>
        </div>
        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto" aria-label={t("nav.home")}>
          {isOwner ? (
            <>
              {owner.map((d) => <RailLink key={d.path} d={d} />)}
              <div className="my-2 border-t border-border" />
              {worker.map((d) => <RailLink key={d.path} d={d} />)}
            </>
          ) : worker.map((d) => <RailLink key={d.path} d={d} />)}
        </nav>
        <div className="mt-4 border-t border-border pt-2">
          <button onClick={() => setPracticeOpen(true)} className="flex h-touch w-full items-center gap-3 rounded-lg px-3 text-muted-foreground hover:bg-muted">
            <FlaskConical className="size-5" aria-hidden />
            {practice.isPractice ? t("practice.leave") : t("practice.title")}
          </button>
          <button onClick={signOut} className="flex h-touch w-full items-center gap-3 rounded-lg px-3 text-muted-foreground hover:bg-muted">
            <LogOut className="size-5" aria-hidden />
            {t("common.signOut")}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div ref={measureStrip} className="sticky top-0 z-30"><StatusStrip /></div>
        <main id="main" className="flex min-h-0 flex-1 flex-col">{children}</main>
        <nav
          ref={measureTabBar}
          className="safe-bottom sticky bottom-0 z-30 border-t border-border bg-card/97 backdrop-blur lg:hidden"
          aria-label={t("nav.sell")}
        >
          <div className="flex gap-1 px-2 py-1">
            {worker.map((d) => <TabLink key={d.path} d={d} compact={isOwner} />)}
            <button
              onClick={() => setMoreOpen(true)}
              className={cn("flex min-h-touch flex-1 flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 font-medium text-muted-foreground", isOwner ? "text-[0.7rem]" : "text-xs")}
            >
              <span className="grid h-8 w-14 place-items-center"><MoreHorizontal className="size-6" aria-hidden /></span>
              {t("nav.more")}
            </button>
          </div>
        </nav>
      </div>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen} title={t("nav.more")}>
        <div className="grid grid-cols-2 gap-2">
          {owner.map((d) => {
            const Icon = d.icon;
            return (
              <button key={d.path} onClick={() => { setMoreOpen(false); navigate(d.path); }} className="flex h-touch-xl flex-col items-center justify-center gap-1 rounded-lg bg-muted text-sm font-medium">
                <Icon className="size-6 text-primary" aria-hidden />
                {t(d.label)}
              </button>
            );
          })}
          <button onClick={() => { setMoreOpen(false); setPracticeOpen(true); }} className="col-span-2 flex h-touch items-center justify-center gap-2 rounded-lg border border-border text-muted-foreground">
            <FlaskConical className="size-5" aria-hidden />
            {practice.isPractice ? t("practice.leave") : t("practice.title")}
          </button>
          <button onClick={signOut} className="col-span-2 flex h-touch items-center justify-center gap-2 rounded-lg border border-border text-muted-foreground">
            <LogOut className="size-5" aria-hidden />
            {t("common.signOut")}
          </button>
        </div>
      </Sheet>

      {/* Փորձնական (§7.2): the same shop, writing nothing that counts. */}
      <Sheet open={practiceOpen} onOpenChange={setPracticeOpen} title={t("practice.title")}>
        <div className="space-y-4">
          <p className="text-muted-foreground">{t("practice.hint")}</p>
          {practice.isPractice && <p className="rounded-lg bg-attention-soft p-3 text-sm text-attention-foreground">{t("practice.receipt")}</p>}
          <Button
            size="lg"
            className="w-full"
            variant={practice.isPractice ? "secondary" : "primary"}
            onClick={() => void practice.switchTo(practice.isPractice ? "LIVE" : "PRACTICE").then((ok) => { if (ok) { setPracticeOpen(false); navigate("/sell"); } })}
          >
            {practice.isPractice ? t("practice.leave") : t("practice.enter")}
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
