import { test } from "node:test";
import assert from "node:assert/strict";
import { validateConditionSpec, buildConditionCard } from "../../scripts/models/condition-logic.mjs";

// ── validateConditionSpec ────────────────────────────────────────────────────

test("T0.9 label only is valid", () => {
  assert.deepEqual(validateConditionSpec({ label: "Cursed" }), { ok: true });
});

test("T0.10 save with DC + ability is valid", () => {
  assert.deepEqual(
    validateConditionSpec({ label: "Hold Person", save: { dc: 15, ability: "wis" } }),
    { ok: true }
  );
});

test("T0.11 damage formula is valid", () => {
  assert.deepEqual(
    validateConditionSpec({ label: "Burning", damage: { formula: "1d6", type: "fire" } }),
    { ok: true }
  );
});

test("T0.13 invalid DC (non-integer)", () => {
  const result = validateConditionSpec({ label: "X", save: { dc: "high", ability: "wis" } });
  assert.equal(result.ok, false);
  assert.match(result.error, /dc must be/i);
});

test("T0.14 invalid ability", () => {
  const result = validateConditionSpec({ label: "X", save: { dc: 10, ability: "luck" } });
  assert.equal(result.ok, false);
  assert.match(result.error, /ability must be/i);
});

test("T0.15 both save and damage is valid", () => {
  const result = validateConditionSpec({
    label: "Vampiric Touch",
    save: { dc: 16, ability: "con" },
    damage: { formula: "3d6", type: "necrotic" },
  });
  assert.deepEqual(result, { ok: true });
});

test("missing label is invalid", () => {
  assert.equal(validateConditionSpec({}).ok, false);
  assert.equal(validateConditionSpec({ label: "" }).ok, false);
  assert.equal(validateConditionSpec({ label: "   " }).ok, false);
});

test("DC out of range is invalid", () => {
  assert.equal(validateConditionSpec({ label: "X", save: { dc: 0, ability: "wis" } }).ok, false);
  assert.equal(validateConditionSpec({ label: "X", save: { dc: 31, ability: "str" } }).ok, false);
});

test("invalid damage type is invalid", () => {
  const result = validateConditionSpec({ label: "X", damage: { formula: "1d6", type: "sadness" } });
  assert.equal(result.ok, false);
});

test("missing damage formula is invalid", () => {
  const result = validateConditionSpec({ label: "X", damage: { formula: "", type: "fire" } });
  assert.equal(result.ok, false);
});

// ── buildConditionCard ───────────────────────────────────────────────────────

test("T0.9 label-only card has no buttons", () => {
  const card = buildConditionCard({ label: "Cursed" });
  assert.equal(card.buttons.length, 0);
  assert.equal(card.label, "Cursed");
});

test("T0.10 save card has rollSave button with correct data", () => {
  const card = buildConditionCard({ label: "Hold Person", save: { dc: 15, ability: "wis" } });
  assert.equal(card.buttons.length, 1);
  assert.equal(card.buttons[0].action, "rollSave");
  assert.equal(card.buttons[0].dataset.dc, 15);
  assert.equal(card.buttons[0].dataset.ability, "wis");
});

test("T0.11 damage card has rollDamage button", () => {
  const card = buildConditionCard({ label: "Burning", damage: { formula: "1d6", type: "fire" } });
  assert.equal(card.buttons.length, 1);
  assert.equal(card.buttons[0].action, "rollDamage");
  assert.equal(card.buttons[0].dataset.formula, "1d6");
  assert.equal(card.buttons[0].dataset.damageType, "fire");
});

test("T0.12 perTurn adds suffix to card label", () => {
  const card = buildConditionCard({
    label: "Burning",
    damage: { formula: "1d6", type: "fire", perTurn: true },
  });
  assert.match(card.label, /per turn/);
});

test("T0.15 both save and damage generates two buttons", () => {
  const card = buildConditionCard({
    label: "Vampiric Touch",
    save: { dc: 16, ability: "con" },
    damage: { formula: "3d6", type: "necrotic" },
  });
  assert.equal(card.buttons.length, 2);
  const actions = card.buttons.map(b => b.action);
  assert.ok(actions.includes("rollSave"));
  assert.ok(actions.includes("rollDamage"));
});

test("buildConditionCard throws on invalid spec", () => {
  assert.throws(() => buildConditionCard({}), /label required/);
  assert.throws(
    () => buildConditionCard({ label: "X", save: { dc: "high", ability: "wis" } }),
    /dc must be/i
  );
});

test("customCondition flag is set", () => {
  const card = buildConditionCard({ label: "Test" });
  assert.equal(card.flags["pinned-cards"].customCondition, true);
});

test("default icon is set when none provided", () => {
  const card = buildConditionCard({ label: "Test" });
  assert.equal(card.icon, "icons/svg/anchor.svg");
});

test("provided icon is used", () => {
  const card = buildConditionCard({ label: "Test", icon: "systems/dnd5e/icons/svg/statuses/cursed.svg" });
  assert.equal(card.icon, "systems/dnd5e/icons/svg/statuses/cursed.svg");
});

test("ability is lowercased in dataset", () => {
  const card = buildConditionCard({ label: "X", save: { dc: 12, ability: "STR" } });
  assert.equal(card.buttons[0].dataset.ability, "str");
});

test("all valid abilities are accepted", () => {
  for (const ability of ["str", "dex", "con", "int", "wis", "cha"]) {
    const result = validateConditionSpec({ label: "X", save: { dc: 10, ability } });
    assert.equal(result.ok, true, `ability "${ability}" should be valid`);
  }
});
