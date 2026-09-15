import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from "react-router";
import { Toaster } from "sonner";
import { AppShell } from "@/components/common/AppShell.tsx";
import { connection } from "@/lib/connection.ts";
import { onSessionExpired } from "@/lib/http.ts";
import { sessionStore, useSession } from "@/lib/session-store.ts";
import { PlaceholderPage } from "./pages/PlaceholderPage.tsx";
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
  useEffect(() => onSessionExpired(() => sessionStore.set(null)), []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/sign-in" element={<SignInPage />} />
          <Route element={<RequireSession />}>
            <Route path="/sell" element={<PlaceholderPage screen="nav.sell" />} />
            <Route path="/debts" element={<PlaceholderPage screen="nav.debts" />} />
            <Route path="/stock" element={<PlaceholderPage screen="nav.stock" />} />
            <Route path="/shift" element={<PlaceholderPage screen="nav.shift" />} />
            <Route element={<RequireAdmin />}>
              <Route path="/home" element={<PlaceholderPage screen="nav.home" />} />
              <Route path="/reports" element={<PlaceholderPage screen="nav.reports" />} />
              <Route path="/products" element={<PlaceholderPage screen="nav.products" />} />
              <Route path="/customers" element={<PlaceholderPage screen="nav.customers" />} />
              <Route path="/suppliers" element={<PlaceholderPage screen="nav.suppliers" />} />
              <Route path="/settings" element={<PlaceholderPage screen="nav.settings" />} />
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
