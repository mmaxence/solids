// uMix is unset (0) on the blit, so the footer returns the scene texel either way.
vec4 sdEffect() { return texture(uScene, vUv); }
