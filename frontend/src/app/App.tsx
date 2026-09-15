import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from "react-router";
import { Toaster } from "sonner";
import { AppShell } from "@/components/common/AppShell.tsx";
import { connection } from "@/lib/connection.ts";
import { onSessionExpired } from "@/lib/http.ts";
import { sessionStore, useSession } from "@/lib/session-store.ts";
import { Bootstrap } from "./Bootstrap.tsx";
import { PlaceholderPage } from "./pages/PlaceholderPage.tsx";
import { DebtsPage } from "./pages/DebtsPage.tsx";
import { ProductsPage } from "./pages/ProductsPage.tsx";
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
  if (!session) return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
  return (
    <AppShell>
      <Bootstrap />
      <Outlet />
    </AppShell>
  );
}

function RequireAdmin() {
  const session = useSession();
  if (session?.user.role !== "ADMIN") return <Navigate to="/sell" replace />;
  return <Outlet />;
}

export function App() {
  const [queryClient] = useState(createQueryClient);

  useEffect(() => connection.start(), []);
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
            <Route path="/sell" element={<TillPage />} />
            <Route path="/debts" element={<DebtsPage />} />
            <Route path="/stock" element={<StockPage />} />
            <Route path="/shift" element={<ShiftPage />} />
            <Route element={<RequireAdmin />}>
              <Route path="/home" element={<PlaceholderPage screen="nav.home" />} />
              <Route path="/reports" element={<PlaceholderPage screen="nav.reports" />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/customers" element={<DebtsPage admin />} />
              <Route path="/suppliers" element={<PlaceholderPage screen="nav.suppliers" />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Route>
          {/* The till is the home screen (§5.2). */}
          <Route path="*" element={<Navigate to="/sell" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-center" richColors closeButton toastOptions={{ className: "text-base" }} />
    </QueryClientProvider>
  );
}
