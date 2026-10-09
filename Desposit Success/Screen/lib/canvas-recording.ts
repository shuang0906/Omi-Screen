export function recordCanvas(canvas: HTMLCanvasElement, fps = 30) {
  if (!canvas.captureStream || typeof MediaRecorder === "undefined") {
    throw new Error("当前浏览器不支持 Canvas 录制，请使用 Chrome 或 Edge。")
  }
  const mimeType = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"]
    .find(type => MediaRecorder.isTypeSupported(type))
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
