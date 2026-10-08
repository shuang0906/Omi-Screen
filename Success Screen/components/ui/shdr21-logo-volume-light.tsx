"use client"
import { useEffect, useRef, useState, type CSSProperties } from "react"

// Edit these HEX colors; they are converted to shader RGB automatically.
const LOGO_COLORS = {
  light: "#9cff3a",
  shadow: "#ff9f9f",
}

function hexToShaderRgb(hex: string): string {
  let value = hex.trim().replace(/^#/, "")
  if (/^[0-9a-f]{3}$/i.test(value)) value = value.split("").map(char => char + char).join("")
  if (!/^[0-9a-f]{6}$/i.test(value)) throw new Error(`Invalid HEX color: ${hex}. Use #RRGGBB or #RGB.`)
  return [0, 2, 4].map(index => (parseInt(value.slice(index, index + 2), 16) / 255).toFixed(6)).join(", ")
}

const vertexSource = `attribute vec2 aPosition; void main(){gl_Position=vec4(aPosition,0.0,1.0);}`
const fragmentSource = `
precision highp float;
#define OMI_VOLUME
uniform vec2 uResolution;
uniform float uTime;
uniform float uNarrowing;
uniform float uTransparent;
uniform float uDebugGreen;
uniform float uCanvasPadding;
const float logoEdgeSoftness = 0.4;
#define uRes uResolution
#define uP_speed (uTime * 10.2 * 0.856)
const float uInput=0.0;
const float uOutput=0.6;
const vec3 uC_light = vec3(${hexToShaderRgb(LOGO_COLORS.light)});
const vec3 uC_shadow = vec3(${hexToShaderRgb(LOGO_COLORS.shadow)});
const float uP_radius = 2.000000;
const float uP_depth = 0.8;
const float uP_scale = 1.200000;
const float uP_churn = 0.300000;
const float uP_threshold = 0.025000;
const float uP_edgeSoft = 2.000000;
const float uP_camDist = 4.400000;
const float uP_focal = 1.800000;
const float uP_lightSpin = 0.120000;
const float uP_aniso = 0.20000;
const float uP_shadowAbsorb = 11.400000;
const float uP_shadowLift = 0.40000;
const float uP_absorb = 1.400000;
const float uP_power = 3.000000;
const float uP_density = 3.200000;
const float uP_ambient = 0.120000;
const float uP_exposure = 0.90000;
const float uP_alphaGain = 1.00000;
vec3 tanh3(vec3 x){x=clamp(x,-10.0,10.0);vec3 e=exp(2.0*x);return(e-1.0)/(e+1.0);}

void logoEdge(vec2 p,vec2 a,vec2 b,inout float minSq,inout float signValue){
 vec2 edge=b-a;vec2 w=p-a;float h=clamp(dot(w,edge)/max(dot(edge,edge),0.000001),0.0,1.0);vec2 q=w-edge*h;minSq=min(minSq,dot(q,q));
 if((a.y>p.y)!=(b.y>p.y)){if(p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)signValue=-signValue;}
}
float logoPlanarDistance(vec2 p){
 float minSq=100.0;float signValue=1.0;
 logoEdge(p,vec2(0.003119,0.999929),vec2(0.096405,0.994771),minSq,signValue);
 logoEdge(p,vec2(0.096405,0.994771),vec2(0.188630,0.981382),minSq,signValue);
 logoEdge(p,vec2(0.188630,0.981382),vec2(0.279141,0.959524),minSq,signValue);
 logoEdge(p,vec2(0.279141,0.959524),vec2(0.367215,0.929163),minSq,signValue);
 logoEdge(p,vec2(0.367215,0.929163),vec2(0.452148,0.890539),minSq,signValue);
 logoEdge(p,vec2(0.452148,0.890539),vec2(0.533393,0.844103),minSq,signValue);
 logoEdge(p,vec2(0.533393,0.844103),vec2(0.629190,0.775886),minSq,signValue);
 logoEdge(p,vec2(0.629190,0.775886),vec2(0.700756,0.713602),minSq,signValue);
 logoEdge(p,vec2(0.700756,0.713602),vec2(0.767092,0.644526),minSq,signValue);
 logoEdge(p,vec2(0.767092,0.644526),vec2(0.827261,0.568733),minSq,signValue);
 logoEdge(p,vec2(0.827261,0.568733),vec2(0.880151,0.486434),minSq,signValue);
 logoEdge(p,vec2(0.880151,0.486434),vec2(0.914319,0.420724),minSq,signValue);
 logoEdge(p,vec2(0.914319,0.420724),vec2(0.951664,0.328388),minSq,signValue);
 logoEdge(p,vec2(0.951664,0.328388),vec2(0.978773,0.231585),minSq,signValue);
 logoEdge(p,vec2(0.978773,0.231585),vec2(0.991983,0.156770),minSq,signValue);
 logoEdge(p,vec2(0.991983,0.156770),vec2(0.999782,0.055101),minSq,signValue);
 logoEdge(p,vec2(0.999782,0.055101),vec2(0.996555,-0.047592),minSq,signValue);
 logoEdge(p,vec2(0.996555,-0.047592),vec2(0.982521,-0.150173),minSq,signValue);
 logoEdge(p,vec2(0.982521,-0.150173),vec2(0.958118,-0.251686),minSq,signValue);
 logoEdge(p,vec2(0.958118,-0.251686),vec2(0.924050,-0.351452),minSq,signValue);
 logoEdge(p,vec2(0.924050,-0.351452),vec2(0.881008,-0.449113),minSq,signValue);
 logoEdge(p,vec2(0.881008,-0.449113),vec2(0.815227,-0.567891),minSq,signValue);
 logoEdge(p,vec2(0.815227,-0.567891),vec2(0.752807,-0.659682),minSq,signValue);
 logoEdge(p,vec2(0.752807,-0.659682),vec2(0.681008,-0.747328),minSq,signValue);
 logoEdge(p,vec2(0.681008,-0.747328),vec2(0.598837,-0.828370),minSq,signValue);
 logoEdge(p,vec2(0.598837,-0.828370),vec2(0.529973,-0.882555),minSq,signValue);
 logoEdge(p,vec2(0.529973,-0.882555),vec2(0.454973,-0.928874),minSq,signValue);
 logoEdge(p,vec2(0.454973,-0.928874),vec2(0.374408,-0.965210),minSq,signValue);
 logoEdge(p,vec2(0.374408,-0.965210),vec2(0.289385,-0.989462),minSq,signValue);
 logoEdge(p,vec2(0.289385,-0.989462),vec2(0.201578,-0.999849),minSq,signValue);
 logoEdge(p,vec2(0.201578,-0.999849),vec2(0.113134,-0.995160),minSq,signValue);
 logoEdge(p,vec2(0.113134,-0.995160),vec2(0.055025,-0.983462),minSq,signValue);
 logoEdge(p,vec2(0.055025,-0.983462),vec2(-0.001521,-0.965059),minSq,signValue);
 logoEdge(p,vec2(-0.001521,-0.965059),vec2(-0.055797,-0.940353),minSq,signValue);
 logoEdge(p,vec2(-0.055797,-0.940353),vec2(-0.155220,-0.874975),minSq,signValue);
 logoEdge(p,vec2(-0.155220,-0.874975),vec2(-0.240350,-0.795311),minSq,signValue);
 logoEdge(p,vec2(-0.240350,-0.795311),vec2(-0.390079,-0.615850),minSq,signValue);
 logoEdge(p,vec2(-0.390079,-0.615850),vec2(-0.452173,-0.553113),minSq,signValue);
 logoEdge(p,vec2(-0.452173,-0.553113),vec2(-0.520835,-0.502114),minSq,signValue);
 logoEdge(p,vec2(-0.520835,-0.502114),vec2(-0.724548,-0.381899),minSq,signValue);
 logoEdge(p,vec2(-0.724548,-0.381899),vec2(-0.786052,-0.335311),minSq,signValue);
 logoEdge(p,vec2(-0.786052,-0.335311),vec2(-0.842513,-0.281008),minSq,signValue);
 logoEdge(p,vec2(-0.842513,-0.281008),vec2(-0.906024,-0.197039),minSq,signValue);
 logoEdge(p,vec2(-0.906024,-0.197039),vec2(-0.953360,-0.102264),minSq,signValue);
 logoEdge(p,vec2(-0.953360,-0.102264),vec2(-0.983890,-0.000121),minSq,signValue);
 logoEdge(p,vec2(-0.983890,-0.000121),vec2(-0.999652,0.133030),minSq,signValue);
 logoEdge(p,vec2(-0.999652,0.133030),vec2(-0.998003,0.213886),minSq,signValue);
 logoEdge(p,vec2(-0.998003,0.213886),vec2(-0.983406,0.320933),minSq,signValue);
 logoEdge(p,vec2(-0.983406,0.320933),vec2(-0.963241,0.399497),minSq,signValue);
 logoEdge(p,vec2(-0.963241,0.399497),vec2(-0.935197,0.475528),minSq,signValue);
 logoEdge(p,vec2(-0.935197,0.475528),vec2(-0.899407,0.548045),minSq,signValue);
 logoEdge(p,vec2(-0.899407,0.548045),vec2(-0.856232,0.616097),minSq,signValue);
 logoEdge(p,vec2(-0.856232,0.616097),vec2(-0.806308,0.678871),minSq,signValue);
 logoEdge(p,vec2(-0.806308,0.678871),vec2(-0.730818,0.753351),minSq,signValue);
 logoEdge(p,vec2(-0.730818,0.753351),vec2(-0.668881,0.801953),minSq,signValue);
 logoEdge(p,vec2(-0.668881,0.801953),vec2(-0.581304,0.857185),minSq,signValue);
 logoEdge(p,vec2(-0.581304,0.857185),vec2(-0.490092,0.902122),minSq,signValue);
 logoEdge(p,vec2(-0.490092,0.902122),vec2(-0.396914,0.937667),minSq,signValue);
 logoEdge(p,vec2(-0.396914,0.937667),vec2(-0.302857,0.964692),minSq,signValue);
 logoEdge(p,vec2(-0.302857,0.964692),vec2(-0.208538,0.983885),minSq,signValue);
 logoEdge(p,vec2(-0.208538,0.983885),vec2(-0.090756,0.997411),minSq,signValue);
 logoEdge(p,vec2(-0.090756,0.997411),vec2(0.003119,0.999929),minSq,signValue);
 float outer=signValue*sqrt(minSq);
 float hole=0.582371-length(p-vec2(-0.016400,0.124541));
 return max(outer,hole);
}

#define STEPS 2
#define LIGHT_STEPS 2
#define DENSITY_OCT 4
#define AA 1

const float PI = 3.14159265359;

// Volume-reactive values, resolved once per fragment in main().
float nimbusPower;
float nimbusDensity;

/*
  Density inside the sphere.

  The radial term falls to zero at the boundary, which both bounds the volume
  and gives the soft edge for free. The cos-warp folds the sample point a few
  times — the same cheap turbulence the other orbs use — and the threshold
  carves that into clumps rather than an even fog.
*/

#ifdef OMI_VOLUME
vec2 rayXY;
float rayPlanar;
float logoDistance(vec3 p) {
 vec2 xy=p.xy/uP_radius;
 vec2 delta=xy-rayXY;
 float planar=(dot(delta,delta)<0.00000001 ? rayPlanar : logoPlanarDistance(xy))*uP_radius;
 vec2 d=vec2(planar,abs(p.z)-uP_depth*uP_radius);
 return min(max(d.x,d.y),0.0)+length(max(d,vec2(0.0)));
}

#endif

float density(vec3 p, float animTime) {
  #ifdef OMI_VOLUME
  float softness = uP_radius * logoEdgeSoftness;
  float inset = uP_radius * uNarrowing;
  float shell = 1.0 - smoothstep(
    -softness,
    softness,
    logoDistance(p) + inset
  );
  #else
  float shell = 1.0 - length(p) / uP_radius;
  #endif
  if (shell <= 0.0) return 0.0;

  vec3 q = p * uP_scale;
  float f = 1.0;
  for (int k = 0; k < DENSITY_OCT; k++) {
    q += cos(q.yzx * f + animTime * uP_churn) / f;
    f *= 1.8;
  }

  float n = (sin(q.x) + sin(q.y) + sin(q.z)) / 3.0 * 0.5 + 0.5;
  // smoothstep against the threshold is the clump control: high threshold
  // leaves sparse wisps, low fills the sphere with even fog
  float clump = smoothstep(uP_threshold, 1.0, n);
  return clump * pow(shell, uP_edgeSoft) * nimbusDensity;
}

/*
  Henyey-Greenstein: g > 0 biases scattering forward, which is what gives the
  bloom on the limb facing the light.

  The physical form carries a 1/(4*PI) normalisation. It is dropped here and
  folded into uP_power instead — kept in, the whole term sits around 0.02 and
  the orb renders black unless power is pushed into the hundreds, which makes
  the slider useless.
*/
float phaseHG(float c, float g) {
  float g2 = g * g;
  return (1.0 - g2) / pow(max(1.0 + g2 - 2.0 * g * c, 0.0001), 1.5);
}

vec4 nimbusRender(vec2 fragCoord) {
  float animTime = uP_speed; // integrated clock

  vec2 uv = (2.0 * fragCoord - uRes) / min(uRes.x, uRes.y);
  vec3 ro = vec3(0.0, 0.0, -uP_camDist);
  vec3 rd = normalize(vec3(uv, uP_focal));
  #ifdef OMI_VOLUME
  // Orthographic front view preserves the supplied logo proportions and hole.
  ro.xy = uv * uP_radius * 1.08 * uCanvasPadding;
  rd = vec3(0.0, 0.0, 1.0);
  rayXY=ro.xy/uP_radius;
  rayPlanar=logoPlanarDistance(rayXY);
  if (rayPlanar >= logoEdgeSoftness - uNarrowing) return vec4(0.0);
  #endif

  /*
    Light direction, slowly orbiting so the shading is never static.

    The z term is kept POSITIVE — the camera looks along +z, so a light also
    pointing along +z sits behind the cloud. That is the back-lit case, where
    dot(rd, L) approaches 1 and the forward-scattering phase blooms. Put the
    light on the camera's side instead and every ray samples the phase function
    on its back-scatter tail, where it is roughly ten times smaller, and the orb
    goes muddy.
  */
  vec3 L = normalize(vec3(
    cos(animTime * uP_lightSpin) * 0.7,
    0.45,
    sin(animTime * uP_lightSpin) * 0.35 + 0.65
  ));

  float phase = phaseHG(dot(rd, L), uP_aniso);

  // Start the march at the sphere's front face instead of the camera — every
  // step before that contributes nothing, and at 56 steps they are expensive.
  float toCentre = uP_camDist;
  float tStart = max(toCentre - uP_radius, 0.0);
  float span = 2.0 * uP_radius;
  #ifdef OMI_VOLUME
  tStart = max(toCentre - uP_radius * uP_depth, 0.0);
  span = 2.0 * uP_radius * uP_depth;
  #endif
  float dt = span / float(STEPS);

  float T = 1.0;
  vec3 scattered = vec3(0.0);

  for (int i = 0; i < STEPS; i++) {
    float t = tStart + (float(i) + 0.5) * dt;
    vec3 p = ro + rd * t;

    float dn = density(p, animTime);
    if (dn > 0.001) {
      // short march toward the light for self-shadowing
      float shadow = 1.0;
      float lstep = uP_radius / float(LIGHT_STEPS);
      for (int k = 1; k <= LIGHT_STEPS; k++) {
        vec3 lp = p + L * (float(k) - 0.5) * lstep;
        shadow *= exp(-density(lp, animTime) * lstep * uP_shadowAbsorb);
      }

      /*
        In-scattered light: warm where lit, cool where the volume shadows
        itself.

        The shadow term appears ONCE, inside the mix. Multiplying by it again
        as a factor — the obvious-looking thing to write — scales the shadowed
        end of the mix toward zero, so the cool colour is always multiplied
        away and the cloud comes out monochrome beige however it is tinted.
        uP_shadowLift is how much light still reaches the shadowed side.
      */
      vec3 lit = mix(uC_shadow * uP_shadowLift, uC_light, shadow* 0.6);
      scattered += T * dn * dt * lit * phase * nimbusPower;

      T *= exp(-dn * dt * uP_absorb);
      if (T < 0.01) break;
    }
  }

  // a soft ambient body so the unlit side is not pure black
  float body = 1.0 - T;
  scattered += uC_shadow * body * uP_ambient;

  return vec4(scattered, body);
}

void main() {
  /*
    Agent output turns the light up; user input thickens the cloud. Both are
    AMPLITUDES. Churn is deliberately NOT volume-scaled: it multiplies the
    accumulated clock into a phase (animTime * churn), so scaling it by the
    live volume would turn every volume wobble into a phase jump the size of
    the whole clock — the cloud scrambles chaotically on each state change
    instead of gliding, and gets worse the longer the page is open.
  */
  nimbusPower = uP_power * (0.7 + 0.9 * uOutput);
  nimbusDensity = uP_density * (1.0 + 0.35 * uInput);

  vec4 acc = vec4(0.0);
#if AA > 1
  for (int mx = 0; mx < AA; mx++) {
    for (int my = 0; my < AA; my++) {
      vec2 offset = vec2(float(mx), float(my)) / float(AA) - 0.5;
      acc += nimbusRender(gl_FragCoord.xy + offset);
    }
  }
  acc /= float(AA * AA);
#else
  acc = nimbusRender(gl_FragCoord.xy);
#endif

  // Tone-map intrinsic cloud color before applying coverage alpha.
  vec3 cloudColor = acc.rgb / max(acc.a, 0.0001);
  vec3 col = tanh3(cloudColor * uP_exposure);
  float a = clamp(acc.a * uP_alphaGain, 0.0, 1.0);

  // Valid premultiplied alpha prevents bright low-alpha edges washing out.
  vec3 premultipliedColor = col * a;
  gl_FragColor = vec4(premultipliedColor + mix(vec3(1.0), vec3(0.0, 1.0, 0.0), uDebugGreen) * (1.0-a) * (1.0-uTransparent), mix(1.0,a,uTransparent));
}
`
export function Shdr21LogoVolume({ narrowing = 0.09, paused = false, transparent = false, canvasPadding = 1, debugGreen = false, style }: { narrowing?: number; paused?: boolean; transparent?: boolean; canvasPadding?: number; debugGreen?: boolean; style?: CSSProperties }){
 const [webglUnavailable,setWebglUnavailable]=useState(false)
 const ref=useRef<HTMLCanvasElement>(null)
 const narrowingRef=useRef(narrowing)
 const pausedRef=useRef(paused)
 const transparentRef=useRef(transparent)
 const paddingRef=useRef(canvasPadding)
 const debugGreenRef=useRef(debugGreen)
 useEffect(()=>{debugGreenRef.current=debugGreen},[debugGreen])
 useEffect(()=>{paddingRef.current=canvasPadding},[canvasPadding])
 useEffect(()=>{pausedRef.current=paused;transparentRef.current=transparent},[paused,transparent])
 useEffect(()=>{narrowingRef.current=narrowing},[narrowing])
 useEffect(()=>{
  const canvas=ref.current;if(!canvas)return
  let gl: WebGLRenderingContext | null = null
  try {
   gl=canvas.getContext("webgl",{alpha:true,antialias:false,premultipliedAlpha:true})
   if(!gl)gl=canvas.getContext("webgl")
  } catch { /* Some browsers disable WebGL context creation entirely. */ }
  if(!gl){setWebglUnavailable(true);return}
  function compile(kind:number,source:string){
   const shader=gl!.createShader(kind);if(!shader)throw Error("Shader allocation failed")
   gl!.shaderSource(shader,source);gl!.compileShader(shader)
   if(!gl!.getShaderParameter(shader,gl!.COMPILE_STATUS))throw Error(gl!.getShaderInfoLog(shader)??"Shader compile failed")
   return shader
  }
  const vs=compile(gl.VERTEX_SHADER,vertexSource),fs=compile(gl.FRAGMENT_SHADER,fragmentSource)
  const program=gl.createProgram();if(!program)return
  gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program)
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program)??"Shader link failed")
  gl.useProgram(program)
  const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer)
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW)
  const pos=gl.getAttribLocation(program,"aPosition");gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0)
  const resolution=gl.getUniformLocation(program,"uResolution"),time=gl.getUniformLocation(program,"uTime")
  const narrowingUniform=gl.getUniformLocation(program,"uNarrowing")
  const transparentUniform=gl.getUniformLocation(program,"uTransparent")
  const paddingUniform=gl.getUniformLocation(program,"uCanvasPadding")
  const debugGreenUniform=gl.getUniformLocation(program,"uDebugGreen")
  let raf=0,checked=false;const start=performance.now()
  let elapsed=0,last=start
  let lastSettings = ""
  function draw(now:number){
   if(!canvas||!gl)return
   if(!pausedRef.current)elapsed+=Math.max(0,now-last)/1000
   last=now
   const settings = [canvas.clientWidth,canvas.clientHeight,narrowingRef.current,transparentRef.current,paddingRef.current,debugGreenRef.current].join(":")
   if (checked && pausedRef.current && settings === lastSettings) { raf=requestAnimationFrame(draw); return }
   lastSettings=settings
   const dpr=Math.min(window.devicePixelRatio||1,1.5)
   const w=Math.max(1,Math.round(canvas.clientWidth*dpr)),h=Math.max(1,Math.round(canvas.clientHeight*dpr))
   if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}
   gl.viewport(0,0,w,h);gl.useProgram(program);gl.uniform2f(resolution,w,h);gl.uniform1f(time,elapsed)
   gl.uniform1f(narrowingUniform,narrowingRef.current)
   gl.uniform1f(transparentUniform,transparentRef.current?1:0)
   gl.uniform1f(paddingUniform,paddingRef.current)
   gl.uniform1f(debugGreenUniform,debugGreenRef.current?1:0)
   gl.drawArrays(gl.TRIANGLES,0,3)
   if(!checked){const pixel=new Uint8Array(4);gl.readPixels(Math.floor(w/2),Math.floor(h*0.2),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);console.info("[shdr21-logo] Logo body pixel RGBA:",Array.from(pixel),"WebGL error:",gl.getError());checked=true}
   raf=requestAnimationFrame(draw)
  }
  draw(start)
  return()=>{cancelAnimationFrame(raf);gl.deleteBuffer(buffer);gl.deleteProgram(program);gl.deleteShader(vs);gl.deleteShader(fs)}
 },[])
 if(webglUnavailable)return <div role="img" aria-label="Omi Logo" style={{display:"grid",placeItems:"center",background:debugGreen?"#00ff00":transparent?"transparent":"#fff",width:"min(560px, 90vw, 90svh)",height:"min(560px, 90vw, 90svh)",...style}}><span style={{display:"block",width:`${100/(1.08*Math.max(canvasPadding,0.01))}%`,aspectRatio:"1",background:`linear-gradient(135deg, ${LOGO_COLORS.light}, ${LOGO_COLORS.shadow})`,mask:"url(/OmiLogo.svg) center / contain no-repeat",WebkitMask:"url(/OmiLogo.svg) center / contain no-repeat"}} /></div>
 return <canvas ref={ref} role="img" aria-label="SHDR-21 Omi Logo cloud volume" style={{display:"block",background:debugGreen?"#00ff00":"transparent",width:"min(560px, 90vw, 90svh)",height:"min(560px, 90vw, 90svh)",...style}}/>
}
