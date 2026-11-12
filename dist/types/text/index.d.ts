import { SdObject } from '../core/object.js';
import { type Manifest } from '../core/registry.js';
/**
 * `<sd-text>Solids</sd-text>` or `<sd-text><h1>Solids</h1></sd-text>`: the light DOM is the text. The element keeps the wrapped
 * HTML's layout box and accessibility node, makes its text transparent, and draws a 3D twin over it from a signed distance field
 * rasterized with the computed CSS font. `pixel` rasterizes at that cell size for the pixel-font look from any monospace.
 * `size` is a no-op: `font-size` rules. Every shade, effect, animation and interaction applies, like any object.
 */
export declare class SdText extends SdObject {
    static manifest: Manifest;
    static frag: string;
    static get observedAttributes(): string[];
    private cell;
    private version;
    private queued;
    private mo;
    private sizeWatch;
    constructor();
    connectedCallback(): void;
    disconnectedCallback(): void;
    attributeChangedCallback(name: string, old: string | null, v: string | null): void;
    /** Each frame: the em in unit space, from the font size against the box's short side (unit space is that short side). */
    update(dt: number): void;
    /** Re-rasterize at the next frame (coalesced): on text, font, `pixel` or size changes. */
    rebuild(): void;
    private raster;
}
