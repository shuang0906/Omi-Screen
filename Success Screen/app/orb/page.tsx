"use client"
import { useState } from "react"
import { Shdr21LogoVolume } from "@/components/ui/shdr21-logo-volume-light"

export default function OrbPage(){
 const [narrowing,setNarrowing]=useState(0.09)
 const [debugGreen,setDebugGreen]=useState(false)
 return <main style={{position:"fixed",inset:0,display:"grid",placeItems:"center",background:"#ffffff",overflow:"hidden"}}>
  <div style={{position:"relative",width:"min(560px, 90vw, 90svh)",height:"min(560px, 90vw, 90svh)"}}>
   <Shdr21LogoVolume narrowing={narrowing} debugGreen={debugGreen} canvasPadding={1.4} style={{position:"absolute",left:"50%",top:"50%",transform:"translate(-50%, -50%)",width:"140%",height:"140%"}}/>
  </div>
  <div style={{position:"absolute",bottom:24,left:"50%",transform:"translateX(-50%)",display:"flex",alignItems:"center",gap:12,padding:"14px 18px",background:"#222",border:"1px solid #444",borderRadius:12,color:"#eee",maxWidth:"calc(100vw - 32px)",flexWrap:"wrap",fontSize:14}}>
   <label><input type="checkbox" role="switch" checked={debugGreen} onChange={e=>setDebugGreen(e.target.checked)}/> Green 背景</label>
   <label htmlFor="logo-narrowing">Logo 收窄</label>
   <input id="logo-narrowing" type="range" min="0" max="0.18" step="0.005" value={narrowing} onChange={e=>setNarrowing(Number(e.target.value))} style={{width:"min(200px, 40vw)",accentColor:"#ffd7a3"}}/>
   <output htmlFor="logo-narrowing" style={{fontVariantNumeric:"tabular-nums",minWidth:44}}>{narrowing.toFixed(3)}</output>
   <button onClick={()=>setNarrowing(0.09)} style={{padding:"4px 10px",border:"1px solid #666",borderRadius:6,cursor:"pointer"}}>重置</button>
  </div>
 </main>
}
