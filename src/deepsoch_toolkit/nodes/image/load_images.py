"""Load Images — upload one or many images and emit them as a list.

The user uploads images via the JS frontend (see `web/load_images.js`),
which stores the resulting filenames in the hidden `files` widget as a
JSON array. At execution time we reload each file from ComfyUI's input
directory and emit them as IMAGE / MASK / filename lists, so downstream
nodes auto-execute once per uploaded image.
"""

import json
import os
from typing import Any

from ...core.branding import describe
from ...core.categories import IMAGE


def _load_image_and_mask(path: str):
    """Load a single image into ComfyUI's (1, H, W, 3) IMAGE + (1, H, W) MASK tensors."""
    import numpy as np
    import torch
    from PIL import Image, ImageOps

    img = Image.open(path)
    img = ImageOps.exif_transpose(img)

    has_alpha = "A" in img.getbands()
    if has_alpha:
        alpha = np.array(img.getchannel("A")).astype(np.float32) / 255.0
        mask = 1.0 - torch.from_numpy(alpha)
    else:
        mask = torch.zeros((img.height, img.width), dtype=torch.float32)

    if img.mode != "RGB":
        img = img.convert("RGB")
    arr = np.array(img).astype(np.float32) / 255.0
    image_tensor = torch.from_numpy(arr)[None,]  # (1, H, W, 3)
    mask_tensor = mask.unsqueeze(0)  # (1, H, W)

    return image_tensor, mask_tensor


def _resolve_input_path(name: str) -> str:
    """Resolve a filename (possibly with subfolder/type annotation) to an absolute path."""
    try:
        import folder_paths  # type: ignore

        if hasattr(folder_paths, "get_annotated_filepath"):
            return folder_paths.get_annotated_filepath(name)
        return os.path.join(folder_paths.get_input_directory(), name)
    except Exception:
        return name


class DeepSochLoadImages:
    """Upload and emit a list of images. UI provided by `web/load_images.js`."""

    DESCRIPTION = describe(
        "Upload one or many images and emit them as a list. "
        "Native-style multi-image preview with grid view, "
        "click-to-fullscreen and counter cycling."
    )

    @classmethod
    def INPUT_TYPES(cls) -> dict[str, Any]:
        return {
            "required": {
                # JSON-encoded list of filenames stored by the JS upload widget.
                "files": ("STRING", {"default": "[]", "multiline": False}),
            },
        }

    RETURN_TYPES = ("IMAGE", "MASK", "STRING", "INT")
    RETURN_NAMES = ("image", "mask", "filename", "count")
    OUTPUT_IS_LIST = (True, True, True, False)
    FUNCTION = "run"
    CATEGORY = IMAGE

    @classmethod
    def IS_CHANGED(cls, files):
        # Re-execute whenever the uploaded file list changes.
        return files

    def run(self, files: str):
        try:
            names = json.loads(files) if files else []
        except json.JSONDecodeError:
            names = []

        if not names:
            raise ValueError(
                "[deepsoch-toolkit] No images uploaded. Click 'Upload Images' on the node."
            )

        images: list = []
        masks: list = []
        filenames: list[str] = []
        for name in names:
            path = _resolve_input_path(name)
            if not os.path.isfile(path):
                raise FileNotFoundError(
                    f"[deepsoch-toolkit] Uploaded image not found on disk: {name}"
                )
            img_tensor, mask_tensor = _load_image_and_mask(path)
            images.append(img_tensor)
            masks.append(mask_tensor)
            filenames.append(name)

        print(f"[deepsoch-toolkit] Loaded {len(images)} uploaded image(s).")
        return (images, masks, filenames, len(images))


NODE_CLASS_MAPPINGS = {
    "DeepSochLoadImages": DeepSochLoadImages,
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "DeepSochLoadImages": "Load Images",
}
