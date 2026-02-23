import { StrictMode, useState, useEffect, useRef, useCallback } from 'react'
import { createRoot } from 'react-dom/client'
import InputCompletion from './components/InputCompletion'
import { completionManager, SearchResult } from './utils/completion-manager'
import { getAllResources } from './utils/resource-storage'

console.log('[InputCompletionApp] ========== CONTENT SCRIPT LOADED ==========')

let completionVisible = false
let completionActivateFn: (() => void) | null = null
let completionCloseFn: (() => void) | null = null

const setupCompletionListeners = (activateFn: () => void, closeFn: () => void) => {
  completionActivateFn = activateFn
  completionCloseFn = closeFn
}

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.code === 'Space') {
    console.log('[InputCompletionApp GLOBAL] Ctrl+Space detected, visible:', completionVisible)
    e.preventDefault()
    e.stopPropagation()
    
    if (completionVisible && completionCloseFn) {
      completionCloseFn()
    } else if (completionActivateFn) {
      completionActivateFn()
    }
  }
}, true)

window.addEventListener('error', (event) => {
  if (event.message?.includes('Extension context invalidated') || event.message?.includes('The message port closed')) {
    event.preventDefault()
    event.stopPropagation()
    console.warn('[InputCompletionApp] Extension context invalidated. Reload the page to restore full functionality.')
  }
})

getAllResources().then(resources => {
  console.log('[InputCompletionApp] All saved resources:', resources)
}).catch(error => {
  console.error('[InputCompletionApp] Failed to load resources:', error)
})

interface InputCompletionAppProps {
  shadowRoot: ShadowRoot
}

function InputCompletionApp({ shadowRoot }: InputCompletionAppProps) {
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const activeElementRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLElement | null>(null)

  console.log('[InputCompletionApp] Render - visible:', visible, 'position:', position)

  const isUsefulInput = (element: Element): boolean => {
    if (!(element instanceof HTMLElement)) return false

    if (element instanceof HTMLTextAreaElement) return true

    if (element instanceof HTMLInputElement) {
      const type = element.type?.toLowerCase()
      const excludedTypes = ['password', 'hidden', 'submit', 'reset', 'button', 'image', 'file']

      if (excludedTypes.includes(type)) return false

      const minLength = 3
      if (element.maxLength > 0 && element.maxLength < minLength) return false

      return true
    }

    if (element.isContentEditable) return true

    return false
  }

  const handleClose = useCallback(() => {
    console.log('[InputCompletionApp] handleClose called')
    completionManager.deactivateCompletion()
    setVisible(false)
    activeElementRef.current = null
    setPosition(null)
    setSearchResults([])
    setIsSearching(false)
  }, [])

  const handleResourceSelected = useCallback((result: SearchResult) => {
    console.log('[InputCompletionApp] handleResourceSelected:', result)
    completionManager.replaceWithUrl(result.url)
    handleClose()
  }, [handleClose])

  const getCursorPosition = (element: HTMLElement): { top: number; left: number } | null => {
    if (element.isContentEditable) {
      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        const rect = range.getBoundingClientRect()
        return {
          top: rect.bottom + window.scrollY,
          left: rect.left + window.scrollX
        }
      }
      return null
    }

    if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
      const textarea = element
      const mirror = document.createElement('div')
      const styles = window.getComputedStyle(textarea)
      
      const propNames = [
        'font-family', 'font-size', 'font-weight', 'font-style',
        'letter-spacing', 'line-height', 'text-transform', 'word-spacing',
        'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
        'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
        'box-sizing', 'white-space', 'word-wrap', 'word-break'
      ]
      
      propNames.forEach(prop => {
        mirror.style[prop as any] = styles.getPropertyValue(prop)
      })
      
      mirror.style.position = 'absolute'
      mirror.style.visibility = 'hidden'
      mirror.style.width = styles.width
      mirror.style.top = '-9999px'
      mirror.style.left = '-9999px'
      
      const textBeforeCursor = textarea.value.substring(0, textarea.selectionStart ?? 0)
      mirror.textContent = textBeforeCursor.replace(/\n$/g, '\n ')
      
      document.body.appendChild(mirror)
      
      const cursorRect = mirror.getBoundingClientRect()
      document.body.removeChild(mirror)
      
      return {
        top: cursorRect.bottom + window.scrollY,
        left: cursorRect.left + window.scrollX
      }
    }
    
    return null
  }

  const activateCompletion = useCallback(() => {
    const focusedElement = document.activeElement

    console.log('[InputCompletionApp] activateCompletion called, focusedElement:', focusedElement)

    if (!focusedElement) {
      console.log('[InputCompletionApp] No focused element, returning')
      return
    }

    console.log('[InputCompletionApp] Element type:', focusedElement.tagName, 'contenteditable:', (focusedElement as HTMLElement).isContentEditable)
    console.log('[InputCompletionApp] isUsefulInput check:', isUsefulInput(focusedElement))

    if (isUsefulInput(focusedElement)) {
      try {
        const inputElement = focusedElement as HTMLElement
        
        let top: number, left: number
        let rect: DOMRect | null = null
        
        const cursorPos = getCursorPosition(inputElement)
        if (cursorPos) {
          top = cursorPos.top + 4
          left = cursorPos.left
        } else {
          rect = inputElement.getBoundingClientRect()
          top = rect.bottom + window.scrollY + 4
          left = rect.left + window.scrollX
        }

        if (rect && top + 400 > window.innerHeight + window.scrollY) {
          top = rect.top + window.scrollY - 404
        }

        if (left + 350 > window.innerWidth + window.scrollX) {
          left = window.innerWidth + window.scrollX - 354
        }

        console.log('[InputCompletionApp] Setting completion options')
        completionManager.setOptions({
          onResultsChange: (results) => {
            console.log('[InputCompletionApp] Results changed:', results)
            setSearchResults(results)
          },
          onClose: () => {
            console.log('[InputCompletionApp] Completion close callback')
            handleClose()
          }
        })

        console.log('[InputCompletionApp] Calling completionManager.activateCompletion')
        completionManager.activateCompletion(inputElement)

        console.log('[InputCompletionApp] Activating completion for element:', inputElement)
        console.log('[InputCompletionApp] Setting position:', { top, left })

        activeElementRef.current = inputElement
        setPosition({ top, left })
        setVisible(true)
        setSearchResults([])
        setIsSearching(false)

        console.log('[InputCompletionApp] State updated - visible:', true)
      } catch (error) {
        console.error('[InputCompletionApp] Error in activateCompletion:', error)
      }
    }
  }, [handleClose])

  useEffect(() => {
    setupCompletionListeners(activateCompletion, handleClose)
  }, [activateCompletion, handleClose])

  useEffect(() => {
    completionVisible = visible
  }, [visible])

  useEffect(() => {
    console.log('[InputCompletionApp] Setting up event listeners')

    const handleKeyDown = (e: KeyboardEvent) => {
      console.log('[InputCompletionApp] Key pressed:', e.key, e.code, 'ctrl:', e.ctrlKey, 'meta:', e.metaKey)

      const isSpaceKey = e.code === 'Space'

      if ((e.ctrlKey || e.metaKey) && isSpaceKey) {
        console.log('[InputCompletionApp] Ctrl+Space detected, visible:', visible)
        e.preventDefault()
        e.stopPropagation()

        if (visible) {
          console.log('[InputCompletionApp] Closing completion')
          handleClose()
        } else {
          console.log('[InputCompletionApp] Activating completion')
          activateCompletion()
        }
      }
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (visible && activeElementRef.current) {
        const menuElement = document.querySelector('.gist-completion-menu')
        if (menuElement && !menuElement.contains(e.target as Node) && e.target !== activeElementRef.current) {
          handleClose()
        }
      }
    }

document.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('keydown', handleKeyDown, true)
    document.addEventListener('mousedown', handleClickOutside, true)

    return () => {
      console.log('[InputCompletionApp] Cleaning up event listeners')
      document.removeEventListener('keydown', handleKeyDown, true)
      document.removeEventListener('mousedown', handleClickOutside, true)
    }
  }, [visible, activateCompletion, handleClose])

  useEffect(() => {
    const handleFocusChange = () => {
      if (visible) {
        const focusedElement = document.activeElement
        if (focusedElement && isUsefulInput(focusedElement) && focusedElement !== activeElementRef.current) {
          handleClose()
        }
      }
    }

    document.addEventListener('focusin', handleFocusChange)
    return () => document.removeEventListener('focusin', handleFocusChange)
  }, [visible, handleClose])



  console.log('[InputCompletionApp] Rendering component, visible:', visible, 'position:', position)

  return (
    <StrictMode>
      <InputCompletion
        visible={visible}
        position={position}
        results={searchResults}
        isSearching={isSearching}
        onResourceSelected={handleResourceSelected}
        onClose={handleClose}
        portalRoot={shadowRoot}
      />
    </StrictMode>
  )
}

const container = document.createElement('div')
container.id = 'input-completion-root'
const shadow = container.attachShadow({ mode: 'open' })
const reactRoot = document.createElement('div')
reactRoot.id = 'react-root'
shadow.appendChild(reactRoot)
document.body.appendChild(container)

const root = createRoot(reactRoot)
root.render(<InputCompletionApp shadowRoot={shadow} />)
