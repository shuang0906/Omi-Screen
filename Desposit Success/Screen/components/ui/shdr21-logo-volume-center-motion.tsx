"use client"

// Recreate the WebGL canvas and program after edits during development.
// @refresh reset
import { useEffect, useRef, useState, type CSSProperties } from "react"

// Edit these HEX colors; they are converted to shader RGB automatically.
const LOGO_COLORS = {
  light: "#a5fffa",
  shadow: "#6d9fc8",
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
uniform float uMotionTime;
uniform float uMotionStrength;
uniform float uNarrowing;
uniform float uTransparent;
uniform float uDebugGreen;
uniform float uCanvasPadding;
const float logoEdgeSoftness = 0.28;
#define uRes uResolution
#define uP_speed (uTime * 1.2 * 0.856)
const float uInput=0.0;
const float uOutput=0.6;
const vec3 uC_light = vec3(${hexToShaderRgb(LOGO_COLORS.light)});
const vec3 uC_shadow = vec3(${hexToShaderRgb(LOGO_COLORS.shadow)});
const float uP_radius = 2.000000;
const float uP_depth = 0.8;
const float uP_scale = 1.00000;
const float uP_churn = 0.100000;
const float uP_threshold = 0.015000;
const float uP_edgeSoft = 2.0000;
const float uP_camDist = 4.400000;
const float uP_focal = 1.800000;
const float uP_lightSpin = 0.120000;
const float uP_aniso = 0.20000;
const float uP_shadowAbsorb = 5.400000;
const float uP_shadowLift = 0.8000;
const float uP_absorb = 1.400000;
const float uP_power = 1.500000;
const float uP_density = 3.200000;
const float uP_ambient = 0.120000;
const float uP_exposure = 0.70000;
const float uP_alphaGain = 1.0000;
vec3 tanh3(vec3 x){x=clamp(x,-10.0,10.0);vec3 e=exp(2.0*x);return(e-1.0)/(e+1.0);}


// Organic wave circle: five balanced Gaussian peaks and a fixed circular hole.
float localPeak(float angle, float center, float amplitude, float width) {
 float d=atan(sin(angle-center),cos(angle-center));
 return amplitude*exp(-pow(d/width,2.0));
}
float logoPlanarDistance(vec2 p){
 vec2 q=vec2(p.x,-p.y)*170.0;
 float angle=atan(q.y,q.x);
 float t=uMotionTime*0.625;
 float drift=-t*0.80;
 // Five evenly spaced lobes (72 degrees apart), with subtle organic variation.
 // Subtract their mean contribution to keep the circle's average radius stable.
 float peaks=-17.72
  +localPeak(angle,0.000000+drift,21.0,0.60)
  +localPeak(angle,1.256637+drift,22.0,0.59)
  +localPeak(angle,2.513274+drift,20.5,0.61)
  +localPeak(angle,3.769911+drift,21.5,0.60)
  +localPeak(angle,5.026548+drift,20.0,0.59);
 float baseAngle=angle-0.785398;
 float base=9.0*sin(baseAngle-3.15+t*0.3)
  +7.5*sin(baseAngle*3.0-1.2-t*0.45)
  +4.0*cos(baseAngle-0.72+t*0.2);
 float micro=2.2*sin(angle*4.0-t*1.2)+1.2*sin(angle*7.0-t*0.9);
 float radius=151.0+peaks+uMotionStrength*(base+micro);
 float outer=(length(q)-radius)/170.0;
 float hole=(85.5-length(q-vec2(-7.0,-3.0)))/170.0;
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
  float stableClump = mix(0.3, 1.0, clump);
  return stableClump * pow(shell, uP_edgeSoft) * nimbusDensity;
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
export function Shdr21LogoVolumeCenterMotion({ motionSpeed = 1, motionStrength = 0, narrowing = 0.04, paused = false, transparent = false, canvasPadding = 1, debugGreen = false, style }: { motionSpeed?: number; motionStrength?: number; narrowing?: number; paused?: boolean; transparent?: boolean; canvasPadding?: number; debugGreen?: boolean; style?: CSSProperties }){
 const [webglUnavailable,setWebglUnavailable]=useState(false)
 const motionRef=useRef({speed:motionSpeed,strength:motionStrength})
 useEffect(()=>{motionRef.current={speed:motionSpeed,strength:motionStrength}},[motionSpeed,motionStrength])
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
  const motionTimeUniform=gl.getUniformLocation(program,"uMotionTime")
  const motionStrengthUniform=gl.getUniformLocation(program,"uMotionStrength")
 const narrowingUniform=gl.getUniformLocation(program,"uNarrowing")
  const transparentUniform=gl.getUniformLocation(program,"uTransparent")
  const paddingUniform=gl.getUniformLocation(program,"uCanvasPadding")
  const debugGreenUniform=gl.getUniformLocation(program,"uDebugGreen")
  let raf=0,checked=false;const start=performance.now()
  let elapsed=0,motionElapsed=0,last=start
  let lastSettings = ""
  function draw(now:number){
   if(!canvas||!gl)return
   if(!pausedRef.current){
    const dt=Math.min(0.1,Math.max(0,now-last)/1000)
    elapsed+=dt
    motionElapsed+=dt*motionRef.current.speed
   }
   last=now
   const settings = [canvas.clientWidth,canvas.clientHeight,narrowingRef.current,transparentRef.current,paddingRef.current,debugGreenRef.current,motionRef.current.speed,motionRef.current.strength].join(":")
   if (checked && pausedRef.current && settings === lastSettings) { raf=requestAnimationFrame(draw); return }
   lastSettings=settings
   const dpr=Math.min(window.devicePixelRatio||1,1.5)
   const w=Math.max(1,Math.round(canvas.clientWidth*dpr)),h=Math.max(1,Math.round(canvas.clientHeight*dpr))
   if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}
   gl.viewport(0,0,w,h);gl.useProgram(program);gl.uniform2f(resolution,w,h);gl.uniform1f(time,elapsed)
   gl.uniform1f(motionTimeUniform,motionElapsed)
   gl.uniform1f(motionStrengthUniform,motionRef.current.strength)
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
