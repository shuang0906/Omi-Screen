"use client"
// @refresh reset
// Inflated mesh sections follow Omi Logo Generator/3d/inflated.html.
// SHDR-11 Hydrogen by zzzzshawn (MIT); see orbkit-LICENSE.
import { useEffect, useRef, useState, type CSSProperties } from "react"
import { shdr11Orb } from "@/components/ui/shdr-11"
import { ORB_GLSL_HELPERS } from "@/components/ui/orbkit-core"

const RING_SEGMENTS = 240
const TUBE_SEGMENTS = 48
function createRingMesh() {
 const angles = new Float32Array(RING_SEGMENTS * TUBE_SEGMENTS * 2)
 const indices = new Uint16Array(RING_SEGMENTS * TUBE_SEGMENTS * 6)
 let cursor = 0
 for (let i = 0; i < RING_SEGMENTS; i++) {
  for (let j = 0; j < TUBE_SEGMENTS; j++) {
   const a = i * TUBE_SEGMENTS + j
   angles[a * 2] = i / RING_SEGMENTS * Math.PI * 2
   angles[a * 2 + 1] = j / TUBE_SEGMENTS * Math.PI * 2
   const b = i * TUBE_SEGMENTS + (j + 1) % TUBE_SEGMENTS
   const c = ((i + 1) % RING_SEGMENTS) * TUBE_SEGMENTS + (j + 1) % TUBE_SEGMENTS
   const d = ((i + 1) % RING_SEGMENTS) * TUBE_SEGMENTS + j
   indices.set([a, b, d, b, c, d], cursor)
   cursor += 6
  }
 }
 return { angles, indices }
}
const vertexSource = `
precision highp float;
attribute vec2 aPosition;
uniform vec2 uResolution;
uniform float uMotionTime;
uniform float uMotionStrength;
uniform float uNarrowing;
uniform float uCanvasPadding;
varying vec3 vSurface;
varying vec3 vNormal;
// Organic wave circle: five balanced Gaussian peaks and a fixed circular hole.
float localPeak(float angle, float center, float amplitude, float width) {
 float d=atan(sin(angle-center),cos(angle-center));
 return amplitude*exp(-pow(d/width,2.0));
}
float outerRadius(float angle){
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
 return radius - uNarrowing * 170.0;
}

// Closed elliptical tube, with the exact outer outline and circular throat.
vec3 ringSurface(vec2 angles) {
 float theta=angles.x, phi=angles.y;
 vec2 direction=vec2(cos(theta),sin(theta));
 vec2 outer=direction*outerRadius(theta);
 vec2 inner=vec2(-7.0,-3.0)+direction*(65.5+uNarrowing*170.0);
 // Expand tube thickness 10% outward, preserving the circular throat.
 outer=inner+(outer-inner)*1.10;
 vec2 middle=(outer+inner)*0.5;
 vec2 halfSection=(outer-inner)*0.5;
 vec2 xy=middle+halfSection*cos(phi);
 float depth=length(halfSection)*1.75*sin(phi);
 return vec3(xy.x,-xy.y,depth)/170.0;
}
vec3 viewRotation(vec3 p) {
 float yaw=0.18, pitch=-0.10;
 p=vec3(cos(yaw)*p.x+sin(yaw)*p.z,p.y,-sin(yaw)*p.x+cos(yaw)*p.z);
 return vec3(p.x,cos(pitch)*p.y-sin(pitch)*p.z,sin(pitch)*p.y+cos(pitch)*p.z);
}
void main() {
 vec3 p=ringSurface(aPosition);
 float e=0.001;
 vec3 tangent=ringSurface(aPosition+vec2(e,0.0))-ringSurface(aPosition-vec2(e,0.0));
 vec3 section=ringSurface(aPosition+vec2(0.0,e))-ringSurface(aPosition-vec2(0.0,e));
 vSurface=p;
 vNormal=viewRotation(normalize(cross(section,tangent)));
 vec3 viewPoint=viewRotation(p);
 vec2 aspect=min(uResolution.x,uResolution.y)/uResolution;
 gl_Position=vec4(viewPoint.xy*aspect/(1.08*uCanvasPadding),-viewPoint.z/3.0,1.0);
}
`
const helpers=ORB_GLSL_HELPERS.replace(/^uniform .*$/gm, "").replace(/vec2 orbUV\(\) \{[^}]*\}/, "")
const parameters=shdr11Orb.params.map(p=>p.integrate
 ? `#define uP_${p.key} (uTime * ${p.default.toFixed(6)})`
 : `const float uP_${p.key} = ${p.default.toFixed(6)};`
).join("\n")
// Keep Hydrogen's orbital interference and liquid flow, evaluated on the mesh.
// Surface lighting uses the ring's real normal; no environment maps or HDRI.
const hydrogen=shdr11Orb.frag
 .replace("vec2 uv = orbUV();", "vec2 uv = vSurface.xy * uP_radius;")
 .replace("float mask = smoothstep(0.012, -0.012, r2d - R);", "float mask = 1.0;")
 .replace("float z = sqrt(max(1.0 - nr * nr, 0.0));", "float z = max(normalize(vNormal).z, 0.0);")
 .replace("vec3 sp = vec3(uv / max(R, 0.001), z) * posScale;", "vec3 sp = vSurface * posScale;")
 .replace("vec3 normal = vec3(uv / max(R, 0.001), z);", "vec3 normal = normalize(vNormal);")
 .replace("float a = mask * visibility;", "float a = smoothstep(0.0, 1.5, max(normal.z, 0.0)); float diffuse = max(dot(normal, normalize(vec3(-0.6, 0.8, 1.5))), 0.0); float fill = max(dot(normal, normalize(vec3(0.8, -0.4, 0.7))), 0.0); surfaceColor *= 0.26 + 0.64 * diffuse + 0.20 * fill;")
const fragmentSource=`
precision highp float;
uniform float uTime;
varying vec3 vSurface;
varying vec3 vNormal;
const float uInput=0.0;
const float uOutput=0.6;
${parameters}
${helpers}
${hydrogen}
`
export function Shdr11LogoCenterMotion3D({ motionSpeed = 1, motionStrength = 0, narrowing = 0.04, paused = false, transparent = false, canvasPadding = 1, debugGreen = false, style }: { motionSpeed?: number; motionStrength?: number; narrowing?: number; paused?: boolean; transparent?: boolean; canvasPadding?: number; debugGreen?: boolean; style?: CSSProperties }){
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
   gl=canvas.getContext("webgl",{alpha:true,antialias:true,premultipliedAlpha:true})
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
  const mesh=createRingMesh()
  gl.bufferData(gl.ARRAY_BUFFER,mesh.angles,gl.STATIC_DRAW)
  const indexBuffer=gl.createBuffer()
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indexBuffer)
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,mesh.indices,gl.STATIC_DRAW)
  gl.enable(gl.DEPTH_TEST)
  gl.depthFunc(gl.LEQUAL)
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
   if(transparentRef.current)gl.clearColor(0,0,0,0)
   else if(debugGreenRef.current)gl.clearColor(0,1,0,1)
   else gl.clearColor(1,1,1,1)
   gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT)
   gl.drawElements(gl.TRIANGLES,mesh.indices.length,gl.UNSIGNED_SHORT,0)
   if(!checked){const pixel=new Uint8Array(4);gl.readPixels(Math.floor(w/2),Math.floor(h*0.2),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);console.info("[shdr11-logo] Logo body pixel RGBA:",Array.from(pixel),"WebGL error:",gl.getError());checked=true}
   raf=requestAnimationFrame(draw)
  }
  draw(start)
  return()=>{cancelAnimationFrame(raf);gl.deleteBuffer(indexBuffer);gl.deleteBuffer(buffer);gl.deleteProgram(program);gl.deleteShader(vs);gl.deleteShader(fs)}
 },[])
 if(webglUnavailable)return <div role="img" aria-label="Omi Logo" style={{display:"grid",placeItems:"center",background:debugGreen?"#00ff00":transparent?"transparent":"#fff",width:"min(560px, 90vw, 90svh)",height:"min(560px, 90vw, 90svh)",...style}}><span style={{display:"block",width:`${100/(1.08*Math.max(canvasPadding,0.01))}%`,aspectRatio:"1",background:"linear-gradient(135deg, #f5b0ea, #a6c7ff, #d7efbd)",mask:"url(/OmiLogo.svg) center / contain no-repeat",WebkitMask:"url(/OmiLogo.svg) center / contain no-repeat"}} /></div>
 return <canvas ref={ref} role="img" aria-label="SHDR-11 inflated 3D Omi ring" style={{display:"block",background:debugGreen?"#00ff00":"transparent",width:"min(560px, 90vw, 90svh)",height:"min(560px, 90vw, 90svh)",...style}}/>
}
