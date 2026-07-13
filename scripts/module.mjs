import { PinManager }             from "./models/pin-manager.mjs";
import { CardPopout }             from "./apps/card-popout.mjs";
import { CustomConditionDialog }  from "./apps/custom-condition-dialog.mjs";
import { PinHotbar }              from "./apps/pin-hotbar.mjs";
import { registerChatCardHook }   from "./hooks/chat-card.mjs";
import { registerTokenHudHook }   from "./hooks/token-hud.mjs";
import { registerConcentrationHooks } from "./hooks/concentration.mjs";

Hooks.once("init", () => {
  // Placeholder for future settings registration.
});

Hooks.once("ready", () => {
  registerChatCardHook();
  registerTokenHudHook();
  registerConcentrationHooks();

  // Mount the GM hotbar strip above #hotbar.
  PinHotbar.mount();

  // Keep the hotbar live as scene/token state changes.
  Hooks.on("canvasReady", () => PinHotbar.render());
  Hooks.on("createToken", () => PinHotbar.render());
  Hooks.on("deleteToken", () => PinHotbar.render());
  Hooks.on("updateToken",  (_scene, _token, diff) => {
    // Only re-render if pinned-cards flags changed.
    if (foundry.utils.hasProperty(diff, "flags.pinned-cards")) PinHotbar.render();
  });
});

// Expose public API.
Hooks.once("ready", () => {
  const mod = game.modules.get("pinned-cards");
  if (mod) mod.api = { PinManager, CardPopout, CustomConditionDialog, PinHotbar };
});
