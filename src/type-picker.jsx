import React, { useRef, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import {
  CalendarDays, ChevronRight, CircleDollarSign, FileText, Globe2, Mail, MapPin,
  MessageSquare, Music2, Phone, Search, Share2, ShoppingBag, Star, UserRound, Video, Wifi, X,
} from 'lucide-react'
import { additionalTypes, primaryTypes } from './content-types'
import logos from './content-icons.json'

const groups = [additionalTypes[1], additionalTypes[0], ...additionalTypes.slice(2), ['Basics', primaryTypes]]
const total = groups.reduce((count, [, types]) => count + types.length, 0)
const phoneLayout = () => matchMedia('(max-width: 680px)').matches
const groupIcons = {
  Social: Share2, 'Contact and messaging': MessageSquare, 'Music and video': Music2,
  'Reviews and feedback': Star, 'Places and events': CalendarDays, 'Links and files': FileText,
  Meetings: Video, 'Shopping and payments': ShoppingBag, Basics: Globe2,
}
const typeIcons = {
  Contact: UserRound, 'Phone number': Phone, Email: Mail, SMS: MessageSquare, 'Wi-Fi': Wifi,
  'Google Maps': MapPin, 'Apple Maps': MapPin, 'Bitcoin payment': CircleDollarSign,
}
const brandSlugs = {
  'X / Twitter': 'x', LINE: 'line', 'Apple Music': 'applemusic', 'Amazon Review': 'amazon',
  'Google Forms': 'googleforms', 'Google Maps': 'googlemaps', 'Apple Maps': 'applemaps',
  'Google Drive': 'googledrive', 'Google Meet': 'googlemeet', 'Microsoft Teams': 'microsoftteams',
  'Cash App': 'cashapp', 'Bitcoin payment': 'bitcoin',
}
const descriptions = {
  Website: 'Opens a web page', Text: 'Displays a plain-text message', 'Wi-Fi': 'Joins a wireless network',
  Contact: 'Saves a contact card', 'Phone number': 'Opens the phone dialer', SMS: 'Starts a text message',
  Email: 'Opens a new email draft', 'Social profile': 'Opens a social profile or page',
  Discord: 'Opens a server invite or profile', 'Google Review': 'Opens a Google review form',
  'Google Forms': 'Opens a Google form', 'Amazon Review': 'Opens a product review page',
  Menu: 'Opens a restaurant menu', 'Google Maps': 'Opens a location in Google Maps',
  'Apple Maps': 'Opens a location in Apple Maps', Event: 'Opens an event page', Wedding: 'Opens a wedding page',
  RSVP: 'Opens an RSVP form', Ticket: 'Opens an event ticket link',
  PDF: 'Opens a PDF document', 'App download': 'Opens an app store listing',
  Linktree: 'Opens a page of links', Etsy: 'Opens an Etsy shop or listing',
  Amazon: 'Opens an Amazon product listing', 'Bitcoin payment': 'Opens a hosted Bitcoin checkout',
}
const groupDescriptions = {
  Social: type => 'Opens your ' + type + ' profile',
  'Contact and messaging': type => 'Opens a ' + type + ' chat link',
  'Music and video': type => 'Opens a ' + type + ' link',
  'Reviews and feedback': type => 'Opens a ' + type + ' page',
  'Places and events': type => 'Opens an event link for ' + type,
  'Links and files': type => 'Opens a shared ' + type.toLowerCase() + ' link',
  Meetings: type => 'Joins a ' + type + ' meeting',
  'Shopping and payments': type => 'Opens a ' + type + ' payment link',
}

export function TypePicker({ value, onSelect, onClose }) {
  const dialog = useRef(null)
  const search = useRef(null)
  const listing = useRef(null)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const keyword = query.trim().toLowerCase()
  const filtered = groups.map(([group, types]) => [group, types.filter(type =>
    (type + ' ' + (descriptions[type] || groupDescriptions[group]?.(type) || '')).toLowerCase().includes(keyword)
  )]).filter(([group, types]) => types.length > 0 && (!category || category === group))

  const { contextSafe } = useGSAP(() => {
    const element = dialog.current
    element.showModal()
    if (!phoneLayout()) search.current.focus()
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.fromTo(element, phoneLayout() ? { yPercent: 100 } : { y: 14, opacity: 0 },
        { yPercent: 0, y: 0, opacity: 1, duration: .32, ease: 'power3.out' })
    }
    return () => { if (element.open) element.close() }
  }, { scope: dialog })

  const dismiss = contextSafe(() => {
    const element = dialog.current
    if (!phoneLayout() || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      element.close()
      return
    }
    gsap.to(element, { yPercent: 100, duration: .23, ease: 'power2.in', overwrite: true, onComplete: () => element.close() })
  })

  function scrollToStart() {
    listing.current.scrollTop = 0
  }

  return <dialog id="additional-content-types" className="type-picker" ref={dialog} aria-labelledby="type-picker-title" closedby={phoneLayout() ? 'none' : undefined}
    onClose={onClose} onCancel={event => { if (phoneLayout()) event.preventDefault() }}
    onClick={event => { if (!phoneLayout() && event.target === event.currentTarget) dialog.current.close() }}>
    <div className="type-picker-shell">
      <header className="type-picker-header">
        <div>
          <h2 id="type-picker-title">Choose a content type</h2>
          <button type="button" className="icon-button" aria-label="Close content type picker" onClick={dismiss}><X size={21} /></button>
        </div>
        <label className="sr-only" htmlFor="type-search">Search content types</label>
        <div className="type-search"><Search aria-hidden="true" size={17} /><input ref={search} id="type-search" type="search" placeholder="Search Instagram, Wi-Fi, or PDF" value={query} onChange={event => {
          setQuery(event.target.value)
          scrollToStart()
        }} /></div>
      </header>
      <div className="type-picker-body">
        <div className="type-filters" role="group" aria-label="Content type categories">
          {[['', total], ...groups.map(([group, types]) => [group, types.length])].map(([group, count]) =>
            <button type="button" key={group} aria-pressed={category === group} onClick={() => { setCategory(group); scrollToStart() }}>
              <span>{group || 'All types'}</span><span aria-hidden="true">{count}</span>
            </button>
          )}
        </div>
        <div className="type-results" ref={listing}>
          {filtered.length === 0 && <p role="status" className="no-types">No types match your search.</p>}
          {filtered.map(([group, types]) => <section key={group} aria-label={group}>
            <h3>{group}</h3>
            <div className="type-cards">
              {types.map(type => {
                const LogoIcon = typeIcons[type] || groupIcons[group]
                const logo = logos[brandSlugs[type] || type.toLowerCase()]
                const id = 'pick-' + type.toLowerCase().replace(/[^a-z0-9]+/g, '-')
                const description = descriptions[type] || groupDescriptions[group]?.(type)
                return <button type="button" className="type-card" key={type} aria-pressed={type === value}
                  aria-labelledby={id} aria-describedby={id + '-description'} onClick={() => {
                    onSelect(type)
                    dismiss()
                  }}>
                  <span className="type-card-icon" aria-hidden="true" style={logo ? { '--brand-color': '#' + logo.color } : undefined}>
                    {logo ? <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">{logo.paths.map((path, index) => <path key={index} d={path} />)}</svg> : <LogoIcon size={19} />}
                  </span>
                  <span><strong id={id}>{type}</strong><small id={id + '-description'}>{description}</small></span>
                  <ChevronRight size={14} className="type-card-arrow" aria-hidden="true" />
                </button>
              })}
            </div>
          </section>)}
        </div>
      </div>
    </div>
  </dialog>
}
