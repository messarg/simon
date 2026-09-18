/**
 * Navigation. PRD §5.1. What a person can do decides what exists: a destination they could not
 * use is absent, not greyed out. The counter's four are shown by job — an employee who only
 * receives goods has no till and no shift — and the shop's own destinations by tier: all of them
 * for the owner, all but Settings for a manager, none for an employee. The debts destination is
 * absent — not disabled — when the shop keeps no debt book (§6.11).
 */
import { BarChart3, BookUser, Clock, Contact, House, Package, ScanLine, Settings, Truck, Users, Warehouse, type LucideIcon } from "lucide-react";
import { can, isManager, isOwner, type Actor } from "@simon/shared";
import type { StringKey } from "@/i18n/t.ts";

export interface Destination {
  path: string;
  label: StringKey;
  icon: LucideIcon;
  /** Whether this person has any use for it. */
  shows: (a: Actor) => boolean;
  requiresDebtBook?: boolean;
}

/** A shift is where money is taken, for a sale or a refund (§16.4). */
const atCounter = (a: Actor) => can(a, "sell") || can(a, "returns");

export const WORKER_DESTINATIONS: readonly Destination[] = [
  { path: "/sell", label: "nav.sell", icon: ScanLine, shows: atCounter },
  { path: "/debts", label: "nav.debts", icon: BookUser, shows: (a) => can(a, "debt"), requiresDebtBook: true },
  // Everyone may look up what is on the shelf; what they can do there follows their grants.
  { path: "/stock", label: "nav.stock", icon: Warehouse, shows: () => true },
  { path: "/shift", label: "nav.shift", icon: Clock, shows: atCounter },
];

export const OWNER_DESTINATIONS: readonly Destination[] = [
  { path: "/home", label: "nav.home", icon: House, shows: (a) => isManager(a.role) },
  { path: "/reports", label: "nav.reports", icon: BarChart3, shows: (a) => isManager(a.role) },
  { path: "/products", label: "nav.products", icon: Package, shows: (a) => isManager(a.role) },
  { path: "/customers", label: "nav.customers", icon: Users, shows: (a) => isManager(a.role), requiresDebtBook: true },
  { path: "/suppliers", label: "nav.suppliers", icon: Truck, shows: (a) => isManager(a.role) },
  { path: "/staff", label: "nav.staff", icon: Contact, shows: (a) => isManager(a.role) },
  // How the shop is configured — and its backups, devices and sessions — is the owner's (§16.4).
  { path: "/settings", label: "nav.settings", icon: Settings, shows: (a) => isOwner(a.role) },
];

export function destinationsFor(actor: Actor, debtBookEnabled: boolean) {
  const allowed = (d: Destination) => d.shows(actor) && (!d.requiresDebtBook || debtBookEnabled);
  return { worker: WORKER_DESTINATIONS.filter(allowed), owner: OWNER_DESTINATIONS.filter(allowed) };
}

/**
 * Where this person starts: the till for anyone who takes money (§5.2), otherwise their first
 * destination — an employee who only receives goods has no till to be sent to.
 */
export function homePathFor(actor: Actor, debtBookEnabled = true): string {
  const { worker, owner } = destinationsFor(actor, debtBookEnabled);
  return (worker[0] ?? owner[0])?.path ?? "/stock";
}
