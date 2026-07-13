import { buildConditionCard, validateConditionSpec } from "../models/condition-logic.mjs";
import { PinManager }                               from "../models/pin-manager.mjs";

const DND5E_ABILITIES  = ["str", "dex", "con", "int", "wis", "cha"];
const DND5E_DMG_TYPES  = [
  "acid","bludgeoning","cold","fire","force","lightning",
  "necrotic","piercing","poison","psychic","radiant","slashing","thunder",
];

// dnd5e SVG status icons bundled with the system.
const STATUS_ICONS = [
  "blinded","charmed","concentrating","cursed","deafened","diseased",
  "exhaustion-1","exhaustion-2","exhaustion-3","exhaustion-4","exhaustion-5","exhaustion-6",
  "frightened","grappled","incapacitated","invisible","marked","paralyzed",
  "petrified","poisoned","prone","restrained","stunned","unconscious",
].map(id => ({
  id,
  path: `systems/dnd5e/icons/svg/statuses/${id}.svg`,
}));

export class CustomConditionDialog extends Dialog {
  /**
   * Show the dialog and return the submitted spec, or null if cancelled.
   * After submission it also creates the ChatMessage and pins it to the token.
   * @param {TokenDocument} tokenDoc
   */
  static async prompt(tokenDoc) {
    return new Promise((resolve) => {
      const abilityOptions = DND5E_ABILITIES
        .map(a => `<option value="${a}">${a.toUpperCase()}</option>`)
        .join("");

      const dmgTypeOptions = DND5E_DMG_TYPES
        .map(t => `<option value="${t}">${t.charAt(0).toUpperCase() + t.slice(1)}</option>`)
        .join("");

      const iconOptions = STATUS_ICONS
        .map(({ id, path }) => `<option value="${path}">${id}</option>`)
        .join("");

      const content = `
<form class="pinned-cards-custom-form">
  <div class="form-group">
    <label>Label <span class="req">*</span></label>
    <input type="text" name="label" placeholder="e.g. Hexblade's Curse" required />
  </div>

  <div class="form-group">
    <label>Icon</label>
    <select name="iconPreset">${iconOptions}</select>
    <input type="text" name="iconUrl" placeholder="or custom URL" />
  </div>

  <fieldset>
    <legend>Saving Throw (optional)</legend>
    <div class="form-group">
      <label>Ability</label>
      <select name="saveAbility"><option value="">— none —</option>${abilityOptions}</select>
    </div>
    <div class="form-group">
      <label>DC</label>
      <input type="number" name="saveDc" min="1" max="30" placeholder="e.g. 15" />
    </div>
  </fieldset>

  <fieldset>
    <legend>Damage (optional)</legend>
    <div class="form-group">
      <label>Formula</label>
      <input type="text" name="dmgFormula" placeholder="e.g. 1d6" />
    </div>
    <div class="form-group">
      <label>Type</label>
      <select name="dmgType"><option value="">— none —</option>${dmgTypeOptions}</select>
    </div>
    <div class="form-group">
      <label>Per Turn?</label>
      <input type="checkbox" name="perTurn" />
    </div>
  </fieldset>
</form>`;

      new CustomConditionDialog({
        title:   game.i18n.localize("PINNEDCARDS.NewCustomCondition"),
        content,
        buttons: {
          add: {
            icon:     '<i class="fa-solid fa-circle-plus"></i>',
            label:    "Add Condition",
            callback: async (html) => {
              const spec = CustomConditionDialog.#parseForm(html[0] ?? html);
              if (!spec) return resolve(null);

              const validation = validateConditionSpec(spec);
              if (!validation.ok) {
                ui.notifications.error(validation.error);
                return resolve(null);
              }

              try {
                const card = buildConditionCard(spec);
                await CustomConditionDialog.#createAndPin(card, spec, tokenDoc);
                resolve(spec);
              } catch (err) {
                ui.notifications.error(err.message);
                resolve(null);
              }
            },
          },
          cancel: {
            label:    "Cancel",
            callback: () => resolve(null),
          },
        },
        default: "add",
        close:   () => resolve(null),
      }).render(true);
    });
  }

  static #parseForm(html) {
    const label      = html.querySelector('[name="label"]')?.value?.trim();
    const iconUrl    = html.querySelector('[name="iconUrl"]')?.value?.trim();
    const iconPreset = html.querySelector('[name="iconPreset"]')?.value;
    const saveAbil   = html.querySelector('[name="saveAbility"]')?.value;
    const saveDcRaw  = html.querySelector('[name="saveDc"]')?.value;
    const dmgFormula = html.querySelector('[name="dmgFormula"]')?.value?.trim();
    const dmgType    = html.querySelector('[name="dmgType"]')?.value;
    const perTurn    = html.querySelector('[name="perTurn"]')?.checked ?? false;

    const spec = {
      label,
      icon: iconUrl || iconPreset,
    };

    if (saveAbil && saveDcRaw) {
      const dc = parseInt(saveDcRaw, 10);
      if (!isNaN(dc)) spec.save = { dc, ability: saveAbil };
    }

    if (dmgFormula && dmgType) {
      spec.damage = { formula: dmgFormula, type: dmgType, perTurn };
    }

    return spec;
  }

  static async #createAndPin(card, spec, tokenDoc) {
    // Build button HTML for the chat card.
    const buttonsHtml = card.buttons.map(btn => {
      const dataAttrs = Object.entries(btn.dataset)
        .map(([k, v]) => `data-${k.replace(/([A-Z])/g, '-$1').toLowerCase()}="${v}"`)
        .join(" ");
      return `<button type="button" data-action="${btn.action}" ${dataAttrs}>${btn.label}</button>`;
    }).join("\n");

    const content = `
<div class="chat-card pinned-cards-custom-card">
  <header class="card-header">
    <img src="${card.icon}" title="${card.label}" />
    <h3>${card.label}</h3>
  </header>
  ${buttonsHtml ? `<div class="card-buttons">${buttonsHtml}</div>` : ""}
</div>`;

    const message = await ChatMessage.create({
      content,
      flavor: card.label,
      flags:  card.flags,
    });

    if (!message) throw new Error("Failed to create condition chat message.");

    const pin = {
      id:        foundry.utils.randomID(),
      messageId: message.id,
      label:     card.label,
      icon:      card.icon,
    };

    await PinManager.addPin(tokenDoc, pin);
    canvas.hud?.token?.render();
  }
}
