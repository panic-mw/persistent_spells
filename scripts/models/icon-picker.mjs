/**
 * Shared icon list and picker dialog.
 * Used by chat-card.mjs (at pin time), token-hud.mjs (change icon), and
 * custom-condition-dialog.mjs.
 */

export const STATUS_ICONS = [
  "blinded","burning","charmed","concentrating","cursed","deafened","dead",
  "diseased","dodging","ethereal","exhaustion-1","exhaustion-2","exhaustion-3",
  "exhaustion-4","exhaustion-5","exhaustion-6","falling","flying","frightened",
  "grappled","hiding","hovering","incapacitated","invisible","malnutrition",
  "marked","paralyzed","petrified","poisoned","prone","restrained","silenced",
  "sleeping","stable","stunned","suffocation","surprised","transformed","unconscious",
].map(id => ({ id, path: `systems/dnd5e/icons/svg/statuses/${id}.svg` }));

/**
 * Show a small dialog to pick an icon from the dnd5e status SVGs.
 * @param {string} [defaultIcon]  Pre-select this icon path (or closest match).
 * @param {string} [title]        Dialog title.
 * @returns {Promise<string|null>} Chosen icon path, or null if cancelled.
 */
export function pickIcon(defaultIcon = "", title = "Choose Icon") {
  return new Promise((resolve) => {
    const options = STATUS_ICONS.map(({ id, path }) => {
      const selected = defaultIcon === path ? "selected" : "";
      return `<option value="${path}" ${selected}>${id}</option>`;
    }).join("");

    // Determine if defaultIcon is a custom URL (not in our list).
    const isCustom = defaultIcon && !STATUS_ICONS.some(i => i.path === defaultIcon);

    const content = `
<form class="pinned-cards-icon-pick-form">
  <div class="form-group">
    <label>Status icon</label>
    <div style="display:flex;gap:8px;align-items:center">
      <img id="pc-icon-preview" src="${defaultIcon || STATUS_ICONS[0].path}"
           style="width:36px;height:36px;border:1px solid #555;border-radius:4px" />
      <select id="pc-icon-select" style="flex:1">${options}</select>
    </div>
  </div>
  <div class="form-group">
    <label>Custom image URL (optional)</label>
    <input id="pc-icon-url" type="text" placeholder="https://... or icons/..."
           value="${isCustom ? defaultIcon : ""}" style="width:100%" />
  </div>
</form>
<script>
  (function() {
    const sel = document.getElementById("pc-icon-select");
    const url = document.getElementById("pc-icon-url");
    const img = document.getElementById("pc-icon-preview");
    const update = () => { img.src = url.value.trim() || sel.value; };
    sel.addEventListener("change", () => { url.value = ""; update(); });
    url.addEventListener("input", update);
  })();
</script>`;

    new Dialog({
      title,
      content,
      buttons: {
        ok: {
          icon:     '<i class="fa-solid fa-check"></i>',
          label:    "Use this icon",
          callback: (html) => {
            const url = html.querySelector("#pc-icon-url")?.value?.trim();
            const sel = html.querySelector("#pc-icon-select")?.value;
            resolve(url || sel || defaultIcon || STATUS_ICONS[0].path);
          },
        },
        cancel: { label: "Cancel", callback: () => resolve(null) },
      },
      default: "ok",
      close: () => resolve(null),
    }).render(true);
  });
}
