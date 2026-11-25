import { useEffect, useMemo, useRef, useState } from 'react'
import { renderQR, verifyQR } from './qr'

export function useQrPreview(canvas, data, image, mode, format, settings, draft) {
  const owner = useMemo(() => ({ data, image, mode, format }), [data, image, mode, format])
  const request = useMemo(() => ({ owner, settings, draft }), [owner, settings, draft])
  const [result, setResult] = useState(null)
  const engine = useRef(null)
  const latest = useRef(null)

  useEffect(() => {
    let worker
    let inFlight
    let queued
    let previousImage
    let sequence = 0
    let disposed = false
    let fallbackFrame

    function accept(job, response) {
      const current = latest.current
      if (disposed || !current?.owner.data || job.owner !== current.owner) return
      if (job !== current && (!job.draft || response.error)) return
      if (response.frame) {
        const target = canvas.current
        target.width = response.frame.width
        target.height = response.frame.height
        target.getContext('2d').drawImage(response.frame, 0, 0)
      }
      setResult({ owner: job.owner, request: job, geometry: response.geometry, readable: response.readable, error: response.error })
    }

    function useMainThread() {
      if (fallbackFrame || disposed) return
      fallbackFrame = requestAnimationFrame(async () => {
        fallbackFrame = undefined
        const job = latest.current
        if (!job?.owner.data) return
        const { data, image, mode, format } = job.owner
        try {
          const geometry = renderQR(canvas.current, data, image, mode, format, job.settings, 720)
          const readable = !job.draft && await verifyQR(canvas.current, data, mode)
          accept(job, { geometry, readable })
        } catch (error) {
          accept(job, { error: error.message })
        }
      })
    }

    function disableWorker() {
      worker?.terminate()
      worker = undefined
      inFlight = queued = undefined
      useMainThread()
    }

    async function sendNext() {
      if (!worker || inFlight || !queued) return
      const job = queued
      queued = undefined
      const id = ++sequence
      inFlight = { job, id }
      const { data, image, mode, format } = job.owner
      const replaceImage = image !== previousImage
      let bitmap
      try {
        if (replaceImage && image) bitmap = await createImageBitmap(image)
        if (disposed || !worker) {
          bitmap?.close()
          return
        }
        worker.postMessage({
          id, data, mode, format, settings: job.settings, draft: job.draft,
          replaceImage, bitmap,
        }, bitmap ? [bitmap] : [])
        previousImage = image
      } catch {
        bitmap?.close()
        disableWorker()
      }
    }

    if (typeof Worker === 'function' && typeof OffscreenCanvas === 'function' && typeof createImageBitmap === 'function') {
      try {
        const context = new OffscreenCanvas(1, 1).getContext('2d')
        if (context && 'filter' in context && 'roundRect' in context) {
          worker = new Worker(new URL('./qr-preview.worker.js', import.meta.url), { type: 'module' })
          worker.onmessage = ({ data: response }) => {
            const active = inFlight
            inFlight = undefined
            if (active?.id === response.id) accept(active.job, response)
            response.frame?.close()
            sendNext()
          }
          worker.onerror = event => {
            event.preventDefault()
            disableWorker()
          }
        }
      } catch {
        disableWorker()
      }
    }

    engine.current = job => {
      latest.current = job
      queued = job.owner.data ? job : undefined
      if (worker) sendNext()
      else if (queued) useMainThread()
    }
    return () => {
      disposed = true
      worker?.terminate()
      cancelAnimationFrame(fallbackFrame)
      engine.current = null
    }
  }, [canvas])

  useEffect(() => engine.current?.(request), [request])
  return { result: result?.owner === owner ? result : null, settled: !!result && result.request === request && !draft }
}
