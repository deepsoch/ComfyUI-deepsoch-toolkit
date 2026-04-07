// DeepSoch Toolkit — adds an "About / Contact" entry to the right-click
// menu of every node in the toolkit.
//
// Keeps branding discoverable without taking up canvas space.

import { app } from "../../scripts/app.js";

const COMPANY = "Deepsoch AI Private Limited";
const EMAIL = "deepsoch.ai@gmail.com";
const WEBSITE = "https://deepsoch.com";
const REPO = "https://github.com/deepsoch/ComfyUI-deepsoch-toolkit";

const TOOLKIT_NODE_PREFIX = "DeepSoch";

function showAbout() {
    const msg =
        `${COMPANY}\n\n` +
        `Developer: Karim Khan\n` +
        `Contact: ${EMAIL}\n` +
        `Website: ${WEBSITE}\n` +
        `Repository: ${REPO}\n\n` +
        `Click OK to open your email client.`;
    if (window.confirm(msg)) {
        window.location.href = `mailto:${EMAIL}?subject=ComfyUI%20DeepSoch%20Toolkit`;
    }
}

app.registerExtension({
    name: "deepsoch.toolkit.About",

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (!nodeData.name?.startsWith(TOOLKIT_NODE_PREFIX)) return;

        const orig = nodeType.prototype.getExtraMenuOptions;
        nodeType.prototype.getExtraMenuOptions = function (_, options) {
            orig?.apply(this, arguments);
            options.push(null); // separator
            options.push({
                content: `About ${COMPANY}`,
                callback: showAbout,
            });
            options.push({
                content: `Contact: ${EMAIL}`,
                callback: () => {
                    window.location.href = `mailto:${EMAIL}?subject=ComfyUI%20DeepSoch%20Toolkit`;
                },
            });
            options.push({
                content: `Visit ${WEBSITE}`,
                callback: () => window.open(WEBSITE, "_blank"),
            });
        };
    },
});
