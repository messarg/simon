/**
 * Navigation. PRD §5.1. Role decides what exists: a worker's app is four destinations and
 * nothing else; the owner adds the rest. The debts destination is absent — not disabled — when
 * the shop keeps no debt book (§6.11).
 */
import { BarChart3, BookUser, Clock, Contact, House, Package, ScanLine, Settings, Truck, Users, Warehouse, type LucideIcon } from "lucide-react";
import type { Role } from "@simon/shared";
import type { StringKey } from "@/i18n/t.ts";

export interface Destination {
  path: string;
  label: StringKey;
  icon: LucideIcon;
  roles: readonly Role[];
  requiresDebtBook?: boolean;
}

const ALL: readonly Role[] = ["WORKER", "STOCK", "ADMIN"];

export const WORKER_DESTINATIONS: readonly Destination[] = [
  { path: "/sell", label: "nav.sell", icon: ScanLine, roles: ALL },
  { path: "/debts", label: "nav.debts", icon: BookUser, roles: ALL, requiresDebtBook: true },
  { path: "/stock", label: "nav.stock", icon: Warehouse, roles: ALL },
  { path: "/shift", label: "nav.shift", icon: Clock, roles: ALL },
];

export const OWNER_DESTINATIONS: readonly Destination[] = [
  { path: "/home", label: "nav.home", icon: House, roles: ["ADMIN"] },
  { path: "/reports", label: "nav.reports", icon: BarChart3, roles: ["ADMIN"] },
  { path: "/products", label: "nav.products", icon: Package, roles: ["ADMIN"] },
  { path: "/customers", label: "nav.customers", icon: Users, roles: ["ADMIN"], requiresDebtBook: true },
  { path: "/suppliers", label: "nav.suppliers", icon: Truck, roles: ["ADMIN"] },
  { path: "/staff", label: "nav.staff", icon: Contact, roles: ["ADMIN"] },
  { path: "/settings", label: "nav.settings", icon: Settings, roles: ["ADMIN"] },
];

export function destinationsFor(role: Role, debtBookEnabled: boolean) {
  const allowed = (d: Destination) => d.roles.includes(role) && (!d.requiresDebtBook || debtBookEnabled);
  return { worker: WORKER_DESTINATIONS.filter(allowed), owner: OWNER_DESTINATIONS.filter(allowed) };
}
