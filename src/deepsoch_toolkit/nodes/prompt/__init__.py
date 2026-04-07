"""Prompt-related nodes."""

from .prompt_preset import (
    NODE_CLASS_MAPPINGS as _PP_NODES,
    NODE_DISPLAY_NAME_MAPPINGS as _PP_NAMES,
)

NODE_CLASS_MAPPINGS: dict = {**_PP_NODES}
NODE_DISPLAY_NAME_MAPPINGS: dict = {**_PP_NAMES}
