"use client"
import { useEffect, useRef, useState, type RefObject } from "react"
import { recordCanvas } from "@/lib/canvas-recording"

type Props = {
  containerRef: RefObject<HTMLElement | null>
  filename: string
  beforeStart?: () => void
  onRecordingChange?: (recording: boolean) => void
}
export function CanvasRecorder({ containerRef, filename, beforeStart, onRecordingChange }: Props) {
  const session = useRef<ReturnType<typeof recordCanvas> | null>(null)
  const alive = useRef(false)
  const busy = useRef(false)
  const downloadUrl = useRef("")
  const [state, setState] = useState<"idle" | "starting" | "recording" | "saving">("idle")
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState("")
  const [download, setDownload] = useState<{ url: string; name: string } | null>(null)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      session.current?.stop()
      if (downloadUrl.current) URL.revokeObjectURL(downloadUrl.current)
    }
  }, [])
  useEffect(() => {
    if (state !== "recording") return
    const start = performance.now()
    const timer = window.setInterval(() => setSeconds(Math.floor((performance.now() - start) / 1000)), 250)
    return () => window.clearInterval(timer)
  }, [state])
  async function start() {
    if (busy.current) return
    busy.current = true
    setError("")
    setSeconds(0)
    setState("starting")
    onRecordingChange?.(true)
    try {
      beforeStart?.()
      // Allow React and WebGL to paint the selected canvas before capturing.
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
      if (!alive.current) return
      const canvas = containerRef.current?.querySelector("canvas")
      if (!canvas) throw new Error("未找到可录制的 Canvas。")
      const recording = recordCanvas(canvas)
      session.current = recording
      setState("recording")
      const blob = await recording.finished
      if (!alive.current) return
      if (downloadUrl.current) URL.revokeObjectURL(downloadUrl.current)
      const url = URL.createObjectURL(blob)
      downloadUrl.current = url
      const extension = blob.type.includes("mp4") ? "mp4" : "webm"
      const name = filename + "-" + new Date().toISOString().replace(/[:.]/g, "-") + "." + extension
      setDownload({ url, name })
      const link = document.createElement("a")
      link.href = url
      link.download = name
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (cause) {
      if (alive.current) setError(cause instanceof Error ? cause.message : "无法开始录制。")
    } finally {
      session.current = null
      busy.current = false
      if (alive.current) { setState("idle"); onRecordingChange?.(false) }
    }
  }
  function stop() {
    setState("saving")
    session.current?.stop()
  }
  return <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
    <button type="button" onClick={state === "recording" ? stop : start} disabled={state === "starting" || state === "saving"}>
      {state === "recording" ? "停止并下载" : state === "saving" ? "正在保存…" : state === "starting" ? "准备录制…" : "录制 Canvas"}
    </button>
    <span role="status" aria-live="polite">{state === "recording" ? "● 录制中 " + seconds + "s" : "仅 Canvas · 30 fps"}</span>
    {download && <a href={download.url} download={download.name}>下载上次录制</a>}
    {error && <span role="alert">{error}</span>}
  </div>
}
