import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { ArrowDownToLine, ArrowLeft, Check, ChevronDown, CircleAlert, Image as ImageIcon, Plus, RotateCcw, ScanLine, Upload, X } from 'lucide-react'
import { isLinkType, linkExamples, primaryTypes } from './content-types'
import { TypePicker } from './type-picker'
import { defaults, demoArtwork, drawPreviewSurface, payload, renderQR, verifyQR } from './qr'
import { useQrPreview } from './use-qr-preview'
import { Credits, Gallery, ScrambleLabel, getArtwork } from './gallery'
import './style.css'
import './gallery.css'

gsap.registerPlugin(useGSAP)

const steps = ['Content', 'Image']
const imageControls = [
  ['Framing', [
    ['Zoom', 'zoom', 1, 3, .01, '×'], ['Position X', 'x', -70, 70], ['Position Y', 'y', -70, 70],
  ]],
  ['Appearance', [
    ['Brightness', 'brightness', 30, 180], ['Contrast', 'contrast', 30, 180],
    ['Saturation', 'saturation', 0, 200], ['Image opacity', 'opacity', 0, 100],
  ]],
]
const contentDefaults = { security: 'WPA' }
const uploadFormats = { 'image/png': 'PNG', 'image/jpeg': 'JPG', 'image/webp': 'WebP' }
const qrStyles = ['Photo', 'Logo', 'Classic']
const exportSizes = [512, 1024, 1536, 2048, 3072, 4096]
const maxExportSize = exportSizes[exportSizes.length - 1]
const questions = [
  ['Is BrandQR free?', 'Yes. You can create, verify, and download your QR codes without an account or a watermark.'],
  ['Do QR codes expire?', 'The printed code stays the same. A website link works as long as its destination is available.'],
  ['Can I change the destination later?', 'The destination is encoded directly in each QR. Create and export a new code to use a different destination.'],
  ['Will my code scan when printed?', 'BrandQR checks the generated image against the destination with a built-in decoder. Scan a printed sample at its final size before printing in bulk.'],
  ['What kind of artwork works best?', 'Try a sharp image with a clear subject. Lower image opacity if the preview needs more contrast.'],
  ['Where do my images go?', 'Your browser processes artwork on your device. BrandQR does not upload or store it.'],
  ['Can I use my QR code for work?', 'Yes. Use it on packaging, signs, or menus with artwork you have permission to use.'],
]

function DisclosurePanel({ open, id, children }) {
  const panel = useRef(null)
  const previous = useRef(open)
  useGSAP(() => {
    const element = panel.current
    if (open === previous.current || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(element, { height: open ? 'auto' : 0 })
      previous.current = open
      return
    }
    previous.current = open
    const tween = gsap.to(element, { height: open ? 'auto' : 0, duration: .32, ease: 'power2.inOut', overwrite: true })
    return () => tween.kill()
  }, { dependencies: [open] })
  return <div ref={panel} id={id} className="disclosure-panel" inert={!open}>{children}</div>
}

function FaqRow({ question, answer, index }) {
  const [open, setOpen] = useState(false)
  const id = 'faq-answer-' + index
  return <div className="faq-row">
    <h3><button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>{question}<Plus size={19} /></button></h3>
    <DisclosurePanel id={id} open={open}><p>{answer}</p></DisclosurePanel>
  </div>
}

function Faq() {
  return <main className="faq-page shell">
    <header className="credits-header"><a className="back-link" href="#/" aria-label="Back to gallery"><ArrowLeft size={13} /> <ScrambleLabel>Back to gallery</ScrambleLabel></a></header>
    <h1>Frequently asked questions</h1>
    <section className="help" aria-label="Answers">{questions.map(([question, answer], index) =>
      <FaqRow key={question} question={question} answer={answer} index={index} />)}</section>
  </main>
}

function PillChoices({ label, className = '', selected, count, children }) {
  const group = useRef(null)
  const highlight = useRef(null)
  const initialized = useRef(false)
  useGSAP(() => {
    const position = { xPercent: selected * 100, x: selected * 3 }
    if (!initialized.current || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(highlight.current, position)
      initialized.current = true
      return
    }
    gsap.to(highlight.current, { ...position, duration: .26, ease: 'power3.out', overwrite: true })
  }, { scope: group, dependencies: [selected] })
  return <div ref={group} className={'choices ' + className} role="group" aria-label={label}
    style={{ '--pill-count': count, '--pill-gaps': (count - 1) * 3 + 'px' }}>
    <span ref={highlight} className="pill-highlight" aria-hidden="true" />
    {children}
  </div>
}

function StyleChoices({ art, mode, onChange }) {
  const image = art?.image
  const [thumbnails, setThumbnails] = useState({})
  useEffect(() => {
    const canvas = document.createElement('canvas')
    const previewImage = image || demoArtwork()
    const previews = qrStyles.map(style => {
      renderQR(canvas, 'https://example.com', previewImage, style, 'Card', defaults, 192, { compactPhotoPreview: true })
      return [style, canvas.toDataURL()]
    })
    setThumbnails(Object.fromEntries(previews))
  }, [image])
  return <div className="style-choices" role="group" aria-label="QR style">
    {qrStyles.map(style => <button type="button" key={style} aria-pressed={style === mode} onClick={() => onChange(style)}>
      {thumbnails[style] && <img src={thumbnails[style]} alt="" />}
      <span>{style}</span>
    </button>)}
  </div>
}

function Studio({ initialArt }) {
  const root = useRef(null)
  const canvas = useRef(null)
  const previewStage = useRef(null)
  const dockCanvas = useRef(null)
  const upload = useRef(null)
  const resetDialog = useRef(null)
  const exportDialog = useRef(null)
  const exportPreview = useRef(null)
  const uploadSequence = useRef(0)
  const [openGroups, setOpenGroups] = useState([true, true])
  const [type, setType] = useState('Website')
  const [moreTypes, setMoreTypes] = useState(false)
  const [entries, setEntries] = useState({})
  const [edited, setEdited] = useState(false)
  const [details, setDetails] = useState(contentDefaults)
  const [mode, setMode] = useState('Photo')
  const [art, setArt] = useState(initialArt)
  const [settings, setSettings] = useState(defaults)
  const [movingRange, setMovingRange] = useState('')
  const rangeTimer = useRef(null)
  const [format, setFormat] = useState('Card')
  const [resolution, setResolution] = useState(2048)
  const [customSize, setCustomSize] = useState('')
  const [fileError, setFileError] = useState('')
  const [exportMessage, setExportMessage] = useState('')
  const [exporting, setExporting] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [mobileStudio, setMobileStudio] = useState(() => matchMedia('(max-width: 820px)').matches)
  const [previewClippedAtTop, setPreviewClippedAtTop] = useState(false)
  const value = entries[type] ?? ''
  const additionalTypeSelected = !primaryTypes.includes(type)
  const destinationLabel = type === 'Website' ? 'Website URL' : type + ' URL'
  const content = useMemo(() => {
    try {
      return { data: payload(type, value, details) }
    } catch (error) {
      return { error: error.message }
    }
  }, [type, value, details])
  const { result: processed, settled } = useQrPreview(canvas, content.data, mode === 'Classic' ? null : art?.image, mode, format, settings, Boolean(movingRange))
  const contentError = content.error || processed?.error
  const qrReady = !!processed?.geometry && !contentError
  const draftImage = !qrReady && mode !== 'Classic' ? art?.image : undefined
  const showStampSurface = !qrReady && format === 'Stamp'
  const showDock = previewClippedAtTop && Boolean(draftImage || (content.data && !contentError))
  const canDownload = settled && !!processed?.geometry
  const isCustomSize = resolution === 'custom'
  const pixels = isCustomSize ? Number(customSize) : resolution
  const minExportSize = Math.max(128, (processed?.geometry?.size ?? 0) + (format === 'Stamp' ? 10 : 8))
  const validSize = Number.isInteger(pixels) && pixels >= minExportSize && pixels <= maxExportSize
  const scanVerified = canDownload && processed.readable
  const missingImage = !art && mode !== 'Classic'
  const hasChanges = type !== 'Website' || mode !== 'Photo' || !!art || format !== 'Card' || resolution !== 2048 ||
    Object.values(entries).some(Boolean) || Object.entries(details).some(([key, value]) => value !== (contentDefaults[key] ?? ''))
  const contentPrompt = type === 'Website' ? 'Enter a website URL'
    : isLinkType(type) ? 'Enter a ' + type + ' link'
    : type === 'Text' ? 'Enter your text' : 'Complete the ' + type + ' fields'
  const enteredContent = isLinkType(type) || type === 'Text' ? value.trim()
    : type === 'Wi-Fi' ? details.ssid?.trim() : type === 'Contact' ? details.name?.trim()
      : type === 'Email' ? details.recipientEmail?.trim() : details.recipientPhone?.trim()
  const emptyPrompt = processed?.error ? processed.error
    : edited && enteredContent ? 'Check the content fields'
    : contentPrompt + (missingImage ? ' and add an image' : '')
  const showScanWarning = !contentError && settled && !scanVerified
  const showImagePrompt = !contentError && missingImage && !showScanWarning
  const artDimensions = art && (art.image.naturalWidth || art.image.width) + '×' + (art.image.naturalHeight || art.image.height)

  const artPreview = useMemo(() => {
    if (!art) return null
    const image = art.image
    const width = image.naturalWidth || image.width
    const height = image.naturalHeight || image.height
    const scale = Math.min(1, 400 / Math.max(width, height))
    const thumbnail = document.createElement('canvas')
    thumbnail.width = Math.max(1, Math.round(width * scale))
    thumbnail.height = Math.max(1, Math.round(height * scale))
    thumbnail.getContext('2d').drawImage(image, 0, 0, thumbnail.width, thumbnail.height)
    return thumbnail.toDataURL('image/webp', .85)
  }, [art])

  useGSAP(() => {
    const media = gsap.matchMedia()
    media.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.from('.intro, .workspace', { y: 16, opacity: 0, stagger: .08, duration: .55, ease: 'power2.out' })
    })
    return () => media.revert()
  }, { scope: root })

  useEffect(() => () => clearTimeout(rangeTimer.current), [])

  useEffect(() => {
    const mobile = matchMedia('(max-width: 820px)')
    const visibleThreshold = .85
    const observer = new IntersectionObserver(([entry]) => {
      setPreviewClippedAtTop(mobile.matches &&
        entry.boundingClientRect.top < 0 && entry.intersectionRatio < visibleThreshold)
    }, { threshold: visibleThreshold })
    const update = () => {
      observer.disconnect()
      setMobileStudio(mobile.matches)
      if (mobile.matches) observer.observe(previewStage.current)
      else setPreviewClippedAtTop(false)
    }
    update()
    mobile.addEventListener('change', update)
    return () => {
      observer.disconnect()
      mobile.removeEventListener('change', update)
    }
  }, [])

  useLayoutEffect(() => {
    if (draftImage || showStampSurface) drawPreviewSurface(canvas.current, draftImage, mode, format, settings)
  }, [draftImage, showStampSurface, mode, format, settings])

  useLayoutEffect(() => {
    if (!showDock) return
    const thumbnail = dockCanvas.current
    const context = thumbnail.getContext('2d')
    context.clearRect(0, 0, thumbnail.width, thumbnail.height)
    context.drawImage(canvas.current, 0, 0, thumbnail.width, thumbnail.height)
  }, [processed, showDock, draftImage, format, settings])

  const change = (key, next) => {
    setSettings(current => ({ ...current, [key]: next }))
    setExportMessage('')
  }

  async function loadImage(file) {
    if (!file) return
    const id = ++uploadSequence.current
    setFileError('')
    setExportMessage('')
    const fileFormat = uploadFormats[file.type]
    if (!fileFormat || file.size > 20 * 1024 * 1024) {
      setFileError('Choose a PNG, JPG, or WebP image up to 20 MB.')
      return
    }
    const source = URL.createObjectURL(file)
    try {
      const photo = new window.Image()
      photo.src = source
      await photo.decode()
      if (id === uploadSequence.current) {
        const fileSize = file.size >= 1024 * 1024 ? (file.size / (1024 * 1024)).toFixed(1) + ' MB'
          : file.size >= 1024 ? (file.size / 1024).toFixed(1) + ' KB' : file.size + ' B'
        setArt({ image: photo, name: file.name, fileFormat, fileSize })
        setSettings(defaults)
        if (mode === 'Classic') setMode('Photo')
      }
    } catch {
      if (id === uploadSequence.current) setFileError('This image could not be opened. Try another file.')
    } finally {
      URL.revokeObjectURL(source)
    }
  }

  function openExport() {
    const preview = exportPreview.current
    const context = preview.getContext('2d')
    context.clearRect(0, 0, preview.width, preview.height)
    if (mode === 'Photo' && format === 'Card') {
      renderQR(preview, content.data, art?.image, mode, format, settings, preview.width)
    } else {
      context.drawImage(canvas.current, 0, 0, preview.width, preview.height)
    }
    exportDialog.current.showModal()
  }

  async function download() {
    setExportMessage('')
    setExporting(true)
    try {
      const data = payload(type, value, details)
      const output = document.createElement('canvas')
      renderQR(output, data, art?.image, mode, format, settings, pixels)
      const verified = await verifyQR(output, data, mode)
      const blob = await new Promise(resolve => output.toBlob(resolve, 'image/png'))
      if (!blob) throw new Error()
      const address = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = address
      link.download = 'brandqr-' + format.toLowerCase() + '-' + pixels + '.png'
      link.click()
      setTimeout(() => URL.revokeObjectURL(address), 2000)
      setExportMessage(verified ? 'PNG downloaded.' : 'PNG downloaded. Check the exported QR with your phone before sharing.')
    } catch {
      setExportMessage('Could not export this QR code. Check the destination and try again.')
    } finally {
      setExporting(false)
    }
  }

  function reset() {
    uploadSequence.current++
    clearTimeout(rangeTimer.current)
    setMovingRange('')
    setType('Website')
    setEntries({})
    setEdited(false)
    setDetails(contentDefaults)
    setMode('Photo')
    setArt(null)
    setSettings(defaults)
    setFormat('Card')
    setResolution(2048)
    setCustomSize('')
    setFileError('')
    setOpenGroups([true, true])
    setExportMessage('')
  }

  function range([name, key, min, max, step = 1, suffix = '%']) {
    const changed = settings[key] !== defaults[key]
    const multiplier = ['brightness', 'contrast', 'saturation'].includes(key)
    const display = multiplier ? (settings[key] / 100).toFixed(2) + '×'
      : suffix === '×' ? settings[key].toFixed(2) + suffix : settings[key] + suffix
    return <div className="range" key={key} data-moving={movingRange === key} style={{ '--range-progress': (settings[key] - min) / (max - min) * 100 + '%' }}>
      <label htmlFor={key}>{name}</label><output htmlFor={key}>{display}</output>
      <input id={key} type="range" min={min} max={max} step={step} value={settings[key]} onChange={event => {
        setMovingRange(key)
        change(key, event.target.valueAsNumber)
        clearTimeout(rangeTimer.current)
        rangeTimer.current = setTimeout(() => setMovingRange(''), 120)
      }} />
      <button type="button" className="icon-button" hidden={!changed} aria-label={'Reset ' + name.toLowerCase()} onClick={() => change(key, defaults[key])}><RotateCcw size={13} /></button>
    </div>
  }

  function updateDetail(key, next) {
    setEdited(true)
    setDetails(current => ({ ...current, [key]: next }))
    setExportMessage('')
  }

  function contentField(key, label, placeholder, inputType = 'text', required = true) {
    return <div>
      <label className="field-label" htmlFor={key}>{label}</label>
      <div className="input-wrap"><input id={key} type={inputType} placeholder={placeholder} required={required} value={details[key] ?? ''} onChange={event => updateDetail(key, event.target.value)} /></div>
    </div>
  }

  function selectType(next) {
    if (next !== type) setEdited(false)
    setType(next)
    setExportMessage('')
  }

  function changeEntry(event) {
    const next = event.target.value
    setEdited(true)
    setEntries(current => ({ ...current, [type]: next }))
    setExportMessage('')
  }

  const area = processed?.geometry

  const formatChoices = <PillChoices className="format-choices" label="Export format" count={2} selected={format === 'Stamp' ? 1 : 0}>
    {['Card', 'Stamp'].map(option => <button type="button" key={option} aria-pressed={option === format}
      onClick={() => { setFormat(option); setExportMessage('') }}>{option}</button>)}
  </PillChoices>

  const exportActions = <div className="export-actions">
    <button className="reset-action" type="button" aria-label="Reset studio" title="Reset studio"
      aria-hidden={!mobileStudio && !hasChanges} aria-haspopup="dialog" disabled={!hasChanges || exporting}
      onClick={() => resetDialog.current.showModal()}><RotateCcw size={17} /></button>
    <button className="download" disabled={!canDownload || exporting} aria-busy={exporting} aria-haspopup="dialog"
      onClick={openExport}>
      <ArrowDownToLine size={18} />{exporting ? 'Preparing PNG…' : 'Download PNG'}
    </button>
  </div>

  return <div ref={root} className="studio-page" data-qr-docked={showDock || undefined}>
    <header className="top"><div className="shell nav">
      <a href="#/" className="wordmark" aria-label="Back to gallery"><ArrowLeft size={13} /> <ScrambleLabel>Back to gallery</ScrambleLabel></a>
      <nav aria-label="Studio navigation"><a href="#/faq" aria-label="FAQ"><ScrambleLabel>FAQ</ScrambleLabel></a></nav>
    </div></header>
    <main className="shell" id="studio">
      <section className="intro">
        <h1>QR art studio</h1>
        <p>Bring your artwork. Choose what it opens. See the code take shape.</p>
      </section>
      <section className="workspace" aria-label="QR code editor">
        <section className="editor" aria-label="Code settings">
          {(mode === 'Classic' ? steps.slice(0, 1) : steps).map((name, index) => {
            const visible = openGroups[index]
            return <section className="editor-section" key={name}>
              <h2 className="section-heading"><button aria-expanded={visible} aria-controls={'settings-' + index} onClick={() => {
                setOpenGroups(groups => groups.map((open, i) => i === index ? !open : open))
              }}><span className="section-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>{name}<ChevronDown size={16} /></button></h2>
              <DisclosurePanel id={'settings-' + index} open={visible}><div className="editor-panel">
            {index === 0 && <>
              <h2 className="sr-only">Set the destination</h2>
              <div className="field-label">QR style</div>
              <StyleChoices art={art} mode={mode} onChange={next => { setMode(next); setExportMessage('') }} />
              <div className="field-label">Content type</div>
              <PillChoices className="content-types" label="Content type" count={4} selected={moreTypes || additionalTypeSelected ? 3 : primaryTypes.indexOf(type)}>
                {primaryTypes.map(option => <button type="button" key={option} aria-pressed={type === option} onClick={() => selectType(option)}>{option}</button>)}
                <button type="button" aria-haspopup="dialog" aria-expanded={moreTypes} aria-controls={moreTypes ? 'additional-content-types' : undefined}
                  aria-label={additionalTypeSelected ? type + ' selected, more content types' : 'More'} data-selected={additionalTypeSelected} onClick={() => setMoreTypes(true)}>
                  <span>{additionalTypeSelected ? type : 'More'}</span>
                </button>
              </PillChoices>
              {isLinkType(type) && <>
                <label className="field-label" htmlFor="destination">{destinationLabel}</label>
                <div className="input-wrap"><input id="destination" type="text" inputMode="url" required placeholder={linkExamples[type] || 'https://example.com/…'} value={value} onChange={changeEntry} /></div>
              </>}
              {type === 'Text' && <>
                <label className="field-label" htmlFor="destination">Text to encode</label>
                <textarea id="destination" rows="2" required placeholder="Write a message" value={value} onChange={changeEntry} />
              </>}
              {type === 'Wi-Fi' && <>
                {contentField('ssid', 'Network name', 'Guest Wi-Fi')}
                <label className="field-label" htmlFor="security">Network security</label>
                <div className="select-wrap"><select id="security" value={details.security} onChange={event => updateDetail('security', event.target.value)}>
                  <option value="WPA">WPA / WPA2</option><option value="WEP">WEP</option><option value="nopass">Open network</option>
                </select><ChevronDown size={14} /></div>
                {details.security !== 'nopass' && contentField('password', 'Network password', details.security === 'WEP' ? '5 or 13 characters, or a hex key' : '8–63 characters, or a 64-digit hex key', 'password')}
              </>}
              {type === 'Contact' && <>{contentField('name', 'Full name', 'Alex Example')}{contentField('email', 'Email (optional)', 'hello@example.com', 'email', false)}{contentField('phone', 'Phone (optional)', '+1 202 555 0142', 'tel', false)}</>}
              {['Phone number', 'SMS'].includes(type) && contentField('recipientPhone', 'Phone number with country code', '+1 202 555 0142', 'tel')}
              {type === 'Email' && <>
                {contentField('recipientEmail', 'To', 'hello@example.com', 'email')}
                {contentField('emailSubject', 'Subject (optional)', 'Your subject line', 'text', false)}
              </>}
              {['SMS', 'Email'].includes(type) && <>
                <label className="field-label" htmlFor={'message-' + type}>Message (optional)</label>
                <textarea id={'message-' + type} rows="2" placeholder="Write a message" value={details[type + 'Message'] ?? ''} onChange={event => updateDetail(type + 'Message', event.target.value)} />
              </>}
              {contentError && edited && <p className="error" role="status">{contentError}</p>}
            </>}
            {index === 1 && <>
              <h2 className="sr-only">Add your artwork</h2>
              <input ref={upload} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={event => { loadImage(event.target.files[0]); event.target.value = '' }} />
              <div className={dragging ? 'drop dragging' : 'drop'} data-has-art={!!art}
                onDragOver={event => {
                  if (!event.dataTransfer.types.includes('Files')) return
                  event.preventDefault()
                  event.dataTransfer.dropEffect = 'copy'
                  setDragging(true)
                }}
                onDragLeave={event => {
                  if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false)
                }}
                onDrop={event => { event.preventDefault(); setDragging(false); loadImage(event.dataTransfer.files[0]) }}>
                <button type="button" className="drop-action" aria-label={art && !dragging ? 'Replace image' : undefined}
                  aria-describedby={art && !dragging ? 'artwork-name' : undefined} onClick={() => upload.current.click()}>
                  {art && !dragging ? <>
                    <span className="drop-thumbnail"><img src={artPreview} alt="" />{art.fileFormat && <span className="file-badge">{art.fileFormat}</span>}</span>
                    <span className="drop-file">
                      <span id="artwork-name" className="drop-name">{art.name}</span>
                      <span className="drop-metadata">{art.fileSize && art.fileSize + ' · '}{artDimensions}</span>
                    </span>
                  </>
                    : <><span className="drop-icon"><Upload size={15} /></span><span>
                      <strong>{dragging ? (art ? 'Drop to replace image' : 'Drop your image here')
                        : mobileStudio ? 'Tap to upload an image' : 'Click to upload an image'}</strong>
                      <small>{dragging || mobileStudio ? 'PNG, JPG, WebP' : 'or drag and drop · PNG, JPG, WebP'}</small>
                    </span></>}
                </button>
                {art && <button type="button" className="icon-button drop-remove" aria-label="Remove image" onClick={() => { uploadSequence.current++; setArt(null); setFileError(''); setExportMessage('') }}><X size={16} /></button>}
              </div>
              {fileError && <p className="error" role="status">{fileError}</p>}
              {art && mode === 'Photo' && <div className="sliders">
                {imageControls.map(([label, controls]) => <fieldset className="slider-group" key={label}>
                  <legend>{label}</legend>
                  {controls.map(range)}
                </fieldset>)}
              </div>}
            </>}
            {index === (mode === 'Classic' ? 0 : 1) && formatChoices}
              </div></DisclosurePanel>
            </section>
          })}
        </section>
        <section className="preview" aria-label="QR code preview">
          <div className="preview-header">
            <h2>Live preview</h2>
            <span className={scanVerified ? 'status good' : 'status'} data-neutral={!!contentError || !settled} role="status">{contentError ? 'Enter content' : !settled ? 'Checking…' : scanVerified ? <><Check size={13} /> Scan verified</> : 'Not verified'}</span>
          </div>
          <div className="preview-field">
            <div className="preview-stack">
              {showScanWarning && <p className="preview-note" data-warning role="status"><CircleAlert size={14} />Check this QR with your phone.</p>}
              <div ref={previewStage} className="qr-stage" data-format={format} data-modules={area?.size}>
                {showImagePrompt && <p className="preview-note"><ImageIcon size={14} />{mode === 'Logo' ? 'Open Image to upload a logo.' : 'Open Image to upload artwork.'}</p>}
                <canvas ref={canvas} role="img" aria-label={draftImage ? 'Artwork preview' : 'Generated QR code'}
                  aria-hidden={!qrReady && !draftImage} style={{ visibility: qrReady || draftImage || showStampSurface ? 'visible' : 'hidden' }} />
                {contentError && !draftImage && <div className="empty"><ScanLine aria-hidden="true" size={29} strokeWidth={1.45} /><span>{emptyPrompt}</span></div>}
              </div>
            </div>
          </div>
        </section>
        <section className="export-deck" aria-label="Export QR code" hidden={mobileStudio && !exportMessage}>
          {!mobileStudio && exportActions}
          {exportMessage && <p className="export-message" role="status">{exportMessage}</p>}
        </section>
      </section>
    </main>
    {mobileStudio && exportActions}
    {showDock && <button className="qr-dock" data-format={format} type="button"
      aria-label={draftImage ? 'Show full-size artwork preview' : 'Show full-size ' + format + ' QR preview'}
      onClick={() => previewStage.current.scrollIntoView({
        block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      })}>
      <canvas ref={dockCanvas} width={240} height={240} aria-hidden="true" />
    </button>}
    {moreTypes && <TypePicker value={type} onSelect={selectType} onClose={() => setMoreTypes(false)} />}
    <dialog className="reset-dialog export-dialog" ref={exportDialog} aria-labelledby="export-title">
      <div className="export-dialog-header">
        <h2 id="export-title">Download PNG</h2>
        <button type="button" className="icon-button" aria-label="Close download options" onClick={() => exportDialog.current.close()}><X size={19} /></button>
      </div>
      <div className="export-preview" data-format={format}>
        <canvas ref={exportPreview} width={640} height={640} role="img" aria-label={format + ' QR preview'} />
      </div>
      <div className="resolution-info">
        <span id="resolution-label">Resolution</span>
        {validSize && <output>{pixels.toLocaleString()} × {pixels.toLocaleString()} px</output>}
      </div>
      <div className="resolution-options" data-custom={isCustomSize || undefined} role="group" aria-labelledby="resolution-label">
        <PillChoices label="Preset sizes" count={exportSizes.length} selected={Math.max(0, exportSizes.indexOf(resolution))}>
          {exportSizes.map(size => <button type="button" key={size} aria-pressed={resolution === size}
            onClick={() => setResolution(size)}>{size / 512}×</button>)}
        </PillChoices>
        <button type="button" className="custom-size-button" aria-pressed={isCustomSize} onClick={() => setResolution('custom')}>Custom</button>
      </div>
      {isCustomSize && <div className="custom-resolution">
        <label htmlFor="custom-resolution">Square size (px)</label>
        <input id="custom-resolution" type="number" inputMode="numeric" min={minExportSize} max={maxExportSize}
          step={1} placeholder="1500" value={customSize} onChange={event => setCustomSize(event.target.value)}
          aria-invalid={!!customSize && !validSize} aria-describedby={customSize && !validSize ? 'custom-resolution-error' : undefined} />
        <p id="custom-resolution-error" hidden={!customSize || validSize}>
          Enter a whole number from {minExportSize.toLocaleString()} to {maxExportSize.toLocaleString()}.
        </p>
      </div>}
      <button type="button" className="download" disabled={!canDownload || exporting || !validSize} onClick={() => {
        exportDialog.current.close()
        download()
      }}><ArrowDownToLine size={18} />Download PNG</button>
    </dialog>
    <dialog className="reset-dialog" ref={resetDialog} aria-labelledby="reset-title" aria-describedby="reset-description"
      onClose={event => {
        if (event.currentTarget.returnValue === 'reset') reset()
        event.currentTarget.returnValue = ''
      }}>
      <h2 id="reset-title">Reset this QR?</h2>
      <p id="reset-description">This clears the content, image, and adjustments in Studio.</p>
      <form method="dialog">
        <button type="submit" value="cancel" autoFocus className="secondary-pill">Keep editing</button>
        <button type="submit" value="reset" className="pill">Reset QR</button>
      </form>
    </dialog>
  </div>
}

function getRoute() {
  return (location.hash.startsWith('#/') ? location.hash.slice(1) : location.pathname).replace(/\/$/, '') || '/'
}

function App() {
  const [route, setRoute] = useState(getRoute)
  const [artwork, setArtwork] = useState([])
  const [initialArt, setInitialArt] = useState(null)
  useEffect(() => {
    const navigate = () => setRoute(getRoute())
    window.addEventListener('hashchange', navigate)
    let mounted = true
    getArtwork().then(items => { if (mounted) setArtwork(items) }).catch(error => console.error('Unable to load gallery artwork', error))
    return () => {
      mounted = false
      window.removeEventListener('hashchange', navigate)
    }
  }, [])
  useEffect(() => {
    window.scrollTo(0, 0)
    if (route !== '/studio') setInitialArt(null)
    const titles = { '/studio': 'QR art studio', '/credits': 'Artwork credits', '/faq': 'Frequently asked questions' }
    document.title = 'BrandQR — ' + (titles[route] || 'Visual QR gallery')
  }, [route])
  if (route === '/studio') return <Studio initialArt={initialArt} />
  if (route === '/credits') return <Credits artwork={artwork} />
  if (route === '/faq') return <Faq />
  return <Gallery artwork={artwork} onUse={item => {
    setInitialArt(item)
    location.hash = '/studio'
  }} />
}

createRoot(document.getElementById('root')).render(<App />)

