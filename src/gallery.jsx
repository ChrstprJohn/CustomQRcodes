import React, { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { ArrowLeft, ArrowUpRight } from 'lucide-react'

const cardsPerTurn = 12
const turnCount = 5
const galleryCardCount = cardsPerTurn * turnCount
const initialRotation = Math.PI / cardsPerTurn
const goldenAngle = Math.PI * (3 - Math.sqrt(5))
const orbitRimDepth = -.68
const orbitRimX = Math.sqrt(1 - orbitRimDepth ** 2)
const headlineUses = ['website links', 'social profiles', 'Wi-Fi', 'contact cards', 'menus', 'payments and more']

function cameraFor(width, height) {
  const [fieldOfView, distance, radius, pitch, card] = width < 640 ? [70, 7.5, 4.5, 5.5, 1.15]
    : width < 1024 ? [60, 11, 6.5, 5, 1.5] : [50, 13, 7.8, 7, 1.7]
  const perspective = height / (2 * Math.tan(fieldOfView * Math.PI / 360))
  return { width, height, perspective, unit: perspective / distance, radius: radius * .72, pitch, card }
}

function projectCard(index, camera, scroll = 0, rotation = initialRotation, pointerX = 0, pointerY = 0) {
  const turn = Math.floor(index / cardsPerTurn)
  const fraction = index % cardsPerTurn / cardsPerTurn
  const phase = fraction * Math.PI * 2 + rotation
  const depth = Math.cos(phase)
  const sideways = Math.sin(phase)
  const length = turnCount * camera.pitch
  const ring = gsap.utils.wrap(-length / 2, length / 2, (turn - 2) * camera.pitch + scroll)
  const distance = (camera.perspective - depth * camera.radius * camera.unit)
  const projection = camera.perspective / distance
  const size = camera.card * camera.unit * 1.26 * projection
  const x = sideways * camera.radius * camera.unit * projection + pointerX * 90 * (projection - 1)
  const y = (ring - (fraction - .5) * camera.pitch) * camera.unit * projection + pointerY * 60 * (projection - 1)
  return {
    x, y, size,
    angle: sideways * 1.2,
    stacking: Math.round((depth + 1) * 37 + 3),
    haze: .55 * ((1 - depth) / 2) ** 1.5,
    visible: cardInFrame(x, y, size, camera),
  }
}

function cardInFrame(x, y, size, camera) {
  return Math.abs(x) < camera.width / 2 + size / 2 && Math.abs(y) < camera.height / 2 + size / 2
}

function projectOrbit(index, camera, zoom, rotation, pointerX) {
  const latitude = 1 - 2 * (index + .5) / galleryCardCount
  const phase = index * goldenAngle + rotation
  const sideways = Math.sin(phase)
  const depth = Math.cos(phase)
  const onFarSide = depth <= orbitRimDepth
  const farDepth = Math.min(depth, orbitRimDepth)
  const perspective = 1 / (1 - (farDepth - orbitRimDepth) * .46)
  const size = Math.min(camera.width * .28, camera.height * .2) * zoom * perspective
  const spread = perspective * (1 + (zoom - 1) * .5)
  const clearance = size * .58 + 30
  // Cards turn around the vertical axis and leave through the sides before they reach the front.
  const horizontal = onFarSide ? sideways / orbitRimX : Math.sign(sideways || 1)
  const x = horizontal * (camera.width * spread / 2 + clearance) + pointerX * 24 * perspective
  const y = latitude * camera.height * .53
  const sideInset = (camera.width - size) / 2 - Math.abs(x)
  const edge = gsap.utils.clamp(0, 1, (.22 - sideInset / Math.max(size, 1)) / .8)
  return {
    x, y, size, angle: sideways * 2.4,
    stacking: Math.round((farDepth + 1) * 37 + 3),
    haze: .48 * edge ** 2 * (3 - 2 * edge),
    visible: onFarSide && cardInFrame(x, y, size, camera),
  }
}

function mixCardPoses(from, to, progress, camera) {
  const x = gsap.utils.interpolate(from.x, to.x, progress)
  const y = gsap.utils.interpolate(from.y, to.y, progress)
  const size = gsap.utils.interpolate(from.size, to.size, progress)
  return {
    x, y, size,
    angle: gsap.utils.interpolate(from.angle, to.angle, progress),
    stacking: Math.round(gsap.utils.interpolate(from.stacking, to.stacking, progress)),
    haze: gsap.utils.interpolate(from.haze, to.haze, progress),
    visible: cardInFrame(x, y, size, camera),
  }
}

function cardStyle(pose) {
  return {
    '--motion-x': pose.x + 'px', '--motion-y': pose.y + 'px', '--motion-scale': pose.size / 200,
    '--motion-angle': pose.angle + 'deg', '--motion-layer': pose.stacking, '--motion-haze': pose.haze,
  }
}

function GalleryGrid() {
  const ref = useRef(null)
  useEffect(() => {
    const canvas = ref.current
    const paint = () => {
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      const ratio = Math.min(devicePixelRatio, 2)
      canvas.width = width * ratio
      canvas.height = height * ratio
      const context = canvas.getContext('2d')
      context.scale(ratio, ratio)
      context.strokeStyle = '#65687e36'
      context.lineWidth = 1
      const mobile = width < 681
      const columns = mobile ? 7 : 21
      for (let i = 0; i <= columns; i++) {
        const t = (i / columns - .5) * 2
        const x = width * (.5 + t * (.35 + .15 * t * t))
        context.beginPath()
        context.moveTo(x, 0)
        context.lineTo(x, height)
        context.stroke()
      }
      const rows = mobile ? 10 : 16
      for (let i = -3; i <= rows + 3; i++) {
        const y = i * height / rows
        const bow = (y - height / 2) * (mobile ? .12 : .34)
        context.beginPath()
        context.moveTo(0, y + bow)
        context.quadraticCurveTo(width / 2, y - bow, width, y + bow)
        context.stroke()
      }
    }
    const observer = new ResizeObserver(paint)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])
  return <canvas ref={ref} className="gallery-grid" aria-hidden="true" />
}

let hasRevealedGallery = false

function PixelReveal() {
  const canvas = useRef(null)
  const [done, setDone] = useState(hasRevealedGallery)
  useGSAP(() => {
    if (done) return
    const finish = () => { hasRevealedGallery = true; setDone(true) }
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finish()
      return
    }
    const layer = canvas.current
    if (matchMedia('(max-width: 680px), (pointer: coarse)').matches) {
      gsap.to(layer, { opacity: 0, duration: .3, ease: 'power1.out', onComplete: finish })
      return
    }
    const columns = 16
    const rows = Math.max(1, Math.ceil(layer.clientHeight / layer.clientWidth * columns))
    layer.width = columns
    layer.height = rows
    const context = layer.getContext('2d')
    context.fillStyle = '#eeecf3'
    const cells = Array.from({ length: columns * rows }, (_, index) => {
      const x = index % columns
      const y = Math.floor(index / columns)
      const distance = Math.hypot((x + .5) / columns - .5, (y + .5) / rows - .5)
      const random = (Math.sin(x * 17.13 + y * 43.91) * 13758.54) % 1
      return { x, y, threshold: distance * 1.04 + Math.abs(random) * .26 }
    }).sort((first, second) => first.threshold - second.threshold)
    let nextCell = 0
    const progress = { value: 0 }
    context.fillRect(0, 0, columns, rows)
    layer.style.background = 'transparent'
    gsap.to(progress, {
      value: 1, duration: .68, ease: 'none',
      onUpdate: () => {
        while (nextCell < cells.length && cells[nextCell].threshold <= progress.value) {
          const { x, y } = cells[nextCell++]
          context.clearRect(x, y, 1, 1)
        }
      },
      onComplete: finish,
    })
  }, { dependencies: [done], revertOnUpdate: true })
  return done ? null : <canvas ref={canvas} className="pixel-reveal" aria-hidden="true" />
}

export function ScrambleLabel({ children, revealOnMount = false }) {
  const effect = useRef(null)
  useEffect(() => {
    const layer = effect.current
    const label = layer.parentElement
    const control = label.parentElement
    let frame
    let timer
    let entering = revealOnMount
    const reduced = matchMedia('(prefers-reduced-motion: reduce)')
    const symbols = '#%+?@<>0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const letters = [...children]
    function settle() {
      layer.textContent = ''
      delete label.dataset.scrambling
      delete label.dataset.entering
      entering = false
    }
    function animate(duration, entrance) {
      const start = performance.now()
      function draw(now) {
        const progress = (now - start) / duration
        if (progress >= 1 || reduced.matches) return settle()
        const windowSize = entrance ? 6 : 0
        const count = Math.floor(progress * (letters.length + windowSize)) - windowSize
        layer.textContent = letters.map((letter, index) => {
          if (letter === ' ' || index < count) return letter
          if (entrance && index >= count + windowSize) return ''
          return symbols[(Math.floor(now / 45) + index * 7) % symbols.length]
        }).join('')
        if (!entrance) label.dataset.scrambling = ''
        frame = requestAnimationFrame(draw)
      }
      frame = requestAnimationFrame(draw)
    }
    function play(event) {
      if (entering || event.pointerType === 'touch' || reduced.matches) return
      cancelAnimationFrame(frame)
      animate(450, false)
    }
    if (entering && !reduced.matches) {
      frame = requestAnimationFrame(() => {
        const { top, left } = label.getBoundingClientRect()
        const delay = 450 + (top > innerHeight / 2 ? 250 : 0) + Math.max(0, left) / innerWidth * 350
        timer = setTimeout(() => animate(700, true), delay)
      })
    } else {
      settle()
    }
    control.addEventListener('pointerenter', play)
    control.addEventListener('focusin', play)
    return () => {
      clearTimeout(timer)
      cancelAnimationFrame(frame)
      settle()
      control.removeEventListener('pointerenter', play)
      control.removeEventListener('focusin', play)
    }
  }, [children, revealOnMount])
  return <span className="scramble-label" data-entering={revealOnMount ? '' : undefined}><span>{children}</span><span ref={effect} aria-hidden="true" /></span>
}

function AboutPanel({ onClose }) {
  const panel = useRef(null)
  useGSAP(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const lines = [...panel.current.querySelectorAll('[data-about-line]')]
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=<>/'
    lines.forEach((line, index) => {
      const original = line.firstElementChild
      const reveal = line.lastElementChild
      const letters = [...original.textContent]
      const progress = { value: 0 }
      original.style.opacity = '0'
      gsap.to(progress, {
        value: 1, duration: 1.1, delay: [.23, .38, .63][index], ease: 'none',
        onUpdate: () => {
          const end = Math.floor(progress.value * (letters.length + 10))
          reveal.textContent = letters.slice(0, end).map((letter, position) =>
            letter === ' ' || position < end - 10 ? letter : alphabet[(position * 7 + Math.floor(performance.now() / 45)) % alphabet.length]
          ).join('')
        },
        onComplete: () => { original.style.opacity = ''; reveal.textContent = '' },
      })
    })
  }, { scope: panel })
  return <div className="about-content" ref={panel}>
    <div className="about-heading">
      <h2 id="gallery-dialog-title" data-about-line><span>About BrandQR</span><span aria-hidden="true" /></h2>
      <button type="button" aria-label="Close about" onClick={onClose}><ScrambleLabel>Close ×</ScrambleLabel></button>
    </div>
    <p data-about-line><span>BrandQR turns photos and illustrations into scannable QR codes for links, text, Wi-Fi, and contacts.</span><span aria-hidden="true" /></p>
    <p data-about-line><span>Try an image from the gallery or upload your own. Your artwork and scan checks stay on your device.</span><span aria-hidden="true" /></p>
  </div>
}

function GalleryDialog({ item, artwork, onClose, onUse, onSelect }) {
  const dialog = useRef(null)
  const backdropPress = useRef(false)
  const about = item === 'about'
  const [closing, setClosing] = useState(false)
  const position = artwork.indexOf(item)
  const step = delta => onSelect(artwork[(position + delta + artwork.length) % artwork.length])
  function dismiss() {
    if (about || matchMedia('(prefers-reduced-motion: reduce)').matches) dialog.current.close()
    else setClosing(true)
  }
  useEffect(() => {
    dialog.current.showModal()
  }, [])
  return <dialog ref={dialog} className={about ? 'gallery-dialog about-dialog' : 'gallery-dialog artwork-viewer'} data-closing={closing || undefined} aria-labelledby="gallery-dialog-title" onClose={onClose}
    onCancel={event => { event.preventDefault(); dismiss() }}
    onAnimationEnd={event => {
      if (event.target === event.currentTarget && event.animationName === 'viewer-fade-out' && closing) event.currentTarget.close()
    }}
    onKeyDown={event => {
    if (about || closing || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return
    event.preventDefault()
    step(event.key === 'ArrowLeft' ? -1 : 1)
  }} onPointerDown={event => {
    backdropPress.current = event.target === event.currentTarget
  }} onClick={event => {
    if (backdropPress.current && event.target === event.currentTarget) dismiss()
    backdropPress.current = false
  }}>
    {!about && <>
      <header className="viewer-header">
        <span aria-live="polite">{position + 1} / {artwork.length}</span>
        <button type="button" aria-label="Close preview" onClick={dismiss}><ScrambleLabel revealOnMount>Close ×</ScrambleLabel></button>
      </header>
      <article className="viewer-main">
        <img key={item.name} className="viewer-image" src={item.code} alt={'Visual QR code featuring ' + item.name} />
        <div className="viewer-meta" key={'meta-' + item.name}>
          <h2 id="gallery-dialog-title" title={item.name}>{item.name}</h2>
          <p className="viewer-credit">Image by {item.url ? <a href={item.url} target="_blank" rel="noreferrer"><ScrambleLabel revealOnMount>{item.artist.split(' (')[0]}</ScrambleLabel></a> : <ScrambleLabel revealOnMount>{item.artist}</ScrambleLabel>}</p>
        </div>
        {item.verified && <span className="sr-only">Scan verified</span>}
        <nav className="viewer-navigation" aria-label="Artwork navigation">
          <button type="button" aria-label="Previous artwork" onClick={() => step(-1)}><ScrambleLabel revealOnMount>← Prev</ScrambleLabel></button>
          <button type="button" className="pill" aria-label="Use this artwork" onClick={() => onUse(item)}><ScrambleLabel revealOnMount>Make one like this</ScrambleLabel></button>
          <button type="button" aria-label="Next artwork" onClick={() => step(1)}><ScrambleLabel revealOnMount>Next →</ScrambleLabel></button>
        </nav>
      </article>
    </>}
    {about && <AboutPanel onClose={dismiss} />}
  </dialog>
}

export function Gallery({ artwork, onUse }) {
  const root = useRef(null)
  const field = useRef(null)
  const touch = useRef(null)
  const layoutProgress = useRef({ orbit: 0 })
  const redraw = useRef(null)
  const [active, setActive] = useState(null)
  const [layout, setLayout] = useState('Spiral')
  const [initialCamera] = useState(() => cameraFor(innerWidth, innerHeight))

  useGSAP(() => {
    const scene = root.current.querySelector('.gallery-scene')
    const grid = scene.querySelector('.gallery-grid')
    const title = scene.querySelector('.gallery-title')
    const viewport = field.current
    const cards = [...viewport.children]
    const progress = layoutProgress.current
    let camera
    let paintedOrbit
    const paint = (scroll = 0, rotation = initialRotation, pointerX = 0, pointerY = 0, zoom = 1, orbitTurn = 0) => {
      const titleX = pointerX * 6
      const titleY = pointerY * 6
      const orbit = progress.orbit
      const orbitRotation = initialRotation + (rotation - initialRotation) * .42 + orbitTurn
      paintedOrbit = orbit
      cards.forEach((element, index) => {
        let pose
        if (orbit < 1) pose = projectCard(index, camera, scroll, rotation, pointerX, pointerY)
        if (orbit > 0) {
          const orbitalPose = projectOrbit(index, camera, zoom, orbitRotation, pointerX)
          pose = orbit === 1 ? orbitalPose : mixCardPoses(pose, orbitalPose, orbit, camera)
        }
        if (!pose.visible) {
          if (element.style.visibility !== 'hidden') element.style.visibility = 'hidden'
          return
        }
        for (const [property, value] of Object.entries(cardStyle(pose))) element.style.setProperty(property, value)
        if (element.style.visibility !== 'visible') element.style.visibility = 'visible'
      })
      grid.style.translate = -pointerX * 18 + 'px ' + -pointerY * 18 + 'px'
      title.style.translate = titleX + 'px ' + titleY + 'px'
    }
    let draw = paint
    redraw.current = () => draw()
    const measure = () => {
      camera = cameraFor(viewport.clientWidth, viewport.clientHeight)
      draw()
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(viewport)

    const media = gsap.matchMedia()
    media.add('(prefers-reduced-motion: no-preference)', () => {
      let scroll = 0
      let scrollTarget = 0
      let zoom = 1
      let zoomTarget = 1
      let orbitTurn = 0
      let easedOrbitTurn = 0
      let orbitTurnTarget = 0
      let rotation = initialRotation
      let spin = 0
      let pointerX = 0
      let pointerY = 0
      let targetX = 0
      let targetY = 0
      let headlineTime = 0
      let headlineIndex = 0
      let headlineIntro = true
      let touchY
      const canHover = matchMedia('(hover: hover)').matches
      const coarsePointer = matchMedia('(pointer: coarse)').matches
      let frameTime = 0
      const headlineWords = [...title.querySelectorAll('.headline-word')]
      const headlineLetters = headlineWords.map(word => [...word.querySelectorAll('.headline-letter')])
      const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789#%&*+=<>/'
      draw = () => paint(scroll, rotation, pointerX, pointerY, zoom, orbitTurn)
      const textMotion = { progress: 0 }
      let lastScrambleStep = -1
      const settleHeadline = () => {
        const word = headlineWords[headlineIndex]
        delete word.dataset.scrambling
        word.style.removeProperty('--glitch-offset')
        for (const letter of headlineLetters[headlineIndex]) delete letter.dataset.symbol
      }
      const scramble = gsap.to(textMotion, {
        progress: 1, duration: .9, ease: 'none', paused: true,
        onStart: () => {
          lastScrambleStep = -1
          headlineWords[headlineIndex].dataset.scrambling = ''
        },
        onUpdate: () => {
          const step = Math.floor(textMotion.progress * 20)
          if (step === lastScrambleStep) return
          lastScrambleStep = step
          headlineWords[headlineIndex].style.setProperty('--glitch-offset', (step % 5) * 30 + '%')
          const letters = headlineLetters[headlineIndex]
          const settled = Math.floor(step / 20 * (letters.length + 3)) - 3
          letters.forEach((letter, index) => {
            if (index < settled) delete letter.dataset.symbol
            else letter.dataset.symbol = alphabet[(index * 7 + step * 13) % alphabet.length]
          })
        },
        onComplete: settleHeadline,
      })
      const drift = (_time, delta) => {
        frameTime += delta
        if (coarsePointer && progress.orbit === 0 && scene.dataset.layout === 'Spiral' && frameTime < 1000 / 30) return
        const elapsed = Math.min(frameTime, 50)
        frameTime = 0
        if (document.hidden || root.current.querySelector('dialog[open]')) return
        const step = elapsed / 1000
        headlineTime += elapsed
        if (headlineTime >= 3000) {
          headlineTime = 0
          delete headlineWords[headlineIndex].dataset.current
          headlineIndex = (headlineIndex + 1) % headlineWords.length
          headlineWords[headlineIndex].dataset.current = ''
          scramble.restart()
        } else if (headlineIntro && headlineTime >= 1400) {
          headlineIntro = false
          scramble.restart()
        }
        const scrollDelta = (scrollTarget - scroll) * (1 - Math.exp(-10 * step))
        const orbitEase = 1 - Math.exp(-6 * step)
        const zoomDelta = (zoomTarget - zoom) * orbitEase
        const turnEase = 1 - Math.exp(-8 * step)
        easedOrbitTurn += (orbitTurnTarget - easedOrbitTurn) * turnEase
        const orbitTurnDelta = (easedOrbitTurn - orbitTurn) * turnEase
        const xDelta = (targetX - pointerX) * (1 - Math.exp(-4 * step))
        const yDelta = (targetY - pointerY) * (1 - Math.exp(-4 * step))
        const hovered = canHover && !!scene.querySelector('.gallery-card:hover')
        const idle = document.activeElement?.matches('.gallery-card:focus-visible') ? 0 : 4.6 * Math.PI / 180
        const turn = (idle + spin) * (hovered ? .35 : 1) * step
        if (paintedOrbit === progress.orbit &&
          Math.abs(scrollDelta) + Math.abs(zoomDelta) + Math.abs(orbitTurnDelta)
          + Math.abs(xDelta) + Math.abs(yDelta) + Math.abs(turn) < .00005) return
        scroll += scrollDelta
        zoom += zoomDelta
        orbitTurn += orbitTurnDelta
        pointerX += xDelta
        pointerY += yDelta
        rotation += turn
        spin *= .92 ** (step * 60)
        draw()
      }
      gsap.ticker.add(drift)
      draw()
      const advance = delta => {
        if (scene.dataset.layout === 'Orbit') {
          orbitTurnTarget += delta * .00055
          zoomTarget = gsap.utils.clamp(1, 1.22, zoomTarget + delta * .00055)
          return
        }
        scrollTarget -= delta * .0048
        spin = gsap.utils.clamp(-2, 2, spin + delta * .0036)
      }
      const pointer = event => {
        if (event.pointerType !== 'mouse') return
        const rect = scene.getBoundingClientRect()
        targetX = (event.clientX - rect.left) / rect.width * 2 - 1
        targetY = (event.clientY - rect.top) / rect.height * 2 - 1
      }
      const pointerOut = () => { targetX = 0; targetY = 0 }
      const wheel = event => {
        if (event.ctrlKey) return
        event.preventDefault()
        const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1
        advance((event.deltaY + event.deltaX) * scale)
      }
      const start = event => { touchY = event.touches.length === 1 ? event.touches[0].clientY : undefined }
      const swipe = event => {
        if (event.touches.length !== 1 || touchY === undefined) return
        const nextY = event.touches[0].clientY
        advance((touchY - nextY) * 2.2)
        touchY = nextY
      }
      const key = event => {
        if (event.target !== document.body && event.target !== scene) return
        const direction = { ArrowDown: 1, ArrowRight: 1, PageDown: 3, ArrowUp: -1, ArrowLeft: -1, PageUp: -3 }[event.key]
        if (!direction) return
        event.preventDefault()
        advance(direction * 90)
      }
      scene.addEventListener('wheel', wheel, { passive: false })
      scene.addEventListener('touchstart', start, { passive: true })
      scene.addEventListener('touchmove', swipe, { passive: true })
      scene.addEventListener('pointermove', pointer, { passive: true })
      scene.addEventListener('pointerleave', pointerOut)
      window.addEventListener('keydown', key)
      return () => {
        scene.removeEventListener('wheel', wheel)
        scene.removeEventListener('touchstart', start)
        scene.removeEventListener('touchmove', swipe)
        scene.removeEventListener('pointermove', pointer)
        scene.removeEventListener('pointerleave', pointerOut)
        window.removeEventListener('keydown', key)
        gsap.ticker.remove(drift)
        settleHeadline()
        delete headlineWords[headlineIndex].dataset.current
        headlineWords[0].dataset.current = ''
        gsap.killTweensOf(progress)
        progress.orbit = scene.dataset.layout === 'Orbit' ? 1 : 0
        draw = paint
        draw()
      }
    })
    return () => {
      observer.disconnect()
      media.revert()
      redraw.current = null
    }
  }, { scope: root })

  useGSAP(() => {
    const progress = layoutProgress.current
    const orbit = layout === 'Orbit' ? 1 : 0
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      progress.orbit = orbit
      redraw.current?.()
    } else if (progress.orbit !== orbit || gsap.getTweensOf(progress).length) {
      gsap.to(progress, { orbit, duration: .72, ease: 'power3.inOut', overwrite: true })
    }
  }, { scope: root, dependencies: [layout] })

  function positionView(event) {
    if (event.pointerType !== 'mouse') return
    const card = event.currentTarget
    const bounds = card.getBoundingClientRect()
    const { clientX: x, clientY: y } = event
    card.setAttribute('data-view-pointer', '')
    card.style.setProperty('--view-x', gsap.utils.clamp(20, 80, (x - bounds.left) / bounds.width * 100) + '%')
    card.style.setProperty('--view-y', gsap.utils.clamp(13, 87, (y - bounds.top) / bounds.height * 100) + '%')
  }

  return <main className="gallery-page" ref={root}>
    <section className="gallery-scene" aria-label="Visual QR gallery" tabIndex={0} data-layout={layout}>
      <GalleryGrid />
      <header className="gallery-header">
        <a className="wordmark" href="#/" aria-label="BrandQR home"><ScrambleLabel>BrandQR</ScrambleLabel></a>
        <a className="pill gallery-cta" href="#/studio"><ScrambleLabel>Create QRcode</ScrambleLabel></a>
      </header>
      <footer className="gallery-toolbar">
        <a href="#/credits" aria-label="Artwork credits"><ScrambleLabel>Credits</ScrambleLabel></a>
        <div className="gallery-modes" role="group" aria-label="Gallery layout">
          {['Spiral', 'Orbit'].map(mode => <button type="button" key={mode}
            aria-pressed={layout === mode} onClick={() => setLayout(mode)}>{mode}</button>)}
        </div>
        <div className="gallery-footer-links">
          <a href="#/faq" aria-label="FAQ"><ScrambleLabel>FAQ</ScrambleLabel></a>
          <button className="about-link" onClick={() => setActive('about')}><ScrambleLabel>About</ScrambleLabel></button>
        </div>
      </footer>
      <div className="composition" ref={field} aria-busy={false}>
        {Array.from({ length: galleryCardCount }, (_, index) => {
          const item = artwork[(index + 20) % artwork.length]
          const pose = projectCard(index, initialCamera)
          return <div className="gallery-position" key={index} data-turn={Math.floor(index / cardsPerTurn)}
            style={{ ...cardStyle(pose), visibility: pose.visible ? 'visible' : 'hidden' }}>
            <button className="gallery-card" aria-label={'View ' + item.name}
              onPointerEnter={positionView} onPointerMove={positionView} onPointerLeave={event => event.currentTarget.removeAttribute('data-view-pointer')}
              onPointerDown={event => {
                if (event.pointerType !== 'touch' || !event.isPrimary) return
                touch.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
                event.currentTarget.setPointerCapture(event.pointerId)
              }} onPointerCancel={() => { touch.current = null }}
              onPointerUp={event => {
                const press = touch.current
                if (event.pointerType !== 'touch' || press?.id !== event.pointerId) return
                touch.current = null
                if (Math.hypot(press.x - event.clientX, press.y - event.clientY) < 9) setActive(item)
              }} onClick={event => {
                if (event.nativeEvent.pointerType !== 'touch') setActive(item)
              }}>
              <img src={item.code} alt="" loading={pose.visible ? 'eager' : 'lazy'} decoding="async" draggable="false" />
              <span className="gallery-view" aria-hidden="true">View</span>
            </button>
          </div>
        })}
      </div>
      <div className="gallery-title">
        <h1 aria-label={'Custom QR codes for ' + headlineUses.join(', ')}>
          Custom QR codes for
          <span className="headline-words" aria-hidden="true">
            {headlineUses.map((use, index) => <span className="headline-word" key={use}
              data-current={index === 0 ? '' : undefined}>
              {[...use].map((letter, index) => letter === ' ' ? ' ' :
                <span className="headline-letter" key={index}><span>{letter}</span></span>)}
              <span className="headline-glitch"><span /><span /><span /></span>
            </span>)}
          </span>
        </h1>
      </div>
      <div className="scroll-cue"><span className="wheel-cue">Scroll to explore</span><span className="touch-cue">Swipe to explore</span></div>
      <PixelReveal />
    </section>
    {active && <GalleryDialog item={active} artwork={artwork} onClose={() => setActive(null)} onUse={onUse} onSelect={setActive} />}
  </main>
}

export function Credits({ artwork }) {
  return <main className="credits shell">
    <header className="credits-header"><a className="back-link" href="#/" aria-label="Back to gallery"><ArrowLeft size={13} /> <ScrambleLabel>BrandQR</ScrambleLabel></a><span>©2026</span></header>
    <p className="credits-kicker">Credits</p>
    <h1>Artwork credits</h1>
    <p>The gallery combines BrandQR samples with open-access art and licensed photography. Follow the source links to see the originals.</p>
    <ul>{artwork.map(item => <li key={item.name}><span>{item.name}</span><small>{item.url ? <a href={item.url} target="_blank" rel="noreferrer">{item.artist} · {item.license} ↗</a> : item.artist}</small></li>)}</ul>
    <a className="pill" href="#/studio">Open studio <ArrowUpRight size={16} /></a>
  </main>
}

