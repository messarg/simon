/**
 * Phase 6's exit criterion (§23): the owner counts stock without closing the shop. A worker sells
 * cement on one till while Լուսինե counts the shelf on another; the sale made between the snapshot
 * and the count is not booked as shrinkage, and the owner approves.
 */
import { expect, test } from "@playwright/test";
import { dismissCoach, signIn } from "./helpers.ts";

test("stock is counted while the shop keeps selling", async ({ browser }) => {
  const till = await (await browser.newContext()).newPage();
  const counter = await (await browser.newContext()).newPage();

  // The worker opens a shift.
  await signIn(till, "Գոռ", "333333");
  await till.goto("/shift");
  await dismissCoach(till);
  for (const d of "10000") await till.getByRole("button", { name: d, exact: true }).click();
  await till.getByRole("button", { name: "Բացել հերթափոխ" }).click();
  await expect(till).toHaveURL(/\/sell/);

  // Stock starts a whole-shop count: 40 sacks of cement on the books.
  await signIn(counter, "Լուսինե", "222222");
  await counter.goto("/stock/count");
  await dismissCoach(counter);
  await counter.getByRole("button", { name: "Ամբողջ խանութը" }).click();
  await expect(counter.getByText(/Հաշված է 0՝/)).toBeVisible();

  // Meanwhile the till sells two sacks.
  await till.keyboard.type("4850001234567");
  await till.keyboard.press("Enter");
  await till.waitForTimeout(400);
  await till.keyboard.type("4850001234567");
  await till.keyboard.press("Enter");
  await expect(till.getByText("2 տուփ × 3 200")).toBeVisible();
  await till.getByRole("button", { name: /ՎՃԱՐԵԼ/ }).click();
  await till.getByRole("dialog").getByRole("button", { name: "Ճիշտ" }).click();
  await expect(till.getByText("Վաճառքն ավարտված է")).toBeVisible();

  // The shelf now holds 38, and 38 is what is counted.
  await counter.keyboard.type("4850001234567");
  await counter.keyboard.press("Enter");
  const sheet = counter.getByRole("dialog");
  for (const d of "38") await sheet.getByRole("button", { name: d, exact: true }).click();
  await sheet.getByRole("button", { name: "Պահել" }).click();
  await expect(counter.getByText(/Հաշված է 1՝/)).toBeVisible();

  // Screws: the books say 2 000, the shelf has 1 990 — a real shortage.
  await counter.keyboard.type("4820000000401");
  await counter.keyboard.press("Enter");
  for (const d of "1990") await sheet.getByRole("button", { name: d, exact: true }).click();
  await sheet.getByRole("button", { name: "Պահել" }).click();
  await expect(counter.getByText(/Հաշված է 2՝/)).toBeVisible();

  await counter.getByRole("button", { name: "Ավարտել հաշվումը" }).first().click();
  await counter.getByRole("dialog").getByRole("button", { name: "Ավարտել հաշվումը" }).click();
  await expect(counter.getByText("Սպասում է մենեջերի հաստատմանը")).toBeVisible();

  // The owner reviews: only the screws differ — the two sold sacks are not shrinkage.
  const owner = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await signIn(owner, "Արամ", "111111");
  await owner.goto("/stock/count");
  await dismissCoach(owner);
  const rows = owner.locator("tbody tr");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("Պտուտակ 4x40");
  await expect(rows.first()).toContainText("−10");
  await expect(owner.getByText("−220 ֏").first()).toBeVisible(); // 10 × 22 ֏ at cost

  await owner.getByRole("button", { name: "Հաստատել" }).click();
  await owner.getByRole("dialog").getByRole("button", { name: "Այո, հաստատել" }).click();
  await expect(owner.getByRole("button", { name: "Ամբողջ խանութը" })).toBeVisible();
  await expect(owner.getByText("Հաստատված")).toBeVisible();

  // Leave the shop as the other journeys expect it: the worker's shift closed. The count itself is
  // not what is being tested here, so the note covers whatever the drawer holds.
  const token = await till.evaluate(() => JSON.parse(sessionStorage.getItem("simon.session") ?? "{}").token as string);
  const headers = { Authorization: `Bearer ${token}` };
  const current = await (await till.request.get("/api/shifts/current", { headers })).json();
  const shiftId = current.shift.id as string;
  await till.request.post(`/api/shifts/${shiftId}/begin-close`, { headers, data: { unsyncedAtClose: 0 } });
  const closed = await till.request.post(`/api/shifts/${shiftId}/close`, { headers, data: { breakdown: [{ value: 10_000, count: 1 }], note: "e2e", unsyncedAtClose: 0 } });
  expect(closed.status()).toBe(200);
});
