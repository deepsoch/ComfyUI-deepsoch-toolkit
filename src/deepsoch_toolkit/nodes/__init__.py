"""Aggregates node mappings from every node sub-package.

To add a new node category later (e.g. `image/`, `sampler/`), import its
mappings here and extend the dicts. Keeping this file as the single
aggregation point means the rest of the package never has to know about
the full node list.
"""

from .prompt import (
    NODE_CLASS_MAPPINGS as _PROMPT_NODES,
    NODE_DISPLAY_NAME_MAPPINGS as _PROMPT_NAMES,
)
from .image import (
    NODE_CLASS_MAPPINGS as _IMAGE_NODES,
    NODE_DISPLAY_NAME_MAPPINGS as _IMAGE_NAMES,
)
from .util import (
    NODE_CLASS_MAPPINGS as _UTIL_NODES,
    NODE_DISPLAY_NAME_MAPPINGS as _UTIL_NAMES,
)

NODE_CLASS_MAPPINGS: dict = {}
NODE_DISPLAY_NAME_MAPPINGS: dict = {}

for _nodes, _names in (
    (_PROMPT_NODES, _PROMPT_NAMES),
    (_IMAGE_NODES, _IMAGE_NAMES),
    (_UTIL_NODES, _UTIL_NAMES),
):
    NODE_CLASS_MAPPINGS.update(_nodes)
    NODE_DISPLAY_NAME_MAPPINGS.update(_names)
