import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from "react-router";
import { Toaster } from "sonner";
import { AppShell } from "@/components/common/AppShell.tsx";
import { connection } from "@/lib/connection.ts";
import { http, onSessionExpired } from "@/lib/http.ts";
import { can, isManager, isOwner, type Actor } from "@simon/shared";
import { homePathFor } from "@/config/navigation.ts";
import { sessionStore, useActor, useSession } from "@/lib/session-store.ts";
import { Bootstrap } from "./Bootstrap.tsx";
import { AttentionPage } from "./pages/AttentionPage.tsx";
import { HomePage } from "./pages/HomePage.tsx";
import { ImportPage } from "./pages/ImportPage.tsx";
import { LabelsPage } from "./pages/LabelsPage.tsx";
import { PersonPage } from "./pages/PersonPage.tsx";
import { StaffPage } from "./pages/StaffPage.tsx";
import { StocktakePage } from "./pages/StocktakePage.tsx";
import { ReportsPage } from "./pages/ReportsPage.tsx";
import { DebtsPage } from "./pages/DebtsPage.tsx";
import { ProductsPage } from "./pages/ProductsPage.tsx";
import { ReceivingPage } from "./pages/ReceivingPage.tsx";
import { SuppliersPage } from "./pages/SuppliersPage.tsx";
import { SettingsPage } from "./pages/SettingsPage.tsx";
import { ShiftPage } from "./pages/ShiftPage.tsx";
import { StockPage } from "./pages/StockPage.tsx";
import { TillPage } from "./pages/TillPage.tsx";
import { SetupPage } from "./pages/SetupPage.tsx";
import { SignInPage } from "./pages/SignInPage.tsx";
import { useClientSettings } from "./settings.ts";

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: (count, err) => count < 1 && (err as { status?: number }).status === 0, refetchOnWindowFocus: false },
      mutations: { retry: 0 },
    },
  });
}

function RequireSession() {
  const session = useSession();
  const location = useLocation();
  useClientSettings();
  // An abandoned wizard resumes where it stopped, once the owner is there to resume it (§7.1, §27.35).
  const setup = useQuery({
    queryKey: ["setup", "status"],
    queryFn: () => http.get<{ needsOwner: boolean; step: number; completedAt: string | null }>("/setup/status"),
    enabled: session?.user.role === "OWNER",
    staleTime: 60_000,
  });
  if (!session) return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
  if (setup.data && !setup.data.needsOwner && !setup.data.completedAt && setup.data.step >= 2 && location.pathname !== "/setup") {
    return <Navigate to="/setup" replace />;
  }
  return (
    <AppShell>
      <Bootstrap />
      <Outlet />
    </AppShell>
  );
}

/**
 * A screen this person cannot use sends them to where they start instead (§5.1). The server
 * refuses the calls anyway; this only keeps someone from landing on a page of 403s.
 */
function Require({ when }: { when: (a: Actor) => boolean }) {
  const actor = useActor();
  if (!actor) return <Navigate to="/sign-in" replace />;
  if (!when(actor)) return <Navigate to={homePathFor(actor)} replace />;
  return <Outlet />;
}

/** The catch-all: wherever this person starts, or the sign-in screen. */
function Start() {
  const actor = useActor();
  return <Navigate to={actor ? homePathFor(actor) : "/sign-in"} replace />;
}

const atCounter = (a: Actor) => can(a, "sell") || can(a, "returns");
const manager = (a: Actor) => isManager(a.role);
const owner = (a: Actor) => isOwner(a.role);

export function App() {
  const [queryClient] = useState(createQueryClient);

  useEffect(() => connection.start(), []);
  // Each tier wears its own palette (theme.css) — the owner dark, a manager lavender, an employee
  // pastel blue — so whose session is open is recognisable across the counter. Set on the root so
  // sheets and portals pick it up too; cleared on sign-out, back to the default green.
  const role = useSession()?.user.role;
  useEffect(() => {
    const root = document.documentElement;
    if (role) root.dataset.tier = role.toLowerCase();
    else delete root.dataset.tier;
  }, [role]);
  // A 401 on an ordinary request returns to the PIN pad; the basket lives in IndexedDB and survives (§16.3).
  // A session ended by closing its shift stays on screen until the worker leaves the Z-report.
  useEffect(() => onSessionExpired(() => { if (!sessionStore.get()?.endedByShiftClose) sessionStore.set(null); }), []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/sign-in" element={<SignInPage />} />
          <Route element={<RequireSession />}>
            <Route element={<Require when={atCounter} />}>
              <Route path="/sell" element={<TillPage />} />
              <Route path="/shift" element={<ShiftPage />} />
            </Route>
            <Route element={<Require when={(a) => can(a, "debt")} />}>
              <Route path="/debts" element={<DebtsPage />} />
            </Route>
            <Route path="/stock" element={<StockPage />} />
            <Route element={<Require when={(a) => can(a, "receive")} />}>
              <Route path="/stock/receive" element={<ReceivingPage />} />
            </Route>
            <Route element={<Require when={(a) => can(a, "stocktake")} />}>
              <Route path="/stock/count" element={<StocktakePage />} />
            </Route>
            <Route element={<Require when={(a) => can(a, "labels")} />}>
              <Route path="/labels" element={<LabelsPage />} />
            </Route>
            <Route path="/attention" element={<AttentionPage />} />
            <Route element={<Require when={manager} />}>
              <Route path="/home" element={<HomePage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/customers" element={<DebtsPage admin />} />
              <Route path="/suppliers" element={<SuppliersPage />} />
              {/* Աշխատակիցներ: the staff list is a destination, and a person's page hangs off it (§6.17). */}
              <Route path="/staff" element={<StaffPage />} />
              <Route path="/staff/:id" element={<PersonPage />} />
            </Route>
            <Route element={<Require when={owner} />}>
              {/* Imports write opening costs, and Settings holds backups, devices and sessions (§16.4). */}
              <Route path="/import" element={<ImportPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Route>
          {/* The till is the home screen for anyone who takes money (§5.2). */}
          <Route path="*" element={<Start />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-center" richColors closeButton toastOptions={{ className: "text-base" }} />
    </QueryClientProvider>
  );
}
