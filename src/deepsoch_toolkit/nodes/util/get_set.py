"""Set / Get — wireless reroute nodes.

These Python classes are intentionally minimal stubs. Their only purpose
is to register a proper category and display name with ComfyUI so the
nodes appear inside the `deepsoch` menu and library panel. All real
behavior is added on the frontend by `web/get_set.js`, which:

  * Marks each node instance as `isVirtualNode = true` (so the prompt
    builder strips it from the workflow before sending to the backend).
  * Overrides `getInputLink` / `getInputNode` on Get nodes so the
    upstream traversal is redirected to whatever feeds the matching
    Set node — turning the Set/Get pair into a transparent rewire.

Because every Set/Get is virtual, the `passthrough` / `noop` methods
below should never actually run on the backend. They exist only as
fallbacks in case a node somehow slips through to execution.
"""

from ...core.categories import UTIL


class _AnyType(str):
    """String subclass that compares-equal to anything.

    ComfyUI uses string equality on input/output type names to validate
    connections. Returning False from __ne__ means this type is always
    treated as compatible — the standard 'wildcard' trick used by many
    custom node packs.
    """

    def __ne__(self, other):  # noqa: D401  -- intentionally simple
        return False


ANY = _AnyType("*")


class DeepSochSetNode:
    """Stub for the wireless Set node. Real UI/behavior lives in JS."""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "value": (ANY, {}),
                "name": ("STRING", {"default": ""}),
            },
        }

    RETURN_TYPES = (ANY,)
    RETURN_NAMES = ("value",)
    FUNCTION = "passthrough"
    CATEGORY = UTIL

    def passthrough(self, value, name):  # pragma: no cover - virtual on frontend
        return (value,)


class DeepSochGetNode:
    """Stub for the wireless Get node. Real UI/behavior lives in JS."""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "name": ("STRING", {"default": ""}),
            },
        }

    RETURN_TYPES = (ANY,)
    RETURN_NAMES = ("value",)
    FUNCTION = "noop"
    CATEGORY = UTIL

    def noop(self, name):  # pragma: no cover - virtual on frontend
        return (None,)


NODE_CLASS_MAPPINGS = {
    "DeepSochSetNode": DeepSochSetNode,
    "DeepSochGetNode": DeepSochGetNode,
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "DeepSochSetNode": "Set Node",
    "DeepSochGetNode": "Get Node",
}
