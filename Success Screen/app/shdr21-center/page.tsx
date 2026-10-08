"use client"
import { useEffect, useRef, useState } from "react"
import { Shdr21 } from "@/components/ui/shdr-21"
import { Shdr21LogoVolumeCenter } from "@/components/ui/shdr21-logo-volume-light-center"
import "./orb-version.css"
import "./glow-center.css"
const clamp = (x: number) => Math.max(0, Math.min(1, x))
type Easing = "ease-in" | "ease-out"
const ascentEase = (value: number, easing: Easing, strength: number) => {
  const x = clamp(value)
  return easing === "ease-in" ? Math.pow(x, strength) : 1 - Math.pow(1 - x, strength)
}
export default function Page() {
  const glowRef = useRef<HTMLDivElement>(null),
    screenRef = useRef<HTMLDivElement>(null),
    underRef = useRef<HTMLDivElement>(null),
    messageRef = useRef<HTMLDivElement>(null),
    labelRef = useRef<HTMLSpanElement>(null)
  const clock = useRef({
    time: 0,
    phase: "idle" as "idle" | "entering" | "ready",
    last: 0,
    paused: false,
    speed: 1,
    easing: "ease-out" as Easing,
    easeStrength: 3,
  })
  const [paused, setPaused] = useState(false)
  const [phase, setPhase] = useState<"idle" | "entering" | "ready">("idle")
  const [debugGreen, setDebugGreen] = useState(false)
  const [easing, setEasing] = useState<Easing>("ease-out")
  const [easeStrength, setEaseStrength] = useState(3)
  const [shape, setShape] = useState<"sphere" | "logo">("logo")
  function replay() {
    clock.current.time = 0
    clock.current.phase = "idle"
    setPhase("idle")
    clock.current.last = performance.now()
    clock.current.paused = false
    setPaused(false)
  }
  function confirm() {
    if (clock.current.phase !== "idle") return
    clock.current.phase = "entering"
    clock.current.time = 0
    clock.current.last = performance.now()
    clock.current.paused = false
    setPaused(false)
    setPhase("entering")
  }
  function jumpToCenter() {
    clock.current.phase = "ready"
    clock.current.time = 0
    clock.current.last = performance.now()
    clock.current.paused = false
    setPaused(false)
    setPhase("ready")
  }
  function togglePause() {
    clock.current.paused = !clock.current.paused
    setPaused(clock.current.paused)
  }
  useEffect(() => {
    let raf = 0,
      shown = false,
      switching = false
    let previousPhase: typeof clock.current.phase | null = null
    let blurAnimation: Animation | null = null
    clock.current.last = performance.now()
    function frame(now: number) {
      const c = clock.current
      if (!c.paused) {
        if (c.phase === "entering") c.time += (now - c.last) * c.speed
      }
      c.last = now
      if (c.phase === "entering" && c.time >= 1500) {
        c.phase = "ready"
        c.time = 0
        setPhase("ready")
      }

      const phaseChanged = previousPhase !== c.phase
      if (phaseChanged) {
        blurAnimation?.cancel()
        blurAnimation = null
        if (underRef.current) {
          underRef.current.style.pointerEvents = c.phase === "idle" ? "auto" : "none"
          underRef.current.style.filter = c.phase === "idle" || c.phase === "entering" ? "blur(0)" : "blur(1.05cqw)"
          underRef.current.style.opacity = c.phase === "idle" || c.phase === "entering" ? "1" : "0.28"
          if (c.phase === "entering") {
            blurAnimation = underRef.current.animate([{filter:"blur(0)",opacity:1},{filter:"blur(1.05cqw)",opacity:0.28}],{duration:800,easing:"ease-in-out",fill:"forwards"})
          }
        }
        previousPhase = c.phase
      }
      if (blurAnimation) {
        if (c.paused && blurAnimation.playState === "running") blurAnimation.pause()
        else if (!c.paused && blurAnimation.playState === "paused") blurAnimation.play()
      }
      if (!phaseChanged && (c.phase === "idle" || c.phase === "ready" || c.paused)) {
        raf = requestAnimationFrame(frame)
        return
      }
      const t = c.time
      const entrance = c.phase === "idle" ? 0 : c.phase === "entering" ? ascentEase(t / 1500, c.easing, c.easeStrength) : 1
      if (glowRef.current) {
        const top = 150 - 100 * entrance
        glowRef.current.style.top = `${top}%`
        glowRef.current.style.transform = "translate(-50%, -50%)"
        glowRef.current.style.opacity = String(entrance)
      }
      if (c.phase === "idle") {
        messageRef.current?.getAnimations().forEach(animation => animation.cancel())
        shown = false
        switching = false
        screenRef.current?.classList.remove("success")
        if (labelRef.current) labelRef.current.textContent = "Deposit pending"
      }
      if (messageRef.current && !switching) messageRef.current.style.opacity = String(entrance)
      const done = c.phase === "ready"
      if (done !== shown && !switching && messageRef.current) {
        // Quick blur out → swap copy/icon → blur in
        const msg = messageRef.current
        const target = done
        switching = true
        msg
          .animate([{ filter: "blur(0px)", opacity: 1 }, { filter: "blur(8px)", opacity: 0 }], {
            duration: 150,
            easing: "ease-in",
            fill: "forwards",
          })
          .finished.then(() => {
            if (clock.current.phase === "idle") return
            shown = target
            screenRef.current?.classList.toggle("success", target)
            if (labelRef.current)
              labelRef.current.textContent = target ? "Deposit complete" : "Deposit pending"
            return msg.animate([{ filter: "blur(8px)", opacity: 0 }, { filter: "blur(0px)", opacity: 1 }], {
              duration: 180,
              easing: "ease-out",
              fill: "forwards",
            }).finished
          })
          .catch(() => {})
          .finally(() => {
            switching = false
          })
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement).matches("input,select,button")) return
      if (e.code === "Space") {
        e.preventDefault()
        togglePause()
      }
      if (e.key.toLowerCase() === "r") replay()
    }
    document.addEventListener("keydown", onKey)
    return () => {
      cancelAnimationFrame(raf)
      blurAnimation?.cancel()
      messageRef.current?.getAnimations().forEach(animation => animation.cancel())
      document.removeEventListener("keydown", onKey)
    }
  }, [])
  return (
    <div className="version-shell">
      <main className="stage">
        <button onClick={replay} className="back" aria-label="Replay animation">
          ⟵
        </button>
        <div className="phone">
          <div className="screen" ref={screenRef}>
            <div className="underlying" ref={underRef}>
              <div className="review">
                <header className="review-header">
                  <span className="review-back">
                    <img src="/review/back.svg" alt="" width={16} height={16} />
                  </span>
                  <p>Review</p>
                </header>
                <div className="review-body">
                  <p className="review-amount">$100</p>
                  <div className="review-details">
                    <div className="review-route">
                      <div className="review-party">
                        <span className="review-avatar">O</span>
                        <div className="review-party-text">
                          <p>Omi</p>
                          <p>•••• 2874</p>
                        </div>
                        <p className="review-dir">From</p>
                      </div>
                      <div className="review-connector">
                        <i></i>
                      </div>
                      <div className="review-party">
                        <span className="review-avatar earn">E</span>
                        <div className="review-party-text">
                          <p>Earn</p>
                          <p>Lending market</p>
                        </div>
                        <p className="review-dir">To</p>
                      </div>
                    </div>
                    <div className="review-rows">
                      <div className="review-row">
                        <span className="review-label">
                          Estimated APY
                          <img src="/review/info.svg" alt="" width={13} height={13} />
                        </span>
                        <span className="positive">42.5%</span>
                      </div>
                      <div className="review-row">
                        <span className="review-label">Transfer time</span>
                        <span>Instant</span>
                      </div>
                    </div>
                    <hr className="review-divider" />
                    <div className="review-rows">
                      <div className="review-row">
                        <span className="review-label">Deposit</span>
                        <span>$99.00</span>
                      </div>
                      <div className="review-row">
                        <span className="review-label">Fee</span>
                        <span>$1.00</span>
                      </div>
                      <div className="review-row">
                        <span className="review-label">Total</span>
                        <span>$100.00</span>
                      </div>
                    </div>
                  </div>
                </div>
                <footer className="review-footer">
                  <p className="review-disclaimer">
                    APY is variable and may change by the time the transaction is processed.
                  </p>
                  <button type="button" className="review-confirm" onClick={confirm} disabled={phase !== "idle"}>Confirm</button>
                </footer>
              </div>
            </div>
            <div className="glow-center" ref={glowRef}>
              <div className="orb-shape">
              {shape === "logo" ? (
                <Shdr21LogoVolumeCenter debugGreen={debugGreen} paused={paused || phase === "idle"} transparent canvasPadding={1.4} style={{position:"absolute",left:"50%",top:"50%",transform:"translate(-50%, -50%)",width:"140%",height:"140%"}} />
              ) : (
              <Shdr21
                shape="sphere"
                size={280}
                state="speaking"
                params={{ speed: 10.2, edgeSoft: 1.5, radius: 2 }}
                colors={{ light: "#ffd7a3", shadow: "#ff57e3" }}
                stateColors={{
                  idle: { light: "#ffd7a3", shadow: "#a87542" },
                  thinking: { light: "#ffd7a3", shadow: "#a87542" },
                  speaking: { light: "#ffd7a3", shadow: "#a87542" },
                }}
                statePresets={{
                  idle: { speed: 10 },
                  thinking: { speed: 10.2 },
                  speaking: { speed: 10.4 },
                }}
                stateVolumes={{
                  idle: { input: 0, output: 0.2 },
                  thinking: { input: 0.1, output: 0.45 },
                  speaking: { input: 0.2, output: 0.8 },
                }}
                volumes={{ input: 0, output: 0.6 }}
                paused={paused || phase === "idle"}
                pauseOffscreen
                maxDpr={1.5}
                ariaLabel="Assistant status"
                style={{ width: "100%", height: "100%" }}
              />
              )}
              </div>
            </div>
            <div className="page-ui">
              <div className="island"></div>
              <div className="status">
                <span className="status-time">9:41</span>
                <span className="status-icon signal"></span>
                <span className="status-icon wifi"></span>
                <span className="status-icon battery"></span>
              </div>
            </div>
            <div className="message" role="status" ref={messageRef}>
              <span className="spinner"></span>
              <span className="check">✓</span>
              <span ref={labelRef}>Deposit pending</span>
            </div>
          </div>
        </div>
      </main>
      <div className="controls">
        <label><input type="checkbox" role="switch" checked={debugGreen} onChange={e=>setDebugGreen(e.target.checked)} /> Green 背景</label>
        <button onClick={replay}>Replay</button>
        <button onClick={jumpToCenter}>直接到中间</button>
        <label>Ease{" "}
          <select value={easing} onChange={e => {
            const value = e.target.value as Easing
            clock.current.easing = value
            setEasing(value)
          }}>
            <option value="ease-in">Ease-in</option>
            <option value="ease-out">Ease-out</option>
          </select>
        </label>
        <label htmlFor="ease-strength">Ease 强度{" "}
          <input id="ease-strength" type="range" min="1" max="10" step="0.1" value={easeStrength} onChange={e => {
            const value = Number(e.target.value)
            clock.current.easeStrength = value
            setEaseStrength(value)
          }} style={{width:100,verticalAlign:"middle"}} />
          <output htmlFor="ease-strength" style={{display:"inline-block",minWidth:28,marginLeft:6,fontVariantNumeric:"tabular-nums"}}>{easeStrength.toFixed(1)}</output>
        </label>
        <label>Shape{" "}
          <select value={shape} onChange={(e) => setShape(e.target.value as "sphere" | "logo")}>
            <option value="sphere">球形</option>
            <option value="logo">Omi Logo</option>
          </select>
        </label>
        <button onClick={togglePause}>{paused ? "Play" : "Pause"}</button>
        <label>
          Speed{" "}
          <select
            defaultValue="1"
            onChange={(e) => {
              clock.current.speed = Number(e.target.value)
            }}
          >
            <option value="1">1×</option>
            <option value="0.1">0.1×</option>
            <option value="0.25">0.25×</option>
            <option value="0.5">0.5×</option>
          </select>
        </label>

      </div>
    </div>
  )
}
