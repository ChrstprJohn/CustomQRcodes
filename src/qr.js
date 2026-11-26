import QRCode from 'qrcode'
import jsQR from 'jsqr'
import { platformHosts } from './content-types.js'

const photoDotDiameterRatio = .0155

function makeCanvas(width, height) {
  if (typeof document === 'undefined') return new OffscreenCanvas(width, height)
  return Object.assign(document.createElement('canvas'), { width, height })
}

export const defaults = {
  zoom: 1, x: 0, y: 0, brightness: 100, contrast: 100, saturation: 100, opacity: 100,
}

export function demoArtwork() {
  const image = Object.assign(document.createElement('canvas'), { width: 720, height: 720 })
  const ctx = image.getContext('2d')
  const sky = ctx.createLinearGradient(0, 0, 720, 720)
  sky.addColorStop(0, '#e9b3ff')
  sky.addColorStop(.55, '#a49fff')
  sky.addColorStop(1, '#39307c')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, 720, 720)
  const sun = ctx.createRadialGradient(425, 270, 10, 425, 270, 155)
  sun.addColorStop(0, '#fff3bc')
  sun.addColorStop(1, '#ff9a6e')
  ctx.fillStyle = sun
  ctx.beginPath()
  ctx.arc(425, 270, 145, 0, Math.PI * 2)
  ctx.fill()
  const hills = [
    ['#524798', [450, 340, 380, 300, 390, 470, 390]],
    ['#372d76', [520, 490, 380, 420, 465, 425, 490]],
    ['#221d50', [580, 590, 530, 480, 510, 575, 530]],
  ]
  for (const [color, heights] of hills) {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(0, heights[0])
    for (let i = 1; i < heights.length; i++) {
      const x = i * 120
      ctx.bezierCurveTo(x - 65, heights[i - 1], x - 55, heights[i], x, heights[i])
    }
    ctx.lineTo(720, 720)
    ctx.lineTo(0, 720)
    ctx.fill()
  }
  return image
}

function phoneNumber(value = '') {
  const number = value.trim().replace(/[().\s-]/g, '')
  if (!/^\+[1-9]\d{6,14}$/.test(number)) throw new Error('Enter a phone number with its country code, such as +1 202 555 0142.')
  return number
}

function hasDomainFormat(hostname) {
  const labels = hostname.replace(/\.$/, '').split('.')
  return labels.length > 1 && labels.every(label => /^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i.test(label))
}

function emailAddress(value = '') {
  const email = value.trim()
  if (!/^[^\s@,;:?<>"\\]+@[^\s@]+$/u.test(email) || !hasDomainFormat(email.split('@')[1]) || email.length > 254) {
    throw new Error('Enter an email address like hello@example.com.')
  }
  return email
}

export function payload(type, value, details = {}) {
  if (type === 'Wi-Fi') {
    const { ssid, password = '', security = 'WPA' } = details
    if (!ssid?.trim()) throw new Error('Enter the Wi-Fi network name.')
    if (new TextEncoder().encode(ssid).length > 32) throw new Error('The Wi-Fi network name can use up to 32 bytes.')
    if (security === 'WPA' && !/^(?:[\x20-\x7e]{8,63}|[0-9a-f]{64})$/i.test(password)) {
      throw new Error('Use 8–63 printable characters or a 64-digit hex key for WPA.')
    }
    if (security === 'WEP' && !/^(?:[\x20-\x7e]{5}|[\x20-\x7e]{13}|[0-9a-f]{10}|[0-9a-f]{26})$/i.test(password)) {
      throw new Error('Use a 5- or 13-character WEP key, or 10 or 26 hex digits.')
    }
    const escape = text => text.replace(/[\\;,:"]/g, '\\$&')
    const key = security === 'nopass' ? '' : 'P:' + escape(password) + ';'
    return 'WIFI:T:' + security + ';S:' + escape(ssid) + ';' + key + ';'
  }
  if (type === 'Contact') {
    const { name, email, phone } = details
    if (!name?.trim()) throw new Error('Enter a name for the contact.')
    const escape = text => text.replace(/\\/g, '\\\\').replace(/[;,]/g, '\\$&').replace(/\r?\n/g, '\\n')
    return ['BEGIN:VCARD', 'VERSION:3.0', 'FN:' + escape(name.trim()), 'N:' + escape(name.trim()) + ';;;;',
      email?.trim() && 'EMAIL:' + escape(emailAddress(email)), phone?.trim() && 'TEL:' + phoneNumber(phone), 'END:VCARD'].filter(Boolean).join('\r\n')
  }
  if (type === 'Phone number') return 'tel:' + phoneNumber(details.recipientPhone)
  if (type === 'SMS') {
    const body = details.SMSMessage ? '?body=' + encodeURIComponent(details.SMSMessage) : ''
    return 'sms:' + phoneNumber(details.recipientPhone) + body
  }
  if (type === 'Email') {
    const recipient = emailAddress(details.recipientEmail).split('@').map(encodeURIComponent).join('@')
    const headers = [['subject', details.emailSubject?.replace(/[\r\n]/g, ' ')], ['body', details.EmailMessage?.replace(/\r?\n/g, '\r\n')]]
    const query = headers.filter(([, input]) => input).map(([name, input]) => name + '=' + encodeURIComponent(input)).join('&')
    return 'mailto:' + recipient + (query ? '?' + query : '')
  }
  const input = value.trim()
  if (type === 'Text') {
    if (!input) throw new Error('Enter the text to encode.')
    return input
  }
  let url
  try {
    url = new URL(/^[a-z][\w+.-]*:\/\//i.test(input) ? input : 'https://' + input)
    if (!['http:', 'https:'].includes(url.protocol) || (!url.hostname.startsWith('[') && !hasDomainFormat(url.hostname)) || /[\s\\]/.test(input) || url.username || url.password) throw new Error()
  } catch {
    throw new Error(type === 'Website' ? 'Enter a website address like example.com.' : 'Enter a valid web link for ' + type + '.')
  }
  const hosts = Object.hasOwn(platformHosts, type) ? platformHosts[type] : null
  const hostname = url.hostname.replace(/\.$/, '')
  if (hosts && !hosts.some(host => hostname === host || hostname.endsWith('.' + host))) {
    throw new Error('Enter a link from ' + type + '.')
  }
  return url.href
}

const cropCache = new WeakMap()

function imageBounds(image) {
  if (cropCache.has(image)) return cropCache.get(image)
  const width = image.naturalWidth || image.width
  const height = image.naturalHeight || image.height
  const probe = makeCanvas(128, 128)
  const ctx = probe.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(image, 0, 0, 128, 128)
  const { data } = ctx.getImageData(0, 0, 128, 128)
  let left = 128, top = 128, right = -1, bottom = -1
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 128; x++) {
      if (data[(y * 128 + x) * 4 + 3] < 32) continue
      left = Math.min(left, x)
      top = Math.min(top, y)
      right = Math.max(right, x)
      bottom = Math.max(bottom, y)
    }
  }
  const bounds = right < 0 ? [0, 0, width, height] : [
    left * width / 128, top * height / 128,
    (right - left + 1) * width / 128, (bottom - top + 1) * height / 128,
  ]
  cropCache.set(image, bounds)
  return bounds
}

function drawStampEdge(ctx, pixels, margin) {
  const teeth = 17
  const radius = Math.min(pixels * .017, margin / 5)
  ctx.save()
  ctx.globalCompositeOperation = 'destination-out'
  for (let index = 0; index <= teeth; index++) {
    const at = index * pixels / teeth
    for (const [x, y] of [[at, 0], [at, pixels], [0, at], [pixels, at]]) {
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
}

function drawPhoto(ctx, image, start, side, settings) {
  const [sx, sy, width, height] = imageBounds(image)
  const scale = Math.max(side / width, side / height) * settings.zoom
  const shift = (offset, extent) => Math.max(side - extent, Math.min(0, (side - extent) / 2 + side * offset / 100))
  ctx.save()
  ctx.globalAlpha = settings.opacity / 100
  ctx.filter = 'brightness(' + settings.brightness + '%) contrast(' + settings.contrast + '%) saturate(' + settings.saturation + '%)'
  ctx.drawImage(image, sx, sy, width, height, start + shift(settings.x, width * scale),
    start + shift(settings.y, height * scale), width * scale, height * scale)
  ctx.restore()
}

const photoMargin = format => format === 'Stamp' ? 4.75 : 3.25

export function drawPreviewSurface(canvas, image, mode, format, settings) {
  const pixels = 720
  canvas.width = canvas.height = pixels
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const modules = mode === 'Photo' ? photoMargin(format) : format === 'Stamp' ? 5 : 4
  const margin = pixels * modules / (29 + 2 * modules)
  const side = pixels - 2 * margin
  ctx.fillStyle = image ? '#fff' : '#e5e0ef'
  ctx.fillRect(0, 0, pixels, pixels)
  if (image) {
    ctx.save()
    ctx.beginPath()
    ctx.roundRect(margin, margin, side, side, 12)
    ctx.clip()
    drawPhoto(ctx, image, margin, side, settings)
    ctx.restore()
  }
  if (format === 'Stamp') drawStampEdge(ctx, pixels, margin)
}

function drawPhotoQR(canvas, modules, image, format, settings, pixels) {
  const size = modules.size
  const margin = photoMargin(format)
  const unit = pixels / (size + margin * 2)
  const start = unit * margin
  const side = size * unit
  const dotRadius = Math.min(pixels * photoDotDiameterRatio, unit * .78) / 2
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const ink = '#101014'
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, pixels, pixels)
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(start, start, side, side, 1.5 * unit)
  ctx.clip()
  if (image) drawPhoto(ctx, image, start, side, settings)

  let colors
  if (image) {
    const probe = makeCanvas(size, size)
    const sample = probe.getContext('2d', { willReadFrequently: true })
    sample.drawImage(canvas, start, start, side, side, 0, 0, size, size)
    colors = sample.getImageData(0, 0, size, size).data
  }

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const corner = (row < 8 && (col < 8 || col >= size - 8)) || (row >= size - 8 && col < 8)
      if (corner) continue
      const px = start + (col + .5) * unit
      const py = start + (row + .5) * unit
      const dark = modules.get(row, col)
      const reserved = modules.isReserved(row, col)
      const index = (row * size + col) * 4
      ctx.fillStyle = dark ? ink : '#fff'
      const luminance = colors ? (.299 * colors[index] + .587 * colors[index + 1] + .114 * colors[index + 2]) / 255 : 1
      const difference = dark ? luminance : 1 - luminance
      const cutoff = reserved ? .30 : .42
      if (difference <= cutoff) continue
      ctx.globalAlpha = reserved ? 1 : .72 + .2 * difference
      ctx.beginPath()
      ctx.arc(px, py, dotRadius, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
  const finderSquare = (x, y, side, radius, color) => {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.roundRect(x, y, side * unit, side * unit, radius * unit)
    ctx.fill()
  }
  for (const [col, row] of [[0, 0], [size - 7, 0], [0, size - 7]]) {
    const x = start + col * unit
    const y = start + row * unit
    finderSquare(x - unit, y - unit, 9, 1.5, '#fff')
    finderSquare(x, y, 7, 1.3, ink)
    finderSquare(x + unit, y + unit, 5, .83, '#fff')
    finderSquare(x + 2 * unit, y + 2 * unit, 3, .6, ink)
  }
  if (format === 'Stamp') drawStampEdge(ctx, pixels, start)
  return { size, offset: start / pixels, span: side / pixels }
}

export function renderQR(canvas, data, image, mode, format, settings, pixels) {
  const options = { errorCorrectionLevel: 'H' }
  let { modules } = QRCode.create(data, options)
  canvas.width = canvas.height = pixels
  if (mode === 'Photo') {
    if (modules.size < 29) ({ modules } = QRCode.create(data, { ...options, version: 3 }))
    return drawPhotoQR(canvas, modules, image, format, settings, pixels)
  }
  const size = modules.size
  const margin = format === 'Stamp' ? 5 : 4
  const unit = Math.floor(pixels / (size + margin * 2))
  const start = Math.floor((pixels - size * unit) / 2)
  const side = size * unit
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, pixels, pixels)
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!modules.get(row, col)) continue
      ctx.fillStyle = '#171326'
      ctx.fillRect(start + col * unit, start + row * unit, unit, unit)
    }
  }

  if (image && mode === 'Logo') {
    const [sx, sy, sourceWidth, sourceHeight] = imageBounds(image)
    const longest = Math.max(sourceWidth, sourceHeight)
    const padding = unit / 2
    const limit = Math.floor(size * .34)
    const snapshotStart = Math.floor((pixels - (limit + 1) * unit) / 2)
    const snapshotSide = Math.ceil((limit + 1) * unit) + 2
    const original = ctx.getImageData(snapshotStart, snapshotStart, snapshotSide, snapshotSide)
    for (let modulesWide = limit; modulesWide >= 2; modulesWide--) {
      const scale = modulesWide * unit / longest
      const width = sourceWidth * scale
      const height = sourceHeight * scale
      const x = (pixels - width) / 2
      const y = (pixels - height) / 2
      const left = Math.floor((x - padding - start) / unit)
      const right = Math.ceil((x + width + padding - start) / unit)
      const top = Math.floor((y - padding - start) / unit)
      const bottom = Math.ceil((y + height + padding - start) / unit)
      let overlapsPattern = false
      for (let row = top; row < bottom && !overlapsPattern; row++) {
        for (let col = left; col < right; col++) {
          if (modules.isReserved(row, col)) {
            overlapsPattern = true
            break
          }
        }
      }
      if (overlapsPattern) continue
      ctx.fillStyle = '#fff'
      ctx.fillRect(x - padding, y - padding, width + unit, height + unit)
      ctx.drawImage(image, sx, sy, sourceWidth, sourceHeight, x, y, width, height)
      if (verifies(canvas, data)) break
      ctx.putImageData(original, snapshotStart, snapshotStart)
    }
  }
  if (format === 'Stamp') drawStampEdge(ctx, pixels, start)
  return { size, offset: start / pixels, span: side / pixels }
}

function scanPixels(canvas, size) {
  const probe = makeCanvas(Math.min(canvas.width, size), Math.min(canvas.height, size))
  const ctx = probe.getContext('2d', { willReadFrequently: true })
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, probe.width, probe.height)
  ctx.drawImage(canvas, 0, 0, probe.width, probe.height)
  return ctx.getImageData(0, 0, probe.width, probe.height)
}

export function verifies(canvas, data) {
  const pixels = scanPixels(canvas, 640)
  return jsQR(pixels.data, pixels.width, pixels.height, { inversionAttempts: 'dontInvert' })?.data === data
}

export async function verifyQR(canvas, data, mode) {
  if (mode !== 'Photo') return verifies(canvas, data)
  const sizes = [...new Set([512, 320, 640].map(size => Math.min(size, canvas.width)))]
  const frames = sizes.map(size => scanPixels(canvas, size))
  try {
    const { scansPhoto } = await import('./photo-scan')
    for (const frame of frames) {
      if (await scansPhoto(frame, data)) return true
    }
  } catch {
    // The JS decoder also works when WebAssembly is unavailable.
  }
  return frames.some(pixels => jsQR(pixels.data, pixels.width, pixels.height, { inversionAttempts: 'dontInvert' })?.data === data)
}
