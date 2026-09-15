import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useNavigate } from "react-router";
import { http } from "@/lib/http.ts";
import { sessionStore } from "@/lib/session-store.ts";

export function useSignOut() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  return useCallback(async () => {
    try { await http.post("/auth/logout", undefined, { timeoutMs: 3000 }); } catch { /* the session dies locally either way */ }
    sessionStore.set(null);
    qc.clear();
    navigate("/sign-in", { replace: true });
  }, [navigate, qc]);
}
