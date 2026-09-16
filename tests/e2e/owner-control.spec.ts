/**
 * The owner's day-end: read the day, set up the backup he was told to write down, take one, and
 * watch the alert clear. §6.9, §19.2, §19.5, §27.10's first half — the copy that makes the restore
 * possible at all.
 */
import { expect, test } from "@playwright/test";
import { dismissCoach, signIn } from "./helpers.ts";

test("the owner reads the day, creates the backup passphrase, and takes the first backup", async ({ page }) => {
  await signIn(page, "Արամ", "1111");

  // Home: nothing sold yet, and the one thing that would matter on the worst day is missing.
  await page.goto("/home");
  await dismissCoach(page);
  await expect(page.getByRole("heading", { name: "Գլխավոր" })).toBeVisible();
  await expect(page.getByText("Պահուստային պատճեն դեռ չի արվել")).toBeVisible();

  // Settings → Պահուստավորում: create the passphrase, which needs an admin PIN.
  await page.goto("/settings");
  await dismissCoach(page);
  await page.getByRole("button", { name: "Ստեղծել գաղտնաբառ" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Արամ" }).click();
  await page.keyboard.type("1111");
  await page.keyboard.press("Enter");
  const passphrase = page.getByRole("dialog").getByText(/^[A-HJ-NP-Z2-9]{4}(-[A-HJ-NP-Z2-9]{4}){5}$/);
  await expect(passphrase).toBeVisible();
  await expect(page.getByText("Հին պատճենները կբացվեն")).toBeVisible();
  await page.getByRole("button", { name: "Պատրաստ է" }).click();

  // Take one now, and see it recorded with its size.
  await page.getByRole("button", { name: "Պահուստավորել հիմա" }).click();
  await expect(page.getByText("Պատճենը պատրաստ է")).toBeVisible();
  await expect(page.getByText(/Վերջին պատճենը՝/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Վերականգնել այս պատճենից" }).first()).toBeVisible();

  // Diagnostics answers the first support question without anyone navigating anywhere: the three
  // settings installation sets are on the screen, two of which fail silently when wrong (§19.5).
  const diagnostics = page.locator("dl");
  await expect(diagnostics.getByText("Հարկային ռեժիմ")).toBeVisible();
  await expect(diagnostics.getByText("Ժամային գոտի")).toBeVisible();

  // The alert is gone, because the thing it asked for is done.
  await page.goto("/home");
  await dismissCoach(page);
  await expect(page.getByText("Պահուստային պատճեն դեռ չի արվել")).toHaveCount(0);

  // A report with no data says what would put data in it (§6.10, §8.4).
  await page.goto("/reports");
  await dismissCoach(page);
  await page.getByRole("button", { name: /^Վաճառք/ }).first().click();
  await expect(page.getByText("Այս ժամանակահատվածում տվյալ չկա")).toBeVisible();
});
