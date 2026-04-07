"""DeepSoch Toolkit — internal package.

Aggregates node mappings from every node sub-package under `nodes/` and
exposes them for the root ComfyUI loader.
"""

from .nodes import NODE_CLASS_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"]
