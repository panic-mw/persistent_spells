/**
 * Pure logic for custom pinnable conditions — no Foundry globals.
 * Builds the data shape that the chat card renderer and popout will consume.
 */

const VALID_ABILITIES = new Set(["str", "dex", "con", "int", "wis", "cha"]);

const VALID_DAMAGE_TYPES = new Set([
  "acid", "bludgeoning", "cold", "fire", "force", "lightning",
  "necrotic", "piercing", "poison", "psychic", "radiant", "slashing", "thunder",
]);

/**
 * @typedef {Object} ConditionSpec
 * @property {string} label
 * @property {string} [icon]
 * @property {{ dc: number, ability: string }} [save]
 * @property {{ formula: string, type: string, perTurn?: boolean }} [damage]
 */

/**
 * @typedef {Object} ConditionCard
 * @property {string} label        — display label (may include "per turn" suffix)
 * @property {string} icon
 * @property {Array}  buttons      — roll button descriptors for rendering
 * @property {Object} flags        — to merge into ChatMessage flags
 */

/**
 * Validate a condition spec. Returns { ok, error? }.
 */
export function validateConditionSpec(spec) {
  if (!spec || typeof spec !== "object") return { ok: false, error: "spec must be an object" };
  if (typeof spec.label !== "string" || !spec.label.trim()) {
    return { ok: false, error: "label required" };
  }

  if (spec.save !== undefined) {
    const { dc, ability } = spec.save ?? {};
    if (!Number.isInteger(dc) || dc < 1 || dc > 30) {
      return { ok: false, error: "save.dc must be an integer between 1 and 30" };
    }
    if (typeof ability !== "string" || !VALID_ABILITIES.has(ability.toLowerCase())) {
      return { ok: false, error: `save.ability must be one of: ${[...VALID_ABILITIES].join(", ")}` };
    }
  }

  if (spec.damage !== undefined) {
    const { formula, type } = spec.damage ?? {};
    if (typeof formula !== "string" || !formula.trim()) {
      return { ok: false, error: "damage.formula required" };
    }
    if (typeof type !== "string" || !VALID_DAMAGE_TYPES.has(type.toLowerCase())) {
      return { ok: false, error: `damage.type must be a valid 5e damage type` };
    }
  }

  return { ok: true };
}

/**
 * Build a condition card data object from a validated spec.
 * Throws if the spec is invalid.
 */
export function buildConditionCard(spec) {
  const validation = validateConditionSpec(spec);
  if (!validation.ok) throw new Error(validation.error);

  const buttons = [];

  if (spec.save) {
    const ability = spec.save.ability.toLowerCase();
    const abilityLabel = ability.toUpperCase();
    buttons.push({
      action: "rollSave",
      label: `Roll Save (DC ${spec.save.dc} ${abilityLabel})`,
      dataset: { dc: spec.save.dc, ability },
    });
  }

  if (spec.damage) {
    const typeLabel = spec.damage.type.charAt(0).toUpperCase() + spec.damage.type.slice(1);
    const perTurnNote = spec.damage.perTurn ? " per turn" : "";
    buttons.push({
      action: "rollDamage",
      label: `Roll Damage (${spec.damage.formula} ${typeLabel}${perTurnNote})`,
      dataset: { formula: spec.damage.formula, damageType: spec.damage.type },
    });
  }

  let label = spec.label.trim();
  if (spec.damage?.perTurn) {
    label = `${label} (${spec.damage.formula} ${spec.damage.type} per turn)`;
  }

  return {
    label,
    icon: spec.icon ?? "icons/svg/anchor.svg",
    buttons,
    flags: { "pinned-cards": { customCondition: true } },
  };
}
