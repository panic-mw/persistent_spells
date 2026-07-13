/**
 * One-shot setup script: enable pinned-cards in rl-combat, create a test
 * character with Spirit Guardians, post a spell card to chat.
 *
 * NOTE: enabling the module triggers a world reload — the RL bridge will
 * disconnect. Restart it after this script completes.
 */
import { chromium } from "playwright";

const BASE    = "http://localhost:30000";
const WORLD   = "rl-combat";
const log     = (...a) => console.log("[setup]", ...a);

const browser = await chromium.launch({ headless: true });
const ctx     = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page    = await ctx.newPage();

page.on("pageerror", e => console.error("[pageerror]", e.message));

// ── 1. Join the world ────────────────────────────────────────────────────────
log("navigating to join page...");
await page.goto(`${BASE}/join`, { waitUntil: "networkidle" });

// Select Gamemaster user.
try {
  await page.locator('select[name="userid"]').selectOption({ label: "Gamemaster" }, { timeout: 5000 });
} catch {
  const inp = page.locator('input[name="userid"]');
  if (await inp.isVisible({ timeout: 2000 })) await inp.fill("Gamemaster");
}
await page.locator('button[name="join"], button[type="submit"]').first().click();
await page.waitForFunction(() => window.game?.ready === true, { timeout: 60_000 });
log("joined world:", WORLD);

// ── 2. Enable pinned-cards module ────────────────────────────────────────────
log("enabling pinned-cards module...");
const alreadyEnabled = await page.evaluate(() =>
  game.modules.get("pinned-cards")?.active === true
);

if (!alreadyEnabled) {
  // Update core.moduleConfiguration and request reload.
  await page.evaluate(async () => {
    const config = game.settings.get("core", "moduleConfiguration") ?? {};
    config["pinned-cards"] = true;
    await game.settings.set("core", "moduleConfiguration", config);
  });

  // Wait for the world to reload (all clients get a reload request).
  log("waiting for world reload after module enable...");
  await page.waitForNavigation({ timeout: 30_000 }).catch(() => {});
  await page.waitForURL(/\/(join|game)/, { timeout: 20_000 }).catch(() => {});

  // If we landed back on join, re-join.
  if (page.url().includes("/join") || !page.url().includes("/game")) {
    try {
      await page.locator('select[name="userid"]').selectOption({ label: "Gamemaster" }, { timeout: 5000 });
    } catch { /* text input fallback */ }
    await page.locator('button[name="join"], button[type="submit"]').first().click();
  }
  await page.waitForFunction(() => window.game?.ready === true, { timeout: 60_000 });
  log("world reloaded, pinned-cards now active:", await page.evaluate(() =>
    game.modules.get("pinned-cards")?.active
  ));
} else {
  log("pinned-cards already active");
}

// ── 3. Create test character with Spirit Guardians ───────────────────────────
log("creating test character...");
const { actorId, itemId } = await page.evaluate(async () => {
  // Remove any leftover test actor.
  const old = game.actors.getName("Seraphina (Test)");
  if (old) await old.delete();

  const actor = await Actor.create({
    name:   "Seraphina (Test)",
    type:   "character",
    system: {
      abilities: {
        wis: { value: 18 },
        con: { value: 14 },
      },
      attributes: { hp: { value: 42, max: 42 } },
    },
    img: "systems/dnd5e/tokens/humanoid/acolyte.webp",
  });

  // Add Spirit Guardians (concentration AoE spell).
  const [item] = await actor.createEmbeddedDocuments("Item", [{
    name:   "Spirit Guardians",
    type:   "spell",
    img:    "systems/dnd5e/icons/spells/light-air-fire-1.jpg",
    system: {
      description: { value: "<p>You call forth spirits to protect you. They flit around you to a distance of 15 feet for the duration. If you are good or neutral, their spectral form appears angelic or fey (your choice). If you are evil, they appear fiendish.</p><p>When you cast this spell, you can designate any number of creatures you can see to be unaffected by it. An affected creature's speed is halved in the area, and when the creature enters the area for the first time on a turn or starts its turn there, it must make a Wisdom saving throw. On a failed save, the creature takes 3d8 radiant damage (if you are good or neutral) or 3d8 necrotic damage (if you are evil). On a successful save, the creature takes half as much damage.</p>" },
      source:        { book: "PHB", page: "278" },
      level:         3,
      school:        "abj",
      components:    { vocal: true, somatic: true, material: true },
      materials:     { value: "holy water or powdered silver and iron worth at least 100 gp" },
      preparation:   { mode: "always", prepared: true },
      duration:      { value: "10", units: "minute" },
      target:        { value: 15, units: "ft", type: "radius" },
      range:         { value: null, units: "self" },
      save:          { ability: "wis", dc: 17, scaling: "spell" },
      damage:        { parts: [["3d8", "radiant"]], versatile: "" },
      concentration: true,
    },
  }]);

  return { actorId: actor.id, itemId: item.id };
});
log("created actor:", actorId, "with Spirit Guardians:", itemId);

// ── 4. Post a Spirit Guardians chat card ─────────────────────────────────────
log("posting spell card to chat...");
await page.evaluate(async ({ actorId, itemId }) => {
  const actor = game.actors.get(actorId);
  const item  = actor.items.get(itemId);

  // Display the item card in chat (no resource consumption).
  await item.displayCard({ rollMode: "publicroll" });
}, { actorId, itemId });

await page.waitForTimeout(1500);
log("spell card posted to chat");

// ── 5. Place the actor's token on the active scene ───────────────────────────
log("placing token on scene...");
const tokenPlaced = await page.evaluate(async (actorId) => {
  const scene = game.scenes.active;
  if (!scene) return false;
  const actor = game.actors.get(actorId);
  await scene.createEmbeddedDocuments("Token", [{
    actorId: actor.id,
    name:    actor.name,
    x:       500,
    y:       300,
    img:     actor.img,
  }]);
  return true;
}, actorId);
log("token placed:", tokenPlaced);

log("\n✓ Setup complete.");
log("  Address:   http://localhost:30000");
log("  Character: Seraphina (Test)");
log("  Spell:     Spirit Guardians (DC 17 WIS, 3d8 radiant, concentration)");
log("  A spell card is in the chat log — click the 📌 Pin button to pin it to Seraphina's token.\n");

await browser.close();
