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

/** Nobody is listed on the sign-in screen (§16.2): a person types their own name and PIN, on one form. */
export async function signIn(page: Page, name: string, pin: string, landsOn: RegExp = /\/sell/) {
  await page.goto("/sign-in");
  await page.getByLabel("Անուն").fill(name);
  // Exact: the reveal toggle beside the field carries "PIN" in its label too.
  await page.getByLabel("PIN", { exact: true }).fill(pin);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(landsOn);
  await dismissCoach(page);
}
