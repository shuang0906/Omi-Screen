"use client"
import { useEffect, useRef } from "react"
const vertexSource = `attribute vec2 aPosition; void main(){gl_Position=vec4(aPosition,0.0,1.0);}`
const fragmentSource = `
precision highp float;
uniform vec2 uResolution;
uniform float uTime;
void logoEdge(vec2 p,vec2 a,vec2 b,inout float minSq,inout float signValue){
 vec2 edge=b-a;vec2 w=p-a;float h=clamp(dot(w,edge)/max(dot(edge,edge),0.000001),0.0,1.0);vec2 q=w-edge*h;minSq=min(minSq,dot(q,q));
 if((a.y>p.y)!=(b.y>p.y)){if(p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)signValue=-signValue;}
}
float logoDistance(vec2 p){
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
void main(){
 vec2 uv=(2.0*gl_FragCoord.xy-uResolution)/min(uResolution.x,uResolution.y);
 vec3 ro=vec3(uv*1.12,-3.0);
 vec3 rd=vec3(0.0,0.0,1.0);
 vec3 bg=vec3(0.067);
 float planar=logoDistance(ro.xy);
 if(planar>=0.0){gl_FragColor=vec4(bg,1.0);return;}
 float nearT=2.7,farT=3.3;
 float dt=(farT-nearT)/48.0;
 float T=1.0;vec3 light=vec3(0.0);
 for(int i=0;i<48;i++){
  vec3 p=ro+rd*(nearT+(float(i)+0.5)*dt);
  float shell=smoothstep(0.0,0.075,-planar)*smoothstep(0.0,0.12,0.3-abs(p.z));
  float cloud=0.65+0.35*sin(p.x*7.0+uTime)*sin(p.y*6.0-uTime*0.7)*sin(p.z*8.0+uTime*0.4);
  float density=shell*cloud*5.0;
  float absorbed=1.0-exp(-density*dt);
  float brightness=0.65+0.35*clamp(p.y*0.5+0.5,0.0,1.0);
  vec3 tint=mix(vec3(0.58,0.29,0.10),vec3(1.0,0.84,0.64),brightness);
  light+=T*absorbed*tint*1.5;T*=1.0-absorbed;
 }
 gl_FragColor=vec4(light+T*bg,1.0);
}`
export function BasicCloudVolume(){
 const ref=useRef<HTMLCanvasElement>(null)
 useEffect(()=>{
  const canvas=ref.current;if(!canvas)return
  const gl=canvas.getContext("webgl",{alpha:false,antialias:false})
  if(!gl){console.error("[basic-volume] WebGL unavailable");return}
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
  let raf=0,checked=false;const start=performance.now()
  function draw(now:number){
   if(!canvas||!gl)return
   const dpr=Math.min(window.devicePixelRatio||1,1.5)
   const w=Math.max(1,Math.round(canvas.clientWidth*dpr)),h=Math.max(1,Math.round(canvas.clientHeight*dpr))
   if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}
   gl.viewport(0,0,w,h);gl.useProgram(program);gl.uniform2f(resolution,w,h);gl.uniform1f(time,(now-start)/1000)
   gl.drawArrays(gl.TRIANGLES,0,3)
   if(!checked){const pixel=new Uint8Array(4);gl.readPixels(Math.floor(w/2),Math.floor(h*0.2),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);console.info("[basic-volume] Logo body pixel RGBA:",Array.from(pixel),"WebGL error:",gl.getError());checked=true}
   raf=requestAnimationFrame(draw)
  }
  draw(start)
  return()=>{cancelAnimationFrame(raf);gl.deleteBuffer(buffer);gl.deleteProgram(program);gl.deleteShader(vs);gl.deleteShader(fs)}
 },[])
 return <canvas ref={ref} role="img" aria-label="Omi Logo cloud volume" style={{display:"block",width:"min(560px, 90vw, 90svh)",height:"min(560px, 90vw, 90svh)"}}/>
}
