/**
 * Simon backend entry point.
 *
 * Binds 0.0.0.0 so staff phones on the shop LAN can reach it (PRD §15.6). That also
 * means every device on that Wi-Fi can reach it — authorization is enforced per route,
 * never by CORS.
 */
const PORT = Number(process.env.PORT ?? 5000);
const HOST = "0.0.0.0";

console.log(`Simon backend — not yet implemented. Will listen on ${HOST}:${PORT}`);
console.log("Next: Prisma schema, then domain services. See docs/prd.md §22 Phase 0.");
