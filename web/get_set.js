// DeepSoch Toolkit — Set / Get virtual nodes (wireless reroutes).
//
// The Python side (`nodes/util/get_set.py`) registers two stub classes
// purely so ComfyUI's menu / library panel show them under the
// `deepsoch/util` category with friendly display names ("Set Node" /
// "Get Node"). All real behavior — virtual routing, type adoption,
// dropdown of available Set names — is added here.
//
// Pattern (rgthree-comfy / KJNodes style):
//   * Each node instance is marked `isVirtualNode = true`, so the
//     prompt builder strips it out before sending to the backend.
//   * `getInputLink` / `getInputNode` on Get nodes are overridden so
//     graph traversal jumps straight to whatever feeds the matching Set
//     node — making the pair behave as a transparent rewire.

import { app } from "../../scripts/app.js";

const SET_TYPE = "DeepSochSetNode";
const GET_TYPE = "DeepSochGetNode";

const SET_COLOR = "#2a4d3a";
const GET_COLOR = "#2a3a4d";

function findSetNodeByName(graph, name) {
    if (!graph || !name) return null;
    for (const n of graph._nodes) {
        if (n.type === SET_TYPE) {
            const w = n.widgets?.find((w) => w.name === "name");
            if (w?.value === name) return n;
        }
    }
    return null;
}

function listSetNames(graph) {
    if (!graph) return [""];
    const names = [];
    for (const n of graph._nodes) {
        if (n.type === SET_TYPE) {
            const v = n.widgets?.find((w) => w.name === "name")?.value;
            if (v) names.push(v);
        }
    }
    return names.length ? names : [""];
}

function refreshAllGetNodes(graph) {
    if (!graph) return;
    for (const n of graph._nodes) {
        if (n.type === GET_TYPE && typeof n.refreshType === "function") {
            n.refreshType();
        }
    }
}

// ----- Set node patch -----
function patchSetNode(nodeType) {
    const onNodeCreated = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
        onNodeCreated?.apply(this, arguments);
        this.isVirtualNode = true;
        this.color = SET_COLOR;
        this.bgcolor = "#1a1a1a";

        // Refresh dependent Get nodes whenever the name changes.
        const nameWidget = this.widgets?.find((w) => w.name === "name");
        if (nameWidget) {
            const orig = nameWidget.callback;
            nameWidget.callback = (v) => {
                refreshAllGetNodes(this.graph);
                return orig?.(v);
            };
        }
    };

    const onConnectionsChange = nodeType.prototype.onConnectionsChange;
    nodeType.prototype.onConnectionsChange = function (type, index, connected, link_info) {
        onConnectionsChange?.apply(this, arguments);
        // Adopt the type of whatever feeds our `value` input so downstream
        // type-checks (through any matching Get) keep working.
        if (type === LiteGraph.INPUT && index === 0) {
            if (connected && link_info) {
                const sourceNode = this.graph?._nodes_by_id?.[link_info.origin_id];
                const t = sourceNode?.outputs?.[link_info.origin_slot]?.type;
                if (t) {
                    this.inputs[0].type = t;
                    if (this.outputs?.[0]) this.outputs[0].type = t;
                    refreshAllGetNodes(this.graph);
                }
            } else if (!connected) {
                this.inputs[0].type = "*";
                if (this.outputs?.[0]) this.outputs[0].type = "*";
                refreshAllGetNodes(this.graph);
            }
        }
    };
}

// ----- Get node patch -----
function patchGetNode(nodeType) {
    const onNodeCreated = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
        onNodeCreated?.apply(this, arguments);
        this.isVirtualNode = true;
        this.color = GET_COLOR;
        this.bgcolor = "#1a1a1a";

        // Replace the Python-declared STRING `name` widget with a combo
        // populated from all Set node names currently in the graph.
        const stringWidgetIdx = this.widgets?.findIndex((w) => w.name === "name");
        if (stringWidgetIdx !== -1) {
            const old = this.widgets[stringWidgetIdx];
            const previousValue = old.value || "";
            this.widgets.splice(stringWidgetIdx, 1);
            const node = this;
            const combo = this.addWidget(
                "combo",
                "name",
                previousValue,
                () => node.refreshType(),
                { values: () => listSetNames(node.graph) },
            );
            // Move it back to the original slot so layout stays predictable.
            this.widgets.pop();
            this.widgets.splice(stringWidgetIdx, 0, combo);
        }

        this.refreshType();
    };

    nodeType.prototype.findSetNode = function () {
        const name = this.widgets?.find((w) => w.name === "name")?.value;
        return findSetNodeByName(this.graph, name);
    };

    nodeType.prototype.refreshType = function () {
        const setNode = this.findSetNode();
        if (!setNode) {
            if (this.outputs?.[0]) this.outputs[0].type = "*";
            this.setDirtyCanvas?.(true, true);
            return;
        }
        const t = setNode.inputs?.[0]?.type;
        if (this.outputs?.[0]) {
            this.outputs[0].type = t && t !== "*" ? t : "*";
        }
        this.setDirtyCanvas?.(true, true);
    };

    // Core trick: when ComfyUI walks backwards from a downstream node
    // through this Get, redirect the traversal to whatever is feeding
    // the matching Set node's input.
    nodeType.prototype.getInputLink = function (_slot) {
        const setNode = this.findSetNode();
        if (!setNode) return null;
        const linkId = setNode.inputs?.[0]?.link;
        if (linkId == null) return null;
        return this.graph.links[linkId] ?? null;
    };

    nodeType.prototype.getInputNode = function (_slot) {
        const setNode = this.findSetNode();
        if (!setNode) return null;
        const linkId = setNode.inputs?.[0]?.link;
        if (linkId == null) return null;
        const link = this.graph.links[linkId];
        if (!link) return null;
        return this.graph._nodes_by_id[link.origin_id] ?? null;
    };
}

app.registerExtension({
    name: "deepsoch.toolkit.GetSet",

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name === SET_TYPE) {
            patchSetNode(nodeType);
        } else if (nodeData.name === GET_TYPE) {
            patchGetNode(nodeType);
        }
    },
});
