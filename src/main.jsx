import React, { lazy, Suspense, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { ArrowLeft, Plus } from 'lucide-react'
import { DisclosurePanel } from './disclosure-panel'
import { Credits, Gallery, ScrambleLabel } from './gallery'
import { galleryArtwork } from './samples'
import './style.css'
import './gallery.css'

gsap.registerPlugin(useGSAP)

const Studio = lazy(() => import('./studio'))

const questions = [
  ['Is BrandQR free?', 'Yes. You can create, verify, and download your QR codes without an account or a watermark.'],
  ['Do QR codes expire?', 'The printed code stays the same. A website link works as long as its destination is available.'],
  ['Can I change the destination later?', 'The destination is encoded directly in each QR. Create and export a new code to use a different destination.'],
  ['Will my code scan when printed?', 'BrandQR checks the generated image against the destination with a built-in decoder. Scan a printed sample at its final size before printing in bulk.'],
  ['What kind of artwork works best?', 'Try a sharp image with a clear subject. Lower image opacity if the preview needs more contrast.'],
  ['Where do my images go?', 'Your browser processes artwork on your device. BrandQR does not upload or store it.'],
  ['Can I use my QR code for work?', 'Yes. Use it on packaging, signs, or menus with artwork you have permission to use.'],
]

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

function getRoute() {
  return (location.hash.startsWith('#/') ? location.hash.slice(1) : location.pathname).replace(/\/$/, '') || '/'
}

function App() {
  const [route, setRoute] = useState(getRoute)
  const [initialArt, setInitialArt] = useState(null)
  useEffect(() => {
    const navigate = () => setRoute(getRoute())
    window.addEventListener('hashchange', navigate)
    return () => window.removeEventListener('hashchange', navigate)
  }, [])
  useEffect(() => {
    window.scrollTo(0, 0)
    if (route !== '/studio') setInitialArt(null)
    const titles = { '/studio': 'QR art studio', '/credits': 'Artwork credits', '/faq': 'Frequently asked questions' }
    document.title = 'BrandQR — ' + (titles[route] || 'Visual QR gallery')
  }, [route])
  if (route === '/studio') return <Suspense fallback={null}><Studio initialArt={initialArt} /></Suspense>
  if (route === '/credits') return <Credits artwork={galleryArtwork} />
  if (route === '/faq') return <Faq />
  return <Gallery artwork={galleryArtwork} onUse={item => {
    setInitialArt(item)
    location.hash = '/studio'
  }} />
}

createRoot(document.getElementById('root')).render(<App />)

