export type Program = {
    prog: WebGLProgram;
    loc: Map<string, WebGLUniformLocation>;
};
export type ColorSpace = 'display-p3' | 'srgb';
/** colorSpace is what the drawing buffer actually took: 'srgb' where Display P3 is unsupported. */
export declare function createGL(canvas: HTMLCanvasElement): {
    gl: WebGL2RenderingContext;
    colorSpace: ColorSpace;
} | null;
/** GL state the renderer relies on; call again after a context restore, which resets everything. */
export declare function initState(gl: WebGL2RenderingContext): void;
/** 'object' fragments get the raymarch prelude plus a shade; 'effect' fragments get the post-pass prelude. One program per object and shade pair. */
export declare function program(gl: WebGL2RenderingContext, frag: string, kind?: 'object' | 'effect', shade?: {
    name: string;
    frag: string;
}): Program;
export declare function clearCache(gl: WebGL2RenderingContext): void;
export type UniformValue = number | number[] | Float32Array;
export declare function setUniforms(gl: WebGL2RenderingContext, p: Program, values: Record<string, UniformValue>): void;
export declare function drawQuad(gl: WebGL2RenderingContext): void;
