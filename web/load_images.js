// DeepSoch Toolkit — Load Images frontend.
//
// Mirrors ComfyUI's native multi-image preview UX (the one used by
// SaveImage / PreviewImage). Reference implementation:
// https://github.com/comfyanonymous/ComfyUI/blob/v0.0.4/web/scripts/app.js
//
// Key mechanics copied from native:
//   * All drawing happens in `onDrawBackground` (not foreground).
//   * Mouse position read from `canvas.graph_mouse` and `canvas.pointer_is_down`
//     inside the draw callback — no separate onMouseDown handler.
//   * `pointerDown` state captures press and applies on release at same
//     position (drag-vs-click detection).
//   * `calculateGrid(w, h, n)` picks a square cell size that fits all
//     images, then expands until N cells fit.
//   * `imageIndex == null` -> grid view, otherwise fullscreen for that index.
//   * Counter button bottom-right ((dw-40, dh+top-40), 30x30) cycles forward.
//   * Close "x" button top-right ((dw-40, top+10), 30x30) returns to grid.
//   * Hover applies `ctx.filter = contrast(110%) brightness(110%)`,
//     pressed state uses 125%.

import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const NODE_NAME = "DeepSochLoadImages";
const PADDING_BELOW_WIDGETS = 4;

async function uploadOne(file) {
    const fd = new FormData();
    fd.append("image", file);
    fd.append("overwrite", "true");
    const resp = await api.fetchApi("/upload/image", { method: "POST", body: fd });
    if (resp.status !== 200) {
        throw new Error(`upload failed (${resp.status}): ${file.name}`);
    }
    const data = await resp.json();
    const sub = data.subfolder ? `${data.subfolder}/` : "";
    return `${sub}${data.name}`;
}

function readList(widget) {
    try {
        const v = JSON.parse(widget.value || "[]");
        return Array.isArray(v) ? v : [];
    } catch {
        return [];
    }
}

function writeList(widget, list) {
    widget.value = JSON.stringify(list);
}

function getImageTop(node) {
    // Y coordinate where the preview area starts: just below the last widget.
    let maxY = 0;
    let anyRendered = false;
    for (const w of node.widgets) {
        if (w.last_y != null) {
            const h = w.computedHeight ?? LiteGraph.NODE_WIDGET_HEIGHT + 4;
            const bottom = w.last_y + h;
            if (bottom > maxY) maxY = bottom;
            anyRendered = true;
        }
    }
    if (anyRendered) return maxY + PADDING_BELOW_WIDGETS;
    // Fallback before the first render pass.
    let y = LiteGraph.NODE_TITLE_HEIGHT || 30;
    for (const w of node.widgets) {
        const isHidden = w.type === "hidden" || w.type === "converted-widget" || w.hidden;
        if (isHidden) continue;
        y += w.computedHeight ?? LiteGraph.NODE_WIDGET_HEIGHT + 4;
    }
    return y + PADDING_BELOW_WIDGETS;
}

// Native ComfyUI grid algorithm: square cells, expand cellsize until everything fits.
function calculateGrid(w, h, n) {
    let columns, rows, cellsize;
    if (w > h) {
        cellsize = h;
        columns = Math.ceil(w / cellsize);
        rows = Math.ceil(n / columns);
    } else {
        cellsize = w;
        rows = Math.ceil(h / cellsize);
        columns = Math.ceil(n / rows);
    }
    while (columns * rows < n) {
        cellsize++;
        if (w >= h) {
            columns = Math.ceil(w / cellsize);
            rows = Math.ceil(n / columns);
        } else {
            rows = Math.ceil(h / cellsize);
            columns = Math.ceil(n / rows);
        }
    }
    const cell_size = Math.min(w / columns, h / rows);
    return { cell_size, columns, rows };
}

function isAllSameAspectRatio(imgs) {
    if (imgs.length < 2) return true;
    const r0 = imgs[0].naturalWidth / imgs[0].naturalHeight;
    for (let i = 1; i < imgs.length; i++) {
        const r = imgs[i].naturalWidth / imgs[i].naturalHeight;
        if (Math.abs(r - r0) > 0.001) return false;
    }
    return true;
}

// Native ComfyUI compact-mode layout (for images that all share the same
// aspect ratio). Picks the column count that maximizes total displayed
// image area. Source:
// https://github.com/comfyanonymous/ComfyUI/blob/v0.0.4/web/scripts/ui/imagePreview.js
function calculateImageGrid(imgs, dw, dh) {
    let best = 0;
    const w = imgs[0].naturalWidth;
    const h = imgs[0].naturalHeight;
    const numImages = imgs.length;

    let cellWidth, cellHeight, cols, rows, shiftX;
    for (let c = 1; c <= numImages; c++) {
        const r = Math.ceil(numImages / c);
        const cW = dw / c;
        const cH = dh / r;
        const scaleX = cW / w;
        const scaleY = cH / h;
        const scale = Math.min(scaleX, scaleY, 1);
        const imageW = w * scale;
        const imageH = h * scale;
        const area = imageW * imageH * numImages;

        if (area > best) {
            best = area;
            cellWidth = imageW;
            cellHeight = imageH;
            cols = c;
            rows = r;
            shiftX = c * ((cW - imageW) / 2);
        }
    }

    return { cellWidth, cellHeight, cols, rows, shiftX };
}

// Unique key under which we stash the prototype's *truly original*
// onNodeCreated. Re-patching always rebases off this original, so hot
// reloads cannot accumulate a chain of stale patches.
const ORIG_ONC_KEY = "__deepsochLoadImages_origOnNodeCreated";

app.registerExtension({
    name: "deepsoch.toolkit.LoadImages",

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== NODE_NAME) return;

        if (!Object.prototype.hasOwnProperty.call(nodeType.prototype, ORIG_ONC_KEY)) {
            nodeType.prototype[ORIG_ONC_KEY] = nodeType.prototype.onNodeCreated;
        }
        const originalOnNodeCreated = nodeType.prototype[ORIG_ONC_KEY];

        nodeType.prototype.onNodeCreated = function () {
            originalOnNodeCreated?.apply(this, arguments);
            const node = this;

            const filesWidget = node.widgets.find((w) => w.name === "files");
            if (!filesWidget) return;

            // Hide the JSON widget — users only interact via buttons + previews.
            filesWidget.type = "converted-widget";
            filesWidget.computeSize = () => [0, -4];
            filesWidget.hidden = true;
            filesWidget.serializeValue = () => filesWidget.value;

            // State, mirroring the native preview node.
            node.imgs = [];           // HTMLImageElement[] for the current uploads
            node.imageIndex = null;   // null => grid, otherwise the fullscreen index
            node.imageRects = [];     // hit-test rects for grid cells
            node.pointerDown = null;  // {index, pos} pending click
            node.overIndex = null;
            node._loadedFor = "";     // last `files` JSON we loaded into node.imgs

            // ---- Load HTMLImageElements for the current files list ----
            const reloadImagesIfChanged = () => {
                const json = filesWidget.value || "[]";
                if (json === node._loadedFor) return;
                node._loadedFor = json;
                const list = readList(filesWidget);
                if (list.length === 0) {
                    node.imgs = [];
                    node.imageIndex = null;
                    return;
                }
                Promise.all(
                    list.map((name) => new Promise((r) => {
                        const img = new Image();
                        img.onload = () => r(img);
                        img.onerror = () => r(null);
                        let subfolder = "";
                        let pureName = name;
                        const slash = name.lastIndexOf("/");
                        if (slash !== -1) {
                            subfolder = name.slice(0, slash);
                            pureName = name.slice(slash + 1);
                        }
                        const qs = new URLSearchParams({
                            filename: pureName,
                            type: "input",
                            subfolder,
                        });
                        img.src = api.apiURL(`/view?${qs.toString()}`);
                    })),
                ).then((imgs) => {
                    if (filesWidget.value === json) {
                        node.imgs = imgs.filter(Boolean);
                        node.imageIndex = null;
                        app.graph.setDirtyCanvas(true);
                    }
                });
            };

            // ---- Upload button ----
            node.addWidget("button", "Upload Images", null, () => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = "image/*";
                input.multiple = true;
                input.onchange = async () => {
                    const files = Array.from(input.files || []);
                    if (files.length === 0) return;
                    const uploaded = [];
                    for (const f of files) {
                        try {
                            uploaded.push(await uploadOne(f));
                        } catch (e) {
                            console.error("[deepsoch-toolkit]", e);
                        }
                    }
                    const current = readList(filesWidget);
                    current.push(...uploaded);
                    writeList(filesWidget, current);
                    reloadImagesIfChanged();
                    app.graph.setDirtyCanvas(true);
                };
                input.click();
            });

            // ---- Clear button ----
            node.addWidget("button", "Clear", null, () => {
                writeList(filesWidget, []);
                node.imgs = [];
                node.imageIndex = null;
                node._loadedFor = "[]";
                app.graph.setDirtyCanvas(true);
            });

            // ---- Native-style draw callback (background, not foreground) ----
            // Override cleanly — do NOT chain through any previous
            // onDrawBackground, otherwise stale patches from hot reloads
            // would render their UI on top of ours.
            node.onDrawBackground = function (ctx) {
                if (this.flags?.collapsed) return;

                // Make sure node.imgs reflects the current uploaded list.
                reloadImagesIfChanged();

                if (!this.imgs || this.imgs.length === 0) {
                    // Empty state hint.
                    const top = getImageTop(this);
                    ctx.fillStyle = "#888";
                    ctx.font = "12px sans-serif";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText(
                        "(no images uploaded)",
                        this.size[0] / 2,
                        top + (this.size[1] - top) / 2,
                    );
                    return;
                }

                const canvas = app.graph.list_of_graphcanvas[0];
                const mouse = canvas.graph_mouse;

                // Apply pending pointer-down on release at same position
                // (this is how native distinguishes click from drag).
                if (!canvas.pointer_is_down && this.pointerDown) {
                    if (mouse[0] === this.pointerDown.pos[0] && mouse[1] === this.pointerDown.pos[1]) {
                        this.imageIndex = this.pointerDown.index;
                    }
                    this.pointerDown = null;
                }

                let imageIndex = this.imageIndex;
                const numImages = this.imgs.length;
                if (numImages === 1 && imageIndex == null) {
                    this.imageIndex = imageIndex = 0;
                }

                const top = getImageTop(this);
                let shiftY = top;
                let dw = this.size[0];
                let dh = this.size[1] - shiftY;

                if (imageIndex == null) {
                    // ---- Grid view ----
                    const compact = isAllSameAspectRatio(this.imgs);
                    let cell_padding, cellWidth, cellHeight, cols, shiftX;
                    if (!compact) {
                        // Mixed aspect ratios -> square cells with thin borders.
                        cell_padding = 2;
                        const { cell_size, columns, rows } = calculateGrid(dw, dh, numImages);
                        cols = columns;
                        cellWidth = cell_size;
                        cellHeight = cell_size;
                        shiftX = (dw - cell_size * cols) / 2;
                        shiftY = (dh - cell_size * rows) / 2 + top;
                    } else {
                        // Same aspect ratios -> non-square cells, max area, no border.
                        cell_padding = 0;
                        ({ cellWidth, cellHeight, cols, shiftX } = calculateImageGrid(this.imgs, dw, dh));
                        const rows = Math.ceil(numImages / cols);
                        shiftY = (dh - cellHeight * rows) / 2 + top;
                    }

                    let anyHovered = false;
                    this.imageRects = [];
                    for (let i = 0; i < numImages; i++) {
                        const img = this.imgs[i];
                        const row = Math.floor(i / cols);
                        const col = i % cols;
                        const x = col * cellWidth + shiftX;
                        const y = row * cellHeight + shiftY;
                        if (!anyHovered) {
                            anyHovered = LiteGraph.isInsideRectangle(
                                mouse[0],
                                mouse[1],
                                x + this.pos[0],
                                y + this.pos[1],
                                cellWidth,
                                cellHeight,
                            );
                            if (anyHovered) {
                                this.overIndex = i;
                                let value = 110;
                                if (canvas.pointer_is_down) {
                                    if (!this.pointerDown || this.pointerDown.index !== i) {
                                        this.pointerDown = { index: i, pos: [...mouse] };
                                    }
                                    value = 125;
                                }
                                ctx.filter = `contrast(${value}%) brightness(${value}%)`;
                                canvas.canvas.style.cursor = "pointer";
                            }
                        }
                        this.imageRects.push([x, y, cellWidth, cellHeight]);

                        let imgWidth, imgHeight;
                        if (compact) {
                            // In compact mode the cell dimensions ARE the
                            // scaled image dimensions, so no further fitting.
                            imgWidth = cellWidth;
                            imgHeight = cellHeight;
                        } else {
                            const wratio = cellWidth / img.naturalWidth;
                            const hratio = cellHeight / img.naturalHeight;
                            const ratio = Math.min(wratio, hratio);
                            imgWidth = ratio * img.naturalWidth;
                            imgHeight = ratio * img.naturalHeight;
                        }
                        const imgY = row * cellHeight + shiftY + (cellHeight - imgHeight) / 2;
                        const imgX = col * cellWidth + shiftX + (cellWidth - imgWidth) / 2;

                        ctx.drawImage(
                            img,
                            imgX + cell_padding,
                            imgY + cell_padding,
                            imgWidth - cell_padding * 2,
                            imgHeight - cell_padding * 2,
                        );
                        if (!compact) {
                            ctx.strokeStyle = "#8F8F8F";
                            ctx.lineWidth = 1;
                            ctx.strokeRect(
                                x + cell_padding,
                                y + cell_padding,
                                cellWidth - cell_padding * 2,
                                cellHeight - cell_padding * 2,
                            );
                        }
                        ctx.filter = "none";
                    }

                    if (!anyHovered) {
                        this.pointerDown = null;
                        this.overIndex = null;
                    }
                } else {
                    // ---- Fullscreen view ----
                    const img = this.imgs[imageIndex];
                    let w = img.naturalWidth;
                    let h = img.naturalHeight;
                    const scale = Math.min(dw / w, dh / h, 1);
                    w *= scale;
                    h *= scale;
                    const x = (dw - w) / 2;
                    const y = (dh - h) / 2 + shiftY;
                    ctx.drawImage(img, x, y, w, h);

                    // Native-style drawButton helper.
                    const self = this;
                    const drawButton = (bx, by, sz, text) => {
                        const hovered = LiteGraph.isInsideRectangle(
                            mouse[0],
                            mouse[1],
                            bx + self.pos[0],
                            by + self.pos[1],
                            sz,
                            sz,
                        );
                        let fill = "#333";
                        let textFill = "#fff";
                        let isClicking = false;
                        if (hovered) {
                            canvas.canvas.style.cursor = "pointer";
                            if (canvas.pointer_is_down) {
                                fill = "#1e90ff";
                                isClicking = true;
                            } else {
                                fill = "#eee";
                                textFill = "#000";
                            }
                        }
                        ctx.fillStyle = fill;
                        ctx.beginPath();
                        if (typeof ctx.roundRect === "function") {
                            ctx.roundRect(bx, by, sz, sz, [4]);
                        } else {
                            ctx.rect(bx, by, sz, sz);
                        }
                        ctx.fill();
                        ctx.fillStyle = textFill;
                        ctx.font = "12px Arial";
                        ctx.textAlign = "center";
                        ctx.textBaseline = "alphabetic";
                        ctx.fillText(text, bx + sz / 2, by + sz / 2 + 4);
                        return isClicking;
                    };

                    if (numImages > 1) {
                        // Counter button bottom-right -> next image.
                        if (drawButton(dw - 40, dh + top - 40, 30, `${imageIndex + 1}/${numImages}`)) {
                            const next = imageIndex + 1 >= numImages ? 0 : imageIndex + 1;
                            if (!this.pointerDown || this.pointerDown.index !== next) {
                                this.pointerDown = { index: next, pos: [...mouse] };
                            }
                        }
                        // Close button top-right -> back to grid.
                        if (drawButton(dw - 40, top + 10, 30, "x")) {
                            if (!this.pointerDown || this.pointerDown.index !== null) {
                                this.pointerDown = { index: null, pos: [...mouse] };
                            }
                        }
                    }
                }
            };

            // Reasonable default size for the preview area.
            node.size = [340, 440];

            // Defensive cleanup: if a previous (hot-reloaded) version of this
            // extension installed an `onDrawForeground` on this prototype,
            // wipe it on the instance so we don't double-draw the X / counter.
            // All current drawing happens in `onDrawBackground` only.
            node.onDrawForeground = null;
        };
    },
});
