import type { AuthContext } from "../lib/auth-context.ts";

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}
