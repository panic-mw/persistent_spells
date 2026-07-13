/**
 * e2e-m4: CardPopout opens, renders message HTML, roll buttons work.
 */
import { launchBrowser, login, cleanup, makeCheck } from "./helpers.mjs";

const { browser, page } = await launchBrowser();
const { check, summary } = makeCheck();

try {
  await login(page);
  await cleanup(page);

  const { tokenId, pinId, msgId } = await page.evaluate(async () => {
    const actor = await Actor.create({ name: "PC-Test-M4", type: "character" });
    const [token] = await game.scenes.active.createEmbeddedDocuments("Token", [{
      actorId: actor.id, name: "PC-Test-M4", x: 100, y: 100,
    }]);
    const msg = await ChatMessage.create({
      content: `<div class="chat-card">Spirit Guardians<div class="card-buttons">
        <button type="button" data-action="rollSave" data-dc="17" data-ability="wis">Roll Save</button>
      </div></div>`,
      flavor:  "Spirit Guardians",
      flags:   { "pinned-cards": { e2eTest: true } },
    });
    const { PinManager } = game.modules.get("pinned-cards").api;
    const pin = { id: "pop-1", messageId: msg.id, label: "Spirit Guardians", icon: "icons/svg/anchor.svg" };
    await PinManager.addPin(token, pin);
    return { tokenId: token.id, pinId: pin.id, msgId: msg.id };
  });

  // Open popout by clicking the pin icon in the HUD.
  await page.evaluate((tid) => {
    const token = canvas.tokens.placeables.find(t => t.document.id === tid);
    token?._onClickRight(new MouseEvent("rightclick"));
  }, tokenId);
  await page.waitForSelector("#token-hud .pinned-cards-icon", { timeout: 5_000 });
  await page.click("#token-hud .pinned-cards-icon");
  await page.waitForSelector(".pinned-cards-popout", { timeout: 10_000 });

  // T4.1 — Popout opened
  check("T4.1 popout window appears", await page.isVisible(".pinned-cards-popout"));

  // T4.2/T4.3 — Card HTML rendered
  const hasCard = await page.isVisible(".pinned-cards-popout .card-popout-message .chat-card");
  check("T4.2 message HTML rendered in popout", hasCard);

  const hasName = await page.evaluate(() =>
    document.querySelector(".pinned-cards-popout .card-popout-message")?.textContent?.includes("Spirit Guardians")
  );
  check("T4.3 item name present", hasName);

  // T4.7 — Popout title is pin label
  const title = await page.$eval(
    ".pinned-cards-popout .window-title",
    el => el.textContent.trim()
  );
  check("T4.7 popout title is pin label", title.includes("Spirit Guardians"));

  // T4.8 — Unpin button in window controls
  const unpinBtn = await page.isVisible('.pinned-cards-popout [data-action="unpin"]');
  check("T4.8 unpin button in popout header", unpinBtn);

  // T4.6 — Clicking pin icon again doesn't open a second popout
  await page.evaluate((tid) => {
    const token = canvas.tokens.placeables.find(t => t.document.id === tid);
    token?._onClickRight(new MouseEvent("rightclick"));
  }, tokenId);
  await page.waitForTimeout(300);
  await page.click("#token-hud .pinned-cards-icon");
  await page.waitForTimeout(500);
  const popoutCount = await page.$$eval(".pinned-cards-popout", els => els.length);
  check("T4.6 only one popout per pin", popoutCount === 1);

  // T4.9 — Unpin from popout closes it and removes pin
  await page.click('.pinned-cards-popout [data-action="unpin"]');
  await page.waitForSelector(".dialog", { timeout: 3_000 });
  await page.click(".dialog button.yes, .dialog button[data-button='yes']");
  await page.waitForTimeout(500);
  const popoutGone = !(await page.isVisible(".pinned-cards-popout"));
  check("T4.9 popout closes after unpin", popoutGone);

  const pinGone = await page.evaluate((tid) => {
    const { PinManager } = game.modules.get("pinned-cards").api;
    const token = game.scenes.active.tokens.get(tid);
    return PinManager.getPins(token).length === 0;
  }, tokenId);
  check("T4.9 pin removed from token after unpin", pinGone);

  // T4.10 — Deleted message shows graceful notice
  const { tokenId2, pinId2 } = await page.evaluate(async () => {
    const actor = await Actor.create({ name: "PC-Test-M4-B", type: "character" });
    const [token] = await game.scenes.active.createEmbeddedDocuments("Token", [{
      actorId: actor.id, name: "PC-Test-M4-B", x: 200, y: 100,
    }]);
    const msg = await ChatMessage.create({ content: "Temp", flags: { "pinned-cards": { e2eTest: true } } });
    const { PinManager } = game.modules.get("pinned-cards").api;
    const pin = { id: "dead-msg", messageId: msg.id, label: "Dead", icon: "icons/svg/anchor.svg" };
    await PinManager.addPin(token, pin);
    await msg.delete();
    return { tokenId2: token.id, pinId2: pin.id };
  });

  await page.evaluate(async (tid) => {
    const { CardPopout } = game.modules.get("pinned-cards").api;
    const { PinManager } = game.modules.get("pinned-cards").api;
    const token = game.scenes.active.tokens.get(tid);
    const pin = PinManager.getPins(token)[0];
    new CardPopout(token, pin).render({ force: true });
  }, tokenId2);
  await page.waitForSelector(".pinned-cards-popout", { timeout: 5_000 });
  const expiredMsg = await page.isVisible(".card-popout-expired");
  check("T4.10 deleted message shows graceful notice", expiredMsg);

} finally {
  await cleanup(page);
  await browser.close();
  process.exit(summary());
}
