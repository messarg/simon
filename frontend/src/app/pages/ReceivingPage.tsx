/** Ընդունում — inside Պահեստ, for STOCK and ADMIN only (§5.1, §16.4). */
import { can } from "@simon/shared";
import { Navigate } from "react-router";
import { ReceivingForm } from "@/features/buying/ReceivingForm.tsx";
import { useSession } from "@/lib/session-store.ts";

export function ReceivingPage() {
  const session = useSession();
  if (!session || !can(session.user, "receive")) return <Navigate to="/stock" replace />;
  return <ReceivingForm />;
}
