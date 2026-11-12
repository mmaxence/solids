export type FBO = {
    fb: WebGLFramebuffer;
    tex: WebGLTexture;
    w: number;
    h: number;
};
export declare function createFBO(gl: WebGL2RenderingContext, w: number, h: number): FBO;
export declare function resizeFBO(gl: WebGL2RenderingContext, f: FBO, w: number, h: number): void;
export declare function deleteFBO(gl: WebGL2RenderingContext, f: FBO): void;
