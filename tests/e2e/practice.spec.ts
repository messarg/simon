/**
 * §7.2, §19.4 — a worker practises: the banner is unmistakable, the shop behaves exactly as normal,
 * and leaving throws it all away. The real till is where it was.
 */
import { expect, test } from "@playwright/test";
import { dismissCoach, signIn } from "./helpers.ts";

test("a worker practises a sale and leaves nothing behind", async ({ page }) => {
  await signIn(page, "Գոռ", "3333");

  // Into practice from the same place sign-out lives, so it is found without being taught.
  await page.getByRole("button", { name: "Ավելին" }).click();
  await page.getByRole("button", { name: "Փորձնական ռեժիմ" }).click();
  await page.getByRole("button", { name: "Միացնել փորձնականը" }).click();
  // Wait for the switch itself, not for the sheet that asked for it: the mode flips on the server.
  await expect(page.getByText("Ոչինչ չի գրանցվում")).toBeVisible();
  await expect(page.getByRole("button", { name: "Միացնել փորձնականը" })).toHaveCount(0);

  // A practice shift and a practice sale behave exactly as the real ones do.
  await page.goto("/shift");
  await dismissCoach(page);
  for (const digit of "20000") await page.getByRole("button", { name: digit, exact: true }).click();
  await page.getByRole("button", { name: "Բացել հերթափոխ" }).click();
  await expect(page).toHaveURL(/\/sell/);
  await page.keyboard.type("4820000000401");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: /Պտուտակ 4x40/ }).first()).toBeVisible();
  await page.getByRole("button", { name: /ՎՃԱՐԵԼ/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Ճիշտ" }).click();
  await expect(page.getByText("Վաճառքն ավարտված է")).toBeVisible();
  await page.getByRole("button", { name: "Նոր վաճառք" }).click();

  // Out again: the banner goes, and the real shop has no shift open and nothing sold.
  await page.getByRole("button", { name: "Ավելին" }).click();
  await page.getByRole("button", { name: "Վերադառնալ իրականին" }).click();
  await page.getByRole("button", { name: "Վերադառնալ իրականին" }).click();
  await expect(page.getByText("Իրական ռեժիմ")).toBeVisible();
  await expect(page.getByText("Փորձնական ռեժիմ")).toHaveCount(0);
  await expect(page.getByText("Հերթափոխը բաց չէ")).toBeVisible();

  const token = await page.evaluate(() => JSON.parse(sessionStorage.getItem("simon.session") ?? "{}").token as string);
  const sales = await page.request.get("/api/sales?status=COMPLETED&limit=5", { headers: { Authorization: `Bearer ${token}` } });
  expect((await sales.json()).items).toHaveLength(0);
});
