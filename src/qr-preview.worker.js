import { renderQR, verifyQR } from './qr'

const canvas = new OffscreenCanvas(720, 720)
let image

self.onmessage = async ({ data: { id, data, mode, format, settings, draft, bitmap, replaceImage } }) => {
  if (replaceImage) {
    image?.close()
    image = bitmap
  }
  try {
    const geometry = renderQR(canvas, data, image, mode, format, settings, 720, { compactPhotoPreview: true })
    const readable = !draft && await verifyQR(canvas, data, mode)
    const frame = canvas.transferToImageBitmap()
    self.postMessage({ id, geometry, readable, frame }, [frame])
  } catch (error) {
    self.postMessage({ id, error: error.message })
  }
}
