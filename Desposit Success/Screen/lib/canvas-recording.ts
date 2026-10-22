export function recordCanvas(canvas: HTMLCanvasElement, fps = 30, transparentWebm = false) {
  if (!canvas.captureStream || typeof MediaRecorder === "undefined") {
    throw new Error("当前浏览器不支持 Canvas 录制，请使用 Chrome 或 Edge。")
  }
  const formats = transparentWebm
    ? ["video/webm;codecs=vp9", "video/webm;codecs=vp8"]
    : ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"]
  const mimeType = formats
    .find(type => MediaRecorder.isTypeSupported(type))
  if (transparentWebm && !mimeType) {
    throw new Error("当前浏览器不支持透明 WebM 录制，请使用 Chrome 或 Edge。")
  }
  if (transparentWebm) {
    const context = canvas.getContext("webgl2") || canvas.getContext("webgl")
    if (context && !context.getContextAttributes()?.alpha) {
      throw new Error("当前 Canvas 未启用透明通道，无法导出透明背景。")
    }
  }
  const stream = canvas.captureStream(fps)
  let recorder: MediaRecorder
  try {
    recorder = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), videoBitsPerSecond: 8_000_000 })
  } catch (error) {
    stream.getTracks().forEach(track => track.stop())
    throw error
  }
  const chunks: Blob[] = []
  const finished = new Promise<Blob>((resolve, reject) => {
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }
    recorder.onstop = () => {
      stream.getTracks().forEach(track => track.stop())
      if (!chunks.length) reject(new Error("没有录到画面，请播放动画后重试。"))
      else resolve(new Blob(chunks, { type: recorder.mimeType || mimeType || "video/webm" }))
    }
    recorder.onerror = () => {
      stream.getTracks().forEach(track => track.stop())
      reject(new Error("录制失败，请重试。"))
    }
  })
  // Attach a handler immediately, including when the browser fails before Stop.
  void finished.catch(() => {})
  try { recorder.start(250) }
  catch (error) { stream.getTracks().forEach(track => track.stop()); throw error }
  return {
    finished,
    stop() { if (recorder.state !== "inactive") recorder.stop() },
  }
}
