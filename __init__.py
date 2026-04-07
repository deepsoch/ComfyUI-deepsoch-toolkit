"""ComfyUI-deepsoch-toolkit — root loader.

This file is what ComfyUI imports when it scans `custom_nodes/`. It is
intentionally thin: it re-exports the node mappings aggregated by the
internal package under `src/deepsoch_toolkit/`.
"""

from .src.deepsoch_toolkit import NODE_CLASS_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS

WEB_DIRECTORY = "./web"  # reserved for future JS frontend extensions

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
