# ComfyUI DeepSoch Toolkit

A growing collection of custom nodes for ComfyUI.

## Nodes

| Node | Category | Purpose |
|---|---|---|
| **Prompt Preset** | `deepsoch/prompt` | Tick one or more style presets (or `select_all`) and emit them as a prompt list. Each ticked preset runs the downstream chain independently. |
| **Load Images** | `deepsoch/image` | Upload multiple images at once. Native-style multi-preview with grid view, click-to-fullscreen, and counter cycling. Outputs as IMAGE / MASK / filename lists. |
| **Set Node** / **Get Node** | `deepsoch/util` | Wireless reroutes — store a value with a name and retrieve it anywhere in the graph without drawing wires. |

## Install

Clone into your ComfyUI `custom_nodes` directory and restart ComfyUI:

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/deepsoch/ComfyUI-deepsoch-toolkit
```

No extra Python dependencies.

## Presets

Built-in style presets live in [`src/deepsoch_toolkit/data/presets/styles.json`](src/deepsoch_toolkit/data/presets/styles.json) and ship updated with the toolkit.

User-added presets go in `user/presets/custom_styles.json` (auto-created on first use, never overwritten by updates).

## Sample workflow

See [`workflow/Transform-Image.json`](workflow/Transform-Image.json) for a working Load Images → Prompt Preset → Flux Kontext pipeline.

---

## Developed by

| | |
|---|---|
| **Company** | Deepsoch AI Private Limited |
| **Developer** | Karim Khan |
| **Contact** | [deepsoch.ai@gmail.com](mailto:deepsoch.ai@gmail.com) |
