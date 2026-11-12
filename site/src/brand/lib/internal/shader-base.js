export const shaderBase = `precision highp float;
varying vec2 uv; uniform sampler2D mask; uniform vec2 size, pointer, velocity; uniform float time, energy, intensity, mode, detail; uniform vec3 color; uniform vec3 traces[8];
float ink(vec2 p){return texture2D(mask,clamp(p,0.,1.)).a;}
float sd(vec2 p){return (texture2D(mask,clamp(p,0.,1.)).r-.5)*64.;}
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
vec3 palette(float t){return .55+.45*cos(6.28318*(t+vec3(0.,.33,.67)));}
`;
