"""Prompt Preset — outputs one or many prompts from a shared preset library.

Tick one or more preset checkboxes (and/or write a custom prompt). The
node emits a list of prompts; because the output is declared as a list
(`OUTPUT_IS_LIST = (True, False)`), ComfyUI auto-runs the downstream
chain (CLIP encode -> sampler -> VAE -> save) once per emitted prompt.
Each selected preset therefore generates an independent image.

Preset storage:

* Built-in presets ship in `data/presets/styles.json` (read-only).
* User presets live in `<toolkit>/user/presets/custom_styles.json`
  (writable, never overwritten on toolkit update). User presets override
  built-ins when names collide.
"""

from typing import Any

from ...core.branding import describe
from ...core.categories import PROMPT
from ...core.io import load_json
from ...core.paths import PRESETS_DIR, USER_PRESETS_DIR, ensure_user_dirs

BUILTIN_FILE = PRESETS_DIR / "styles.json"
USER_FILE = USER_PRESETS_DIR / "custom_styles.json"


def _load_all_presets() -> dict[str, str]:
    """Merge built-in + user presets. User presets win on name collision."""
    presets: dict[str, str] = {}
    if BUILTIN_FILE.exists():
        presets.update(load_json(BUILTIN_FILE))
    if USER_FILE.exists():
        presets.update(load_json(USER_FILE))
    return presets


class DeepSochPromptPreset:
    """Outputs one or many prompts from ticked presets and/or a custom prompt."""

    DESCRIPTION = describe(
        "Tick one or more style presets and emit them as a prompt list. "
        "Each ticked preset re-runs the downstream chain independently, "
        "so N presets produce N styled outputs in a single queue."
    )

    @classmethod
    def INPUT_TYPES(cls) -> dict[str, Any]:
        ensure_user_dirs()
        presets = _load_all_presets()
        names = sorted(presets.keys())

        # `select_all` overrides the per-preset checkboxes when True.
        required: dict[str, Any] = {
            "select_all": ("BOOLEAN", {"default": False}),
        }
        # One BOOLEAN checkbox per preset — proper native multi-select.
        for name in names:
            required[name] = ("BOOLEAN", {"default": False})

        return {
            "required": required,
            "optional": {
                "custom_prompt": (
                    "STRING",
                    {"multiline": True, "default": ""},
                ),
            },
        }

    RETURN_TYPES = ("STRING", "INT")
    RETURN_NAMES = ("prompt", "count")
    OUTPUT_IS_LIST = (True, False)
    FUNCTION = "run"
    CATEGORY = PROMPT

    # Re-evaluate when preset files change so newly-saved user presets
    # appear as checkboxes without restarting ComfyUI.
    @classmethod
    def IS_CHANGED(cls, **kwargs):
        stamps = []
        for f in (BUILTIN_FILE, USER_FILE):
            stamps.append(f.stat().st_mtime if f.exists() else 0)
        return (kwargs, stamps)

    def run(
        self,
        select_all: bool = False,
        custom_prompt: str = "",
        **preset_flags: bool,
    ):
        presets = _load_all_presets()

        prompts: list[str] = []
        if select_all:
            for name in sorted(presets.keys()):
                prompts.append(presets[name])
        else:
            for name in sorted(preset_flags.keys()):
                if preset_flags[name] and name in presets:
                    prompts.append(presets[name])

        custom = (custom_prompt or "").strip()
        if custom:
            prompts.append(custom)

        # Never emit an empty list — would break downstream nodes.
        if not prompts:
            print("[deepsoch-toolkit] No preset selected; emitting empty string.")
            prompts = [""]

        return (prompts, len(prompts))


NODE_CLASS_MAPPINGS = {
    "DeepSochPromptPreset": DeepSochPromptPreset,
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "DeepSochPromptPreset": "Prompt Preset",
}
