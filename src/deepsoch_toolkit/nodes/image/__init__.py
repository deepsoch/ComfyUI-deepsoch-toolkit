"""Image-related nodes."""

from .load_images import (
    NODE_CLASS_MAPPINGS as _LI_NODES,
    NODE_DISPLAY_NAME_MAPPINGS as _LI_NAMES,
)

NODE_CLASS_MAPPINGS: dict = {**_LI_NODES}
NODE_DISPLAY_NAME_MAPPINGS: dict = {**_LI_NAMES}
