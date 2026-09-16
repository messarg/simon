/** Shared steps: signing in, and the coach mark a person meets the first time they open a screen (§7.5). */
import { expect, type Page } from "@playwright/test";

/** A screen opened for the first time by this person explains itself once; the person taps it away. */
export async function dismissCoach(page: Page) {
  const gotIt = page.getByRole("button", { name: "Հասկացա" });
  // It appears once this person's seen-list arrives, which is a round trip after the screen does.
  await gotIt.waitFor({ state: "visible", timeout: 2_000 }).catch(() => undefined);
  if (await gotIt.isVisible().catch(() => false)) {
    await gotIt.click();
    await expect(gotIt).toBeHidden();
  }
}

export async function signIn(page: Page, name: string, pin: string) {
  await page.goto("/sign-in");
  await page.getByRole("button", { name }).click();
  // A PIN shorter than the maximum is submitted deliberately, by Enter or the ✓ key.
  await page.keyboard.type(pin);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/sell/);
  await dismissCoach(page);
}
