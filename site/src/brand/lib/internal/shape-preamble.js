export const shapePreamble = `
mat2 turn(float a){return mat2(cos(a),-sin(a),sin(a),cos(a));}
float glyph(vec2 p){return ink(p)*step(0.,p.x)*step(p.x,1.)*step(0.,p.y)*step(p.y,1.);}
vec4 study(vec2 p,float strength){
 vec2 px=1./size,aspect=vec2(size.x/size.y,1.);vec2 delta=(p-pointer)*aspect;
 float radius=length(delta),k=clamp(strength,0.,1.35),s=clamp(detail,1.,24.);
 float original=glyph(p),a=original;vec3 c=color;vec2 q=p;
`;
export const shapeEnd = ` // Effects return exactly to native-mask appearance at rest.
 if(k<.001)return vec4(color,original);
 return vec4(c,clamp(a,0.,1.));
}
`;
