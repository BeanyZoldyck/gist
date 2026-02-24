import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import LinkHints from './components/LinkHints'
import { LinkHint } from './utils/link-hints'
import { saveAndSyncResource, Resource } from './utils/resource-storage'

const LINK_HINTS_MODE_KEY = 'gist_link_hints_mode_active'

function LinkHintsApp() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const checkStoredMode = () => {
      const isActive = localStorage.getItem(LINK_HINTS_MODE_KEY) === 'true'
      if (isActive) {
        setVisible(true)
        localStorage.removeItem(LINK_HINTS_MODE_KEY)
      }
    }
    
    checkStoredMode()

    const handleKeyPress = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'L') {
        e.preventDefault()
        e.stopPropagation()
        setVisible(v => !v)
      }
    }

    const handleLinkHintsMessage = (e: MessageEvent) => {
      if (e.data.type === 'ACTIVATE_LINK_HINTS') {
        e.preventDefault()
        e.stopPropagation()
        setVisible(true)
      } else if (e.data.type === 'DEACTIVATE_LINK_HINTS') {
        e.preventDefault()
        e.stopPropagation()
        setVisible(false)
      }
    }

    document.addEventListener('keydown', handleKeyPress, true)
    window.addEventListener('message', handleLinkHintsMessage)

    return () => {
      document.removeEventListener('keydown', handleKeyPress, true)
      window.removeEventListener('message', handleLinkHintsMessage)
    }
  }, [])

  const handleLinkSelected = async (hint: LinkHint) => {
    const url = hint.href || hint.element.getAttribute('data-href') || window.location.href
    const title = hint.text || new URL(url).hostname || 'Untitled'
    
    const resource: Omit<Resource, 'id' | 'createdAt'> = {
      url,
      title,
      text: hint.text,
      notes: '',
      tags: []
    }
    
    try {
      const result = await saveAndSyncResource(resource)
      console.log('[LinkHints] Saved resource:', result.resource)
      if (result.synced) {
        console.log('[LinkHints] Resource synced to API successfully')
      } else {
        console.warn('[LinkHints] Resource sync failed:', result.error)
      }
      
      if (hint.href) {
        window.open(hint.href, '_blank')
      } else {
        hint.element.click()
      }
    } catch (error) {
      console.error('[LinkHints] Failed to save resource:', error)
      
      if (hint.href) {
        window.open(hint.href, '_blank')
      } else {
        hint.element.click()
      }
    }
  }

  const handleClose = () => {
    setVisible(false)
  }

  return (
    <StrictMode>
      <LinkHints visible={visible} onLinkSelected={handleLinkSelected} onClose={handleClose} />
    </StrictMode>
  )
}

function getCssSelector(element: HTMLElement): string {
  if (element.id) {
    return `#${element.id}`
  }
  
  const parts: string[] = []
  let current: HTMLElement | null = element
  
  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase()
    
    if (current.id) {
      selector = `#${current.id}`
      parts.unshift(selector)
      break
    }
    
    if (current.className && typeof current.className === 'string') {
      const classes = current.className.split(' ').filter(Boolean)
      if (classes.length > 0) {
        selector += '.' + classes.join('.')
      }
    }
    
    const siblings = Array.from(current.parentElement?.children || [])
    const index = siblings.indexOf(current)
    
    if (siblings.length > 1) {
      selector += `:nth-child(${index + 1})`
    }
    
    parts.unshift(selector)
    current = current.parentElement
  }
  
  return parts.join(' > ')
}

const container = document.createElement('div')
container.id = 'link-hints-root'
document.body.appendChild(container)
const root = createRoot(container)
root.render(<LinkHintsApp />)

export { getCssSelector }
