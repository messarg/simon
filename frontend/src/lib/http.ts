/**
 * The one HTTP client. PRD §15.1–15.2.
 *
 * Relative `/api` — never a LAN IP. Failures arrive as RFC 7807 and are thrown as
 * `ApiProblem` carrying the frozen `type` slug and the numbers the screen needs. A network
 * failure is `ApiProblem` with status 0, which the outbox treats as retryable.
 */
import { problemSlug, type Problem } from "@simon/shared";
import { sessionStore } from "./session-store.ts";

const BASE = "/api";

export class ApiProblem extends Error {
  readonly status: number;
  readonly type: string;
  readonly body: Problem;
  constructor(body: Problem) {
    super(problemSlug(body.type));
    this.status = body.status;
    this.type = problemSlug(body.type);
    this.body = body;
  }
  get network() { return this.status === 0; }
  field<T = unknown>(name: string): T | undefined { return this.body[name] as T | undefined; }
}

type Query = Record<string, string | number | boolean | null | undefined>;

export interface RequestOptions {
  query?: Query;
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Don't clear the session on 401 (used by the outbox, which holds instead). */
  keepSessionOn401?: boolean;
}

const listeners401 = new Set<() => void>();
export const onSessionExpired = (fn: () => void) => { listeners401.add(fn); return () => { listeners401.delete(fn); }; };

async function request<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
  const url = new URL(BASE + path, window.location.origin);
  for (const [k, v] of Object.entries(opts.query ?? {})) if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = sessionStore.get()?.token;
  if (token) headers.Authorization = `Bearer ${token}`;
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";

  const controller = new AbortController();
  const timer = opts.timeoutMs ? setTimeout(() => controller.abort(), opts.timeoutMs) : null;
  opts.signal?.addEventListener("abort", () => controller.abort());
  let res: Response;
  try {
    res = await fetch(url, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body), signal: controller.signal });
  } catch {
    throw new ApiProblem({ type: "network", title: "Network error", status: 0 });
  } finally {
    if (timer) clearTimeout(timer);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    const p = new ApiProblem(data?.type ? data : { type: res.status >= 500 ? "internal-error" : "malformed-request", title: res.statusText, status: res.status });
    if (p.type === "session-expired" && !opts.keepSessionOn401 && token) listeners401.forEach((l) => l());
    throw p;
  }
  return data as T;
}

export const http = {
  get: <T>(path: string, opts?: RequestOptions) => request<T>("GET", path, opts),
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) => request<T>("POST", path, { ...opts, body }),
  patch: <T>(path: string, body?: unknown, opts?: RequestOptions) => request<T>("PATCH", path, { ...opts, body }),
  put: <T>(path: string, body?: unknown, opts?: RequestOptions) => request<T>("PUT", path, { ...opts, body }),
  del: <T>(path: string, opts?: RequestOptions) => request<T>("DELETE", path, opts),
};
