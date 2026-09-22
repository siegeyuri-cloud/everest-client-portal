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

test("7. a guest can register end to end and gets a reference", async ({ page }) => {
  await page.locator('#gala-content [data-act="pickGuest"]').first().click();

  // Mint a throwaway host so this test owns the code it spends. Using a
  // real host's code emptied Mike Fromhold's table twice in one day.
  const hostStamp = Date.now();
  const made = await page.request.post("/api/gala/register", {
    headers: { "x-pw-test": "1" },
    data: {
      door: "host",
      first_name: "Fixture",
      last_name: `Host${hostStamp}`,
      email: `pwfixture+${hostStamp}@everestcollective.com`,
      mobile: "214-555-0133",
      line: "Holding a table so the guest door has a code to spend",
      table_name: `Fixture Table ${hostStamp}`,
    },
  });
  const ownCode = (await made.json())?.data?.host_code;
  expect(ownCode, "fixture host should return a code").toBeTruthy();

  await page.locator('input[name="code"]').fill(ownCode);
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(modal(page)).toContainText("Step 2 of 4");
  const stamp = Date.now();
  await page.locator('input[name="first"]').fill("Playwright");
  await page.locator('input[name="last"]').fill("Guest");
  await page.locator('input[name="mobile"]').fill("214-555-0199");
  await page.locator('input[name="email"]').fill(`pw+${stamp}@everestcollective.com`);
  await page.getByRole("button", { name: "Continue" }).click();

  // connect step
  await expect(modal(page)).toContainText("Step 3 of 4");
  await page.locator('textarea, input[name="line"]').first()
    .fill("Testing whether this registers a real person");
  await page.getByRole("button", { name: "Continue" }).click();

  // The review step shows back what they typed, from the wizard's own
  // state rather than from anything the server sent.
  await expect(modal(page)).toContainText("Step 4 of 4");
  await expect(modal(page)).toContainText("Playwright Guest");
  await expect(modal(page)).toContainText(`Fixture Host${hostStamp}`);

  await page.getByRole("button", { name: "Complete registration" }).click();

  // A reference beginning TCG- only exists if Postgres wrote the row.
  await expect(modal(page)).toContainText(/TCG-[A-Z0-9]{6}/, { timeout: 15000 });
});

test("13. coming alone does not ask for a guest", async ({ page }) => {
  await page.locator('#gala-content [data-act="pickSeat"]').first().click();
  await expect(modal(page)).toContainText("Step 1 of 6");
  await page.getByRole("button", { name: "Continue" }).click();

  const stamp = Date.now();
  await expect(modal(page)).toContainText("Step 2 of 6");
  await page.locator('input[name="first"]').fill("Playwright");
  await page.locator('input[name="last"]').fill("Alone");
  await page.locator('input[name="mobile"]').fill("214-555-0166");
  await page.locator('input[name="email"]').fill(`pwalone+${stamp}@everestcollective.com`);
  await page.getByRole("button", { name: "Continue" }).click();

  // Saying no should carry them straight past, with no guest fields
  // rendered and nothing demanded of them.
  await expect(modal(page)).toContainText("Step 3 of 6");
  await page.locator('[data-act="guestNo"]').first().click();
  await expect(page.locator('input[name="gFirst"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(modal(page)).toContainText("Step 4 of 6");
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

test("9. the host door registers and then shows what is owed", async ({ page }) => {
  await page.locator('#gala-content [data-act="pickHost"]').first().click();
  await expect(modal(page)).toContainText("Step 1 of 6");

  const stamp = Date.now();
  await page.locator('input[name="tableName"]').fill(`PW Table ${stamp}`);
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(modal(page)).toContainText("Step 2 of 6");
  await page.locator('input[name="first"]').fill("Playwright");
  await page.locator('input[name="last"]').fill("Host");
  await page.locator('input[name="mobile"]').fill("214-555-0177");
  await page.locator('input[name="email"]').fill(`pwhost+${stamp}@everestcollective.com`);
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(modal(page)).toContainText("Step 3 of 6");
  await page.locator('input[name="line"]').fill("Why the family firm still argues about 1998");
  await page.getByRole("button", { name: "Continue" }).click();

  // Roster is step 4 and is skippable, but fill two rows: one complete,
  // one name-only. Both should reach the API, and a partial row is a
  // real case since hosts often know a name before an address.
  await expect(modal(page)).toContainText("Step 4 of 6");
  await page.locator('input[name="rosterName0"]').fill(`Alpha ${stamp}`);
  await page.locator('input[name="rosterEmail0"]').fill(`pwalpha+${stamp}@everestcollective.com`);
  await page.locator('input[name="rosterName1"]').fill(`Beta ${stamp}`);
  // No assertion on "n of 9 named" here: it reads from form, which only
  // updates on Continue, so it stays at 0 while you type. The modal is
  // one innerHTML blob, so re-rendering per keystroke would eat the
  // cursor. The count is stale by design, not broken.
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(modal(page)).toContainText("Step 5 of 6");
  await page.getByRole("button", { name: "Complete registration" }).click();

  // Registering moves to pay and shows the price the SERVER set. A
  // hardcoded number in the wizard would not survive a price change
  // in gala_settings; this would catch that.
  await expect(modal(page)).toContainText("Step 6 of 6", { timeout: 15000 });
  // Scoped to the pay panel on purpose. Asserting against the whole
  // modal matched the hardcoded price in the table step, so this
  // passed for a week while payAmount rendered empty.
  await expect(modal(page)).toContainText("Payment");
  await expect(page.locator("[data-pay-panel]")).toContainText("$2,500");

  // And finishing lands on the confirmation with a real reference.
  await page.getByRole("button", { name: "Done for now" }).click();
  await expect(modal(page)).toContainText(/TCG-[A-Z0-9]{6}/);

  // The host leaves with the one code their guests will use. Scoped to
  // the box, because COLLECTIVE- also appears in the code step's help
  // text elsewhere in the modal.
  await expect(page.locator("[data-host-code]")).toContainText(/COLLECTIVE-[A-Z0-9-]+/);
});

test("10. the sponsor door carries the chosen tier's price into pay", async ({ page }) => {
  await page.locator('#gala-content [data-act="pickSponsor"]').first().click();

  // Bronze is last, and cheap enough that the number on the pay screen
  // is unambiguous about which tier was carried through.
  await page.locator('[data-act^="tier:"]').last().click();
  await page.getByRole("button", { name: "Continue" }).click();

  const stamp = Date.now();
  await expect(modal(page)).toContainText("Step 2 of 7");
  await page.locator('input[name="coLegal"]').fill(`PW Holdings ${stamp} LLC`);
  // coRecog is required too: the legal name is for the invoice, this is
  // the name that goes on the wall.
  await page.locator('input[name="coRecog"]').fill(`PW Holdings ${stamp}`);
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(modal(page)).toContainText("Step 3 of 7");
  await page.locator('input[name="first"]').fill("Playwright");
  await page.locator('input[name="last"]').fill("Sponsor");
  await page.locator('input[name="mobile"]').fill("214-555-0188");
  await page.locator('input[name="email"]').fill(`pwsponsor+${stamp}@everestcollective.com`);
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(modal(page)).toContainText("Step 4 of 7");
  await page.locator('input[name="line"]').fill("What a family holding company learned the hard way");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(modal(page)).toContainText("Step 5 of 7");
  await page.getByRole("button", { name: "Continue" }).click();

  // Review shows the tier they picked, not the first one in the list.
  await expect(modal(page)).toContainText("Step 6 of 7");
  await expect(modal(page)).toContainText("Bronze Sponsor");
  await page.getByRole("button", { name: "Complete registration" }).click();

  await expect(modal(page)).toContainText("Step 7 of 7", { timeout: 15000 });
  await expect(page.locator("[data-pay-panel]")).toContainText("Sponsorship");
  await expect(page.locator("[data-pay-panel]")).toContainText("$1,000");

  await page.getByRole("button", { name: "Done for now" }).click();
  await expect(modal(page)).toContainText(/TCG-[A-Z0-9]{6}/);
});

test("11. the seat door sends the plus-one as its own person", async ({ page }) => {
  await page.locator('#gala-content [data-act="pickSeat"]').first().click();

  // Two seats, so the guest step asks for a real second person.
  await expect(modal(page)).toContainText("Step 1 of 6");
  await page.locator('[data-act="setTwo"]').first().click();
  await page.getByRole("button", { name: "Continue" }).click();

  const stamp = Date.now();
  await expect(modal(page)).toContainText("Step 2 of 6");
  await page.locator('input[name="first"]').fill("Playwright");
  await page.locator('input[name="last"]').fill("Seat");
  await page.locator('input[name="mobile"]').fill("214-555-0155");
  await page.locator('input[name="email"]').fill(`pwseat+${stamp}@everestcollective.com`);
  await page.getByRole("button", { name: "Continue" }).click();

  // The plus-one has their own mobile and their own email on purpose.
  await expect(modal(page)).toContainText("Step 3 of 6");
  // The guest fields only appear once they say there is a guest.
  await page.locator('[data-act="guestYes"]').first().click();
  await page.locator('input[name="gFirst"]').fill("Plus");
  await page.locator('input[name="gLast"]').fill("One");
  await page.locator('input[name="gMobile"]').fill("214-555-0144");
  await page.locator('input[name="gEmail"]').fill(`pwplus+${stamp}@everestcollective.com`);
  // Their line, not the registrant's. The API refuses without it.
  await page.locator('input[name="gLine"]').fill("Coaching a team through its first losing season");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(modal(page)).toContainText("Step 4 of 6");
  await page.locator('input[name="line"]').fill("Buying the building the business rents");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(modal(page)).toContainText("Step 5 of 6");
  await page.getByRole("button", { name: "Complete registration" }).click();

  await expect(modal(page)).toContainText("Step 6 of 6", { timeout: 15000 });
  await expect(page.locator("[data-pay-panel]")).toContainText("Seats");

  await page.getByRole("button", { name: "Done for now" }).click();
  await expect(modal(page)).toContainText(/TCG-[A-Z0-9]{6}/);
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
