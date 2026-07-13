/**
 * Pure pin-array operations — no Foundry globals.
 * Foundry-aware wrapper lives in pin-manager.mjs.
 */

const REQUIRED_STRING_FIELDS = ["id", "messageId", "label", "icon"];

export function validatePin(pin) {
  if (!pin || typeof pin !== "object" || Array.isArray(pin)) {
    return { ok: false, error: "pin must be an object" };
  }
  for (const field of REQUIRED_STRING_FIELDS) {
    if (typeof pin[field] !== "string" || !pin[field]) {
      return { ok: false, error: `${field} required` };
    }
  }
  return { ok: true };
}

/** Append a pin, skipping if one with the same id already exists. */
export function addPin(pins, pin) {
  if (pins.some(p => p.id === pin.id)) return pins;
  return [...pins, pin];
}

/** Remove the pin with the given id. Returns unchanged array if not found. */
export function removePin(pins, id) {
  return pins.filter(p => p.id !== id);
}

/**
 * Return pins matching all key/value pairs in filter.
 * Called with no filter (or {}) returns all pins.
 */
export function getPins(pins, filter = {}) {
  const entries = Object.entries(filter);
  if (entries.length === 0) return pins;
  return pins.filter(p => entries.every(([k, v]) => p[k] === v));
}
