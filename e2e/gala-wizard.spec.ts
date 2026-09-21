import { test, expect, type Page } from "@playwright/test";

/**
 * The five checks that were previously done by hand.
 *
 * Each one covers a failure that a compile cannot see: whether the
 * modal actually opens, whether it opens on the right step, whether
 * validation refuses bad input, and whether Back goes where it should.
 */

const DOORS = '#gala-content [data-act="pickHost"]';
const RSVP = '#gala-content [data-act="openDoors"]';

/** The modal is server-rendered markup injected by the wizard. */
function modal(page: Page) {
  return page.locator("body");
}

test.beforeEach(async ({ page }) => {
  await page.goto("/gala");
  await page.waitForLoadState("networkidle");
});

test("1. the table host card opens the wizard on the table step", async ({ page }) => {
  await page.locator(DOORS).first().click();
  await expect(modal(page)).toContainText("Step 1 of 6");
  await expect(modal(page)).toContainText("Table host");
});

test("2. the RSVP button opens the wizard on the door picker", async ({ page }) => {
  await page.locator(RSVP).first().click();
  await expect(modal(page)).toContainText("Choose a door");
  await expect(modal(page)).toContainText("How are you joining us?");
});

test("3. an invalid code is refused with the real message", async ({ page }) => {
  // Straight to the guest door via its own card on the page, rather
  // than opening the picker and hunting for text. getByText matched a
  // span inside the button and the button swallowed the click.
  await page.locator('#gala-content [data-act="pickGuest"]').first().click();

  await page.locator('input[name="code"]').fill("COLLECTIVE-NOBODY");
  await page.getByRole("button", { name: "Continue" }).click();

  // The message comes from validate_gala_code in Postgres, not from
  // anything hardcoded in the browser.
  await expect(modal(page)).toContainText("We cannot find that code");

  // And it must not have advanced.
  await expect(modal(page)).toContainText("Step 1 of 4");
});

test("4. the you step refuses empty required fields", async ({ page }) => {
  await page.locator(DOORS).first().click();
  await page.getByRole("button", { name: "Continue" }).click();

  // Now on the you step. Submit it empty.
  await expect(modal(page)).toContainText("Step 2 of 6");
  await page.getByRole("button", { name: "Continue" }).click();

  // Still on step 2, because required fields were blank.
  await expect(modal(page)).toContainText("Step 2 of 6");
});

test("5. back from the first step returns to the door picker", async ({ page }) => {
  await page.locator(DOORS).first().click();
  await expect(modal(page)).toContainText("Step 1 of 6");

  await page.getByRole("button", { name: "Back" }).click();
  await expect(modal(page)).toContainText("Choose a door");
});

test("6. the sponsor door lists the real tiers and requires a choice", async ({ page }) => {
  await page.locator('#gala-content [data-act="pickSponsor"]').first().click();
  await expect(modal(page)).toContainText("Step 1 of 7");

  // The four tiers come from gala_tiers, not from the prototype's
  // hardcoded array. Prices are the ones in the database.
  await expect(modal(page)).toContainText("Presenting Sponsor");
  await expect(modal(page)).toContainText("$15,000");
  await expect(modal(page)).toContainText("Bronze Sponsor");

  // Continue with nothing chosen is refused.
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(modal(page)).toContainText("Choose a tier to continue");
  await expect(modal(page)).toContainText("Step 1 of 7");

  // Choosing one and continuing moves to the company step.
  await page.locator('[data-act^="tier:"]').first().click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(modal(page)).toContainText("Step 2 of 7");
  await expect(modal(page)).toContainText("Your company");
});
