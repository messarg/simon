/**
 * J1 → J2 → offline → J4 on a phone (PRD §6 journeys, §27.1, §27.8, §27.7).
 * The dev seed provides the worker Գոռ (PIN 3333) and a small hardware catalogue.
 */
import { expect, test, type Page } from "@playwright/test";
import { dismissCoach, signIn } from "./helpers.ts";

async function scan(page: Page, code: string) {
  await page.keyboard.type(code, { delay: 5 });
  await page.keyboard.press("Enter");
}

async function tapKeys(page: Page, keys: string) {
  for (const k of keys) await page.getByRole("button", { name: k, exact: true }).click();
}

test("a worker opens a shift, sells, keeps selling offline, syncs exactly once and closes", async ({ page }) => {
  // J1 — sign in and open on a counted float.
  await signIn(page, "Գոռ", "3333");
  await expect(page.getByText("Հերթափոխը բաց չէ")).toBeVisible();
  await page.goto("/shift");
  await dismissCoach(page);
  await tapKeys(page, "20000");
  await page.getByRole("button", { name: "Բացել հերթափոխ" }).click();
  await expect(page).toHaveURL(/\/sell/);

  // J2 — scan twice (one line, incremented), then pay with the exact-cash shortcut.
  await scan(page, "4820000000401");
  await expect(page.getByRole("button", { name: /Պտուտակ 4x40/ }).first()).toBeVisible();
  // The scanner ignores an identical code within 300 ms (cheap scanners double-fire), so a real
  // rescan comes a moment later — as a person's second scan always does.
  await page.waitForTimeout(400);
  await scan(page, "4820000000401");
  await expect(page.getByText("2 հատ × 50")).toBeVisible();
  await page.getByRole("button", { name: /ՎՃԱՐԵԼ/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Ճիշտ" }).click();
  await expect(page.getByText("Վաճառքն ավարտված է")).toBeVisible();
  await page.getByRole("button", { name: "Նոր վաճառք" }).click();

  // Offline — the host is unreachable; the till keeps selling and says so calmly (§8.3, §14.4).
  await page.route("**/api/**", (route) => route.abort("internetdisconnected"));
  await expect(page.getByText("Աշխատում է առանց կապի")).toBeVisible({ timeout: 20_000 });
  await scan(page, "4850001234567");
  await expect(page.getByRole("button", { name: /Ցեմենտ M400, 50 կգ/ }).first()).toBeVisible();
  await page.getByRole("button", { name: /ՎՃԱՐԵԼ/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: /^5\s000$/ }).click();
  await expect(page.getByText("Առանց կապի չեկը չի տպվի")).toBeVisible();
  await expect(page.getByText(/1 վաճառք դեռ չի ուղարկվել/)).toBeVisible();
  await page.getByRole("button", { name: "Նոր վաճառք" }).click();

  // Reconnect — the queue drains, and the server holds each sale exactly once (§27.8).
  await page.unroute("**/api/**");
  await expect(page.getByText(/վաճառք դեռ չի ուղարկվել/)).toHaveCount(0, { timeout: 30_000 });
  const token = await page.evaluate(() => JSON.parse(sessionStorage.getItem("simon.session") ?? "{}").token as string);
  const sales = await page.request.get("/api/sales?status=COMPLETED&limit=50", { headers: { Authorization: `Bearer ${token}` } });
  const items = (await sales.json()).items as Array<{ total: number; number: string }>;
  expect(items.map((s) => s.total).sort((a, b) => a - b)).toEqual([100, 3200]);
  expect(new Set(items.map((s) => s.number)).size).toBe(2);

  // J4 — close: expected 20 000 + 100 + 3 200 = 23 300; count it exactly, variance zero.
  await page.goto("/shift");
  await dismissCoach(page);
  await expect(page.getByText("23 300 ֏").first()).toBeVisible();
  await page.getByRole("button", { name: /Փակել հերթափոխ/ }).click();
  await page.getByRole("button", { name: /Փակել հերթափոխ/ }).click();
  await expect(page.getByText("Հաշվի՛ր կանխիկը")).toBeVisible();
  await page.getByRole("textbox", { name: "20000", exact: true }).fill("1");
  await page.getByRole("textbox", { name: "2000", exact: true }).fill("1");
  await page.getByRole("textbox", { name: "1000", exact: true }).fill("1");
  await page.getByRole("textbox", { name: "200", exact: true }).fill("1");
  await page.getByRole("textbox", { name: "100", exact: true }).fill("1");
  await page.getByRole("button", { name: "Փակել հերթափոխ" }).last().click();
  await page.getByRole("dialog").getByRole("button", { name: "Այո, փակել" }).click();
  // The session died with the shift (§27.40), yet the Z-report stays on screen and was printed by the host.
  await expect(page.getByRole("heading", { name: "Z-հաշվետվություն" })).toBeVisible();
  await expect(page.getByText("Z-հաշվետվությունը տպվեց")).toBeVisible();
  await page.getByRole("button", { name: "Ավարտել և դուրս գալ" }).click();
  await expect(page.getByRole("heading", { name: "Ո՞վ է աշխատում" })).toBeVisible();
});
