import { test } from "node:test";
import assert from "node:assert/strict";
import { addPin, removePin, getPins, validatePin } from "../../scripts/models/pin-logic.mjs";

const mkPin = (overrides = {}) => ({
  id: "pin-001",
  messageId: "msg-abc",
  label: "Spirit Guardians",
  icon: "icons/spells/holy.svg",
  ...overrides,
});

// ── validatePin ──────────────────────────────────────────────────────────────

test("T0.6 pin schema valid", () => {
  const result = validatePin(mkPin());
  assert.deepEqual(result, { ok: true });
});

test("T0.7 pin schema missing id", () => {
  const result = validatePin({ messageId: "msg-abc", label: "Test", icon: "x.svg" });
  assert.equal(result.ok, false);
  assert.match(result.error, /id required/);
});

test("T0.8 pin schema bad messageId (non-string)", () => {
  const result = validatePin(mkPin({ messageId: 123 }));
  assert.equal(result.ok, false);
  assert.match(result.error, /messageId required/);
});

test("pin schema rejects non-object", () => {
  assert.equal(validatePin(null).ok, false);
  assert.equal(validatePin("string").ok, false);
  assert.equal(validatePin([]).ok, false);
});

test("pin schema requires non-empty strings", () => {
  assert.equal(validatePin(mkPin({ label: "" })).ok, false);
  assert.equal(validatePin(mkPin({ icon: "" })).ok, false);
});

// ── addPin ───────────────────────────────────────────────────────────────────

test("T0.1 addPin appends to empty array", () => {
  const pin = mkPin();
  const result = addPin([], pin);
  assert.deepEqual(result, [pin]);
});

test("addPin appends to non-empty array", () => {
  const pinA = mkPin({ id: "a" });
  const pinB = mkPin({ id: "b" });
  const result = addPin([pinA], pinB);
  assert.equal(result.length, 2);
  assert.equal(result[1].id, "b");
});

test("T0.2 addPin deduplicates by id", () => {
  const pin = mkPin();
  const result = addPin([pin], pin);
  assert.equal(result.length, 1);
});

test("addPin does not mutate the original array", () => {
  const original = [];
  addPin(original, mkPin());
  assert.equal(original.length, 0);
});

// ── removePin ────────────────────────────────────────────────────────────────

test("T0.3 removePin removes matching entry", () => {
  const pinA = mkPin({ id: "a" });
  const pinB = mkPin({ id: "b" });
  const result = removePin([pinA, pinB], "a");
  assert.deepEqual(result, [pinB]);
});

test("T0.4 removePin is no-op on missing id", () => {
  const result = removePin([], "missing");
  assert.deepEqual(result, []);
});

test("removePin does not mutate the original array", () => {
  const pins = [mkPin()];
  removePin(pins, "pin-001");
  assert.equal(pins.length, 1);
});

// ── getPins ──────────────────────────────────────────────────────────────────

test("T0.5 getPins filters by auto field", () => {
  const concentration = mkPin({ id: "c", auto: "concentration" });
  const manual = mkPin({ id: "m" });
  const result = getPins([concentration, manual], { auto: "concentration" });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "c");
});

test("getPins with empty filter returns all", () => {
  const pins = [mkPin({ id: "a" }), mkPin({ id: "b" })];
  assert.equal(getPins(pins).length, 2);
  assert.equal(getPins(pins, {}).length, 2);
});

test("getPins filters by multiple fields", () => {
  const pins = [
    mkPin({ id: "a", auto: "concentration", label: "Spirit Guardians" }),
    mkPin({ id: "b", auto: "concentration", label: "Bless" }),
    mkPin({ id: "c", label: "Hex" }),
  ];
  const result = getPins(pins, { auto: "concentration", label: "Bless" });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "b");
});

test("getPins returns empty array when no match", () => {
  const pins = [mkPin({ id: "a" })];
  assert.deepEqual(getPins(pins, { auto: "concentration" }), []);
});
