import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import LinkHints from './components/LinkHints'
import TagPrompt from './components/TagPrompt'
import { LinkHint } from './utils/link-hints'
import { saveResource, getAllResources, Resource } from './utils/resource-storage'
import { getPageDescription, extractLinkContext } from './utils/dom-utils'

const LINK_HINTS_MODE_KEY = 'gist_link_hints_mode_active'

console.log('[LinkHintsApp] Content script loaded!', window.location.href)

window.addEventListener('error', (event) => {
  if (event.message?.includes('Extension context invalidated') || event.message?.includes('The message port closed')) {
    event.preventDefault()
    event.stopPropagation()
    console.warn('[LinkHintsApp] Extension context invalidated. Reload the page to restore full functionality.')
  }
})

console.log('[LinkHintsApp] Adding global keydown listener for debugging')
document.addEventListener('keydown', (e) => {
  console.log('[LinkHintsApp GLOBAL] Key pressed:', e.key, e.code, 'ctrl:', e.ctrlKey, 'shift:', e.shiftKey, 'meta:', e.metaKey)
}, true)

function LinkHintsApp() {
  const [visible, setVisible] = useState(false)
  const [showTagPrompt, setShowTagPrompt] = useState(false)
  const [tagPromptPosition, setTagPromptPosition] = useState({ top: 0, left: 0 })
  const [selectedLinkInfo, setSelectedLinkInfo] = useState<{
    url: string
    title: string
    text?: string
    pageUrl: string
    pageTitle: string
    pageDescription?: string
    linkContext?: string
  } | null>(null)
  const [existingTags, setExistingTags] = useState<string[]>([])

  useEffect(() => {
    const loadExistingTags = async () => {
      const resources = await getAllResources()
      const allTags = resources.flatMap(r => r.tags)
      const uniqueTags = Array.from(new Set(allTags))
      setExistingTags(uniqueTags)
    }
    loadExistingTags()
  }, [])

  useEffect(() => {
    console.log('[LinkHintsApp] Component mounted!')
    
    const checkStoredMode = () => {
      const isActive = localStorage.getItem(LINK_HINTS_MODE_KEY) === 'true'
      if (isActive) {
        setVisible(true)
        localStorage.removeItem(LINK_HINTS_MODE_KEY)
      }
    }

    checkStoredMode()

    const handleKeyPress = (e: KeyboardEvent) => {
      console.log('[LinkHintsApp] Key pressed:', e.key, 'ctrlKey:', e.ctrlKey, 'metaKey:', e.metaKey, 'shiftKey:', e.shiftKey)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'L') {
        e.preventDefault()
        e.stopPropagation()
        console.log('[LinkHintsApp] Matched Ctrl+Shift+L, toggling visible')
        setVisible(v => {
          const newValue = !v
          console.log('[LinkHintsApp] Setting visible to:', newValue)
          return newValue
        })
      }
    }

    console.log('[LinkHintsApp] Adding keyboard listener')
    document.addEventListener('keydown', handleKeyPress, true)

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

    window.addEventListener('message', handleLinkHintsMessage)

    return () => {
      document.removeEventListener('keydown', handleKeyPress, true)
      window.removeEventListener('message', handleLinkHintsMessage)
    }
  }, [])

  const handleLinkSelected = async (hint: LinkHint) => {
    console.log('[LinkHints] handleLinkSelected called with hint:', hint)
    const url = hint.href || hint.element.getAttribute('data-href') || window.location.href
    const title = hint.text || new URL(url).hostname || 'Untitled'
    
    const pageUrl = window.location.href
    const pageTitle = document.title
    const pageDescription = getPageDescription()
    const linkContext = extractLinkContext(hint.element)
    
    console.log('[LinkHints] URL:', url, 'Title:', title, 'Page URL:', pageUrl, 'Page Title:', pageTitle)

    const rect = hint.element.getBoundingClientRect()
    const position = {
      top: rect.bottom + 10,
      left: rect.left
    }

    setSelectedLinkInfo({
      url,
      title,
      text: hint.text,
      pageUrl,
      pageTitle,
      pageDescription,
      linkContext
    })
    setTagPromptPosition(position)
    setShowTagPrompt(true)
    setVisible(false)
  }

  const handleTagPromptSave = async (tags: string[], notes: string) => {
    if (!selectedLinkInfo) return

    const resource: Omit<Resource, 'id' | 'createdAt'> = {
      url: selectedLinkInfo.url,
      title: selectedLinkInfo.title,
      text: selectedLinkInfo.text,
      notes,
      tags,
      pageUrl: selectedLinkInfo.pageUrl,
      pageTitle: selectedLinkInfo.pageTitle,
      pageDescription: selectedLinkInfo.pageDescription,
      linkContext: selectedLinkInfo.linkContext
    }

    try {
      const saved = await saveResource(resource)
      console.log('[LinkHints] Saved resource:', saved)
      const updatedTags = Array.from(new Set([...existingTags, ...tags]))
      setExistingTags(updatedTags)
    } catch (error) {
      console.error('[LinkHints] Failed to save resource:', error)
    }

    setShowTagPrompt(false)
    setSelectedLinkInfo(null)
  }

  const handleTagPromptSkip = () => {
    if (!selectedLinkInfo) return

    const resource: Omit<Resource, 'id' | 'createdAt'> = {
      url: selectedLinkInfo.url,
      title: selectedLinkInfo.title,
      text: selectedLinkInfo.text,
      notes: '',
      tags: [],
      pageUrl: selectedLinkInfo.pageUrl,
      pageTitle: selectedLinkInfo.pageTitle,
      pageDescription: selectedLinkInfo.pageDescription,
      linkContext: selectedLinkInfo.linkContext
    }

    saveResource(resource).catch(error => {
      console.error('[LinkHints] Failed to save resource:', error)
    })

    setShowTagPrompt(false)
    setSelectedLinkInfo(null)
  }

  const handleClose = () => {
    setVisible(false)
  }

  return (
    <StrictMode>
      <LinkHints visible={visible} onLinkSelected={handleLinkSelected} onClose={handleClose} />
      {selectedLinkInfo && (
        <TagPrompt
          visible={showTagPrompt}
          position={tagPromptPosition}
          url={selectedLinkInfo.url}
          title={selectedLinkInfo.title}
          onSave={handleTagPromptSave}
          onSkip={handleTagPromptSkip}
          existingTags={existingTags}
        />
      )}
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
const shadow = container.attachShadow({ mode: 'open' })

const style = document.createElement('style')
style.textContent = `
  .fixed { position: fixed; }
  .inset-0 { top: 0; right: 0; bottom: 0; left: 0; }
  .pointer-events-none { pointer-events: none; }
  .pointer-events-auto { pointer-events: auto; }
  .z-\\[2147483647\\] { z-index: 2147483647; }
  .absolute { position: absolute; }
  .badge { display: inline-block; padding: 0.25em 0.4em; font-size: 0.75rem; font-weight: 700; line-height: 1; text-align: center; white-space: nowrap; vertical-align: baseline; border-radius: 0.25rem; }
  .badge-warning { background-color: #fbbf24; color: #000; }
  .cursor-pointer { cursor: pointer; }
  .hover\\:badge-warning:hover { background-color: #f59e0b; }
  .hover\\:scale-110:hover { transform: scale(1.1); }
  .transition-transform { transition-property: transform; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms; }
  .font-bold { font-weight: 700; }
  .text-\\[10px\\] { font-size: 10px; }
  .bottom-5 { bottom: 1.25rem; }
  .right-5 { right: 1.25rem; }
  .bg-base-300 { background-color: #484f58; color: #fff; }
  .opacity-90 { opacity: 0.9; }
  .text-base-content { color: #fff; }
  .px-4 { padding-left: 1rem; padding-right: 1rem; }
  .py-3 { padding-top: 0.75rem; padding-bottom: 0.75rem; }
  .rounded-box { border-radius: 0.5rem; }
  .shadow-lg { box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); }
  .font-semibold { font-weight: 600; }
  .text-sm { font-size: 0.875rem; }
  .mt-1\.5 { margin-top: 0.375rem; }
  .text-xs { font-size: 0.75rem; }
  .opacity-70 { opacity: 0.7; }

  .tag-prompt {
    background-color: #252526;
    border: 1px solid #3c3c3c;
    border-radius: 6px;
    padding: 12px;
    min-width: 320px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .tag-prompt-header {
    margin-bottom: 10px;
    padding-bottom: 8px;
    border-bottom: 1px solid #3c3c3c;
  }

  .tag-prompt-title {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: #cccccc;
    margin-bottom: 4px;
  }

  .tag-prompt-url {
    display: block;
    font-size: 10px;
    color: #6a9955;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 280px;
  }

  .tag-prompt-field {
    margin-bottom: 10px;
    position: relative;
  }

  .tag-prompt-label {
    display: block;
    font-size: 11px;
    color: #9cdcfe;
    margin-bottom: 4px;
  }

  .tag-prompt-input,
  .tag-prompt-textarea {
    width: 100%;
    padding: 8px;
    background-color: #1e1e1e;
    border: 1px solid #3c3c3c;
    border-radius: 3px;
    color: #e8e8e8;
    font-size: 12px;
    font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
    outline: none;
    box-sizing: border-box;
  }

  .tag-prompt-input:focus,
  .tag-prompt-textarea:focus {
    border-color: #0e639c;
    box-shadow: 0 0 0 1px #0e639c;
  }

  .tag-prompt-textarea {
    resize: vertical;
    min-height: 50px;
  }

  .tag-prompt-suggestions {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background-color: #1e1e1e;
    border: 1px solid #3c3c3c;
    border-radius: 3px;
    margin-top: 2px;
    z-index: 10;
    max-height: 150px;
    overflow-y: auto;
  }

  .tag-prompt-suggestion {
    padding: 6px 10px;
    font-size: 12px;
    color: #9cdcfe;
    cursor: pointer;
    font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
  }

  .tag-prompt-suggestion:hover,
  .tag-prompt-suggestion.selected {
    background-color: #0e639c;
    color: #e8e8e8;
  }

  .tag-prompt-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px solid #3c3c3c;
  }

  .tag-prompt-btn {
    padding: 6px 14px;
    font-size: 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    border: none;
    border-radius: 3px;
    cursor: pointer;
    font-weight: 500;
  }

  .tag-prompt-btn-skip {
    background-color: #3c3c3c;
    color: #e8e8e8;
  }

  .tag-prompt-btn-skip:hover {
    background-color: #4f4f4f;
  }

  .tag-prompt-btn-save {
    background-color: #0e639c;
    color: #e8e8e8;
  }

  .tag-prompt-btn-save:hover {
    background-color: #1177bb;
  }
`
shadow.appendChild(style)

const reactRoot = document.createElement('div')
reactRoot.id = 'react-root'
shadow.appendChild(reactRoot)
document.body.appendChild(container)
const root = createRoot(reactRoot)
root.render(<LinkHintsApp />)

export { getCssSelector }
