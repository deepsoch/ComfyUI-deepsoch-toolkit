// DeepSoch Toolkit — Prompt Preset frontend helper.
//
// When the user flips the `select_all` toggle, mirror its value onto every
// other preset toggle in the same node so the UI visibly reflects the
// "all on / all off" state.

import { app } from "../../scripts/app.js";

const NODE_NAME = "DeepSochPromptPreset";
const MASTER = "select_all";
const SKIP = new Set([MASTER, "custom_prompt"]);

function isPresetToggle(widget) {
    if (!widget || SKIP.has(widget.name)) return false;
    // ComfyUI renders BOOLEAN inputs as widgets of type "toggle".
    return widget.type === "toggle" || widget.type === "BOOLEAN";
}

app.registerExtension({
    name: "deepsoch.toolkit.PromptPreset",

    async nodeCreated(node) {
        if (node.comfyClass !== NODE_NAME) return;

        const master = node.widgets?.find((w) => w.name === MASTER);
        if (!master) return;

        const presetToggles = node.widgets.filter(isPresetToggle);
        const originalCallback = master.callback;

        master.callback = function (value) {
            for (const w of presetToggles) {
                w.value = value;
                // Fire each toggle's own callback so any downstream listeners
                // (and the graph dirty state) stay consistent.
                if (typeof w.callback === "function") {
                    try {
                        w.callback(value);
                    } catch (err) {
                        console.warn("[deepsoch-toolkit] toggle callback error:", err);
                    }
                }
            }
            node.setDirtyCanvas(true, true);
            if (typeof originalCallback === "function") {
                return originalCallback.apply(this, arguments);
            }
        };
    },
});
