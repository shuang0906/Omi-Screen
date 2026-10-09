"use client"
// @refresh reset
// SHDR-11 Hydrogen by zzzzshawn (MIT), adapted to the center motion silhouette.
// https://github.com/zzzzshawn/orbkit/blob/main/orbs/orbs/shdr-11.tsx
import { useEffect, useRef, useState, type CSSProperties } from "react"
import { shdr11Orb } from "@/components/ui/shdr-11"
import { ORB_GLSL_HELPERS } from "@/components/ui/orbkit-core"

const vertexSource = `attribute vec2 aPosition; void main(){gl_Position=vec4(aPosition,0.0,1.0);}`
const geometry = `
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

`
// Official Hydrogen flow and lighting, clipped to the animated logo silhouette.
const helpers = ORB_GLSL_HELPERS
 .replace(/^uniform .*$/gm, "")
 .replace(/vec2 orbUV\(\) \{[^}]*\}/, "")
const parameters = shdr11Orb.params.map(p => p.integrate
 ? `#define uP_${p.key} (uTime * ${p.default.toFixed(6)})`
 : `const float uP_${p.key} = ${p.default.toFixed(6)};`
).join("\n")
const hydrogen = shdr11Orb.frag
 .replace("vec2 uv = orbUV();", "vec2 uv = (2.0 * gl_FragCoord.xy - uResolution) / min(uResolution.x, uResolution.y) * 1.08 * uCanvasPadding * uP_radius;")
 .replace("float mask = smoothstep(0.012, -0.012, r2d - R);", "float distanceToLogo = logoPlanarDistance(uv / R) + uNarrowing; float mask = 1.0 - smoothstep(-0.14, 0.14, distanceToLogo); if(mask <= 0.0){ gl_FragColor = vec4(mix(vec3(1.0), vec3(0.0,1.0,0.0), uDebugGreen) * (1.0-uTransparent), 1.0-uTransparent); return; }")
 .replace("gl_FragColor = vec4(surfaceColor * a, a);", "vec3 background = mix(vec3(1.0), vec3(0.0,1.0,0.0), uDebugGreen); gl_FragColor = vec4(surfaceColor * a + background * (1.0-a) * (1.0-uTransparent), mix(1.0,a,uTransparent));")
const fragmentSource = `
precision highp float;
uniform vec2 uResolution;
uniform float uTime;
uniform float uMotionTime;
uniform float uMotionStrength;
uniform float uNarrowing;
uniform float uTransparent;
uniform float uDebugGreen;
uniform float uCanvasPadding;
const float uInput = 0.0;
const float uOutput = 0.6;
${parameters}
${helpers}
${geometry}
${hydrogen}
`
export function Shdr11LogoCenterMotion({ motionSpeed = 1, motionStrength = 0, narrowing = 0.04, paused = false, transparent = false, canvasPadding = 1, debugGreen = false, style }: { motionSpeed?: number; motionStrength?: number; narrowing?: number; paused?: boolean; transparent?: boolean; canvasPadding?: number; debugGreen?: boolean; style?: CSSProperties }){
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
   if(!checked){const pixel=new Uint8Array(4);gl.readPixels(Math.floor(w/2),Math.floor(h*0.2),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);console.info("[shdr11-logo] Logo body pixel RGBA:",Array.from(pixel),"WebGL error:",gl.getError());checked=true}
   raf=requestAnimationFrame(draw)
  }
  draw(start)
  return()=>{cancelAnimationFrame(raf);gl.deleteBuffer(buffer);gl.deleteProgram(program);gl.deleteShader(vs);gl.deleteShader(fs)}
 },[])
 if(webglUnavailable)return <div role="img" aria-label="Omi Logo" style={{display:"grid",placeItems:"center",background:debugGreen?"#00ff00":transparent?"transparent":"#fff",width:"min(560px, 90vw, 90svh)",height:"min(560px, 90vw, 90svh)",...style}}><span style={{display:"block",width:`${100/(1.08*Math.max(canvasPadding,0.01))}%`,aspectRatio:"1",background:"linear-gradient(135deg, #f5b0ea, #a6c7ff, #d7efbd)",mask:"url(/OmiLogo.svg) center / contain no-repeat",WebkitMask:"url(/OmiLogo.svg) center / contain no-repeat"}} /></div>
 return <canvas ref={ref} role="img" aria-label="SHDR-11 Omi Logo wave circle" style={{display:"block",background:debugGreen?"#00ff00":"transparent",width:"min(560px, 90vw, 90svh)",height:"min(560px, 90vw, 90svh)",...style}}/>
}
