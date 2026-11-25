import React, { useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'

export function DisclosurePanel({ open, id, children }) {
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
