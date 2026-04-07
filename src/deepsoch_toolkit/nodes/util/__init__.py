"""Utility nodes (Set/Get wireless reroutes, etc.)."""

from .get_set import (
    NODE_CLASS_MAPPINGS as _GS_NODES,
    NODE_DISPLAY_NAME_MAPPINGS as _GS_NAMES,
)

NODE_CLASS_MAPPINGS: dict = {**_GS_NODES}
NODE_DISPLAY_NAME_MAPPINGS: dict = {**_GS_NAMES}
