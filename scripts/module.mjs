import { PinManager }             from "./models/pin-manager.mjs";
import { CardPopout }             from "./apps/card-popout.mjs";
import { CustomConditionDialog }  from "./apps/custom-condition-dialog.mjs";
import { registerChatCardHook }   from "./hooks/chat-card.mjs";
import { registerTokenHudHook }   from "./hooks/token-hud.mjs";
import { registerConcentrationHooks } from "./hooks/concentration.mjs";

Hooks.once("init", () => {
  // Nothing to register in settings for now; placeholder for future prefs.
});

Hooks.once("ready", () => {
  registerChatCardHook();
  registerTokenHudHook();
  registerConcentrationHooks();
});

// Expose public API so e2e tests and macros can call:
//   game.modules.get("pinned-cards").api.PinManager
Hooks.once("ready", () => {
  const mod = game.modules.get("pinned-cards");
  if (mod) {
    mod.api = { PinManager, CardPopout, CustomConditionDialog };
  }
});
