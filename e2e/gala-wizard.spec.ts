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

test("2. the RSVP button opens the wizard on the door picker", async ({ page }) => {
  await page.locator(RSVP).first().click();
  await expect(modal(page)).toContainText("Choose a door");
  await expect(modal(page)).toContainText("How are you joining us?");
});

test("8. the FAQ accordion opens and closes", async ({ page }) => {
  // The accordion binds to buttons by their sibling paragraph, not by
  // data-act, so the prepare() change left it working. This test is
  // here so the next change to that transform cannot break it quietly.
  const idx = await page.$$eval("#gala-content button", (els) =>
    els.findIndex((b) => b.nextElementSibling?.tagName === "P"),
  );
  expect(idx).toBeGreaterThanOrEqual(0);

  const btn = page.locator("#gala-content button").nth(idx);
  const answer = page.locator("#gala-content button + p").first();

  // Shut on load, open on click, shut again.
  await expect(answer).toBeHidden();
  await btn.click();
  await expect(answer).toBeVisible();
  await btn.click();
  await expect(answer).toBeHidden();
});

test("12. the modal takes focus, keeps it, and gives it back", async ({ page }) => {
  const rsvp = page.locator('#gala-content [data-act="openDoors"]').first();
  await rsvp.click();

  // The panel marker has to survive prepare(), or the trap below is
  // dead code that no other test would notice.
  await expect(page.locator("[data-modal-panel]")).toHaveCount(1);
  await expect(page.locator('[data-modal-panel][aria-modal="true"]')).toHaveCount(1);

  // Focus moved into the modal rather than staying on the page button.
  await expect
    .poll(() => page.evaluate(() =>
      document.activeElement?.closest("[data-modal-panel]") !== null
        && document.activeElement?.closest("[data-modal-panel]") !== undefined))
    .toBe(true);

  // Twenty tabs cannot get out of it.
  for (let i = 0; i < 20; i++) await page.keyboard.press("Tab");
  expect(
    await page.evaluate(() =>
      document.activeElement?.closest("[data-modal-panel]") != null),
  ).toBe(true);

  // Escape closes, and focus goes back to the button that opened it.
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-modal-panel]")).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      document.activeElement?.getAttribute("data-act")),
  ).toBe("openDoors");
});

test("14. the seat door goes straight to Ticket Tailor", async ({ page }) => {
  await page.route(/tickettailor\.com/, (r) => r.fulfill({ status: 200, body: "ticket tailor" }));
  await page.locator('#gala-content [data-act="pickSeat"]').first().click();
  await page.waitForURL(/tickettailor\.com\/events\/everestcollectivellc\/2426641/);
});

test("15. the table door goes straight to Ticket Tailor", async ({ page }) => {
  await page.route(/tickettailor\.com/, (r) => r.fulfill({ status: 200, body: "ticket tailor" }));
  await page.locator('#gala-content [data-act="pickHost"]').first().click();
  await page.waitForURL(/tickettailor\.com\/events\/everestcollectivellc\/2426641/);
});

test("16. the invited guest door opens Reign's RSVP form", async ({ page }) => {
  await page.route(/forms\.cloud\.microsoft/, (r) => r.fulfill({ status: 200, body: "rsvp form" }));
  await page.locator('#gala-content [data-act="pickGuest"]').first().click();
  await page.waitForURL(/forms\.cloud\.microsoft/);
});

test("17. the sponsor door shows tiers and requires a choice", async ({ page }) => {
  await page.locator('#gala-content [data-act="pickSponsor"]').first().click();
  const panel = page.locator("[data-modal-panel]");
  await expect(panel).toContainText("Choose a tier");
  await expect(panel).toContainText("Reign Bach");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(panel).toContainText("Choose a tier to continue.");
});
