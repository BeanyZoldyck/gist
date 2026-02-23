import { StrictMode, useState, useEffect, useRef, useCallback } from 'react'
import { createRoot } from 'react-dom/client'
import InputCompletion from './components/InputCompletion'
import { completionManager, SearchResult } from './utils/completion-manager'

console.log('[InputCompletionApp] Content script loaded!')

function InputCompletionApp() {
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const activeElementRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)

  const isUsefulInput = (element: Element): boolean => {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) return false

    const tagName = element.tagName.toLowerCase()

    if (tagName === 'textarea') return true

    if (tagName === 'input') {
      const input = element as HTMLInputElement
      const type = input.type?.toLowerCase()
      const excludedTypes = ['password', 'hidden', 'submit', 'reset', 'button', 'image', 'file']

      if (excludedTypes.includes(type)) return false

      const minLength = 3
      if (input.maxLength > 0 && input.maxLength < minLength) return false

      return true
    }

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

  const activateCompletion = useCallback(() => {
    const focusedElement = document.activeElement

    console.log('[InputCompletionApp] activateCompletion called, focusedElement:', focusedElement)

    if (focusedElement && isUsefulInput(focusedElement)) {
      const rect = focusedElement.getBoundingClientRect()

      let top = rect.bottom + window.scrollY + 4
      let left = rect.left + window.scrollX

      if (top + 400 > window.innerHeight + window.scrollY) {
        top = rect.top + window.scrollY - 404
      }

      if (left + 350 > window.innerWidth + window.scrollX) {
        left = window.innerWidth + window.scrollX - 354
      }

      const inputElement = focusedElement as HTMLInputElement | HTMLTextAreaElement

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

      completionManager.activateCompletion(inputElement)

      console.log('[InputCompletionApp] Activating completion for element:', inputElement)

      activeElementRef.current = inputElement
      setPosition({ top, left })
      setVisible(true)
      setSearchResults([])
      setIsSearching(false)
    }
  }, [handleClose])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      console.log('[InputCompletionApp] Key pressed:', e.key, e.code, 'ctrl:', e.ctrlKey, 'meta:', e.metaKey)

      const isSpaceKey = e.key === ' ' || e.code === 'Space' || e.code === 'Unidentified'

      if ((e.ctrlKey || e.metaKey) && isSpaceKey) {
        e.preventDefault()
        e.stopPropagation()

        console.log('[InputCompletionApp] Ctrl+Space detected, visible:', visible)

        if (visible) {
          handleClose()
        } else {
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
    document.addEventListener('mousedown', handleClickOutside, true)

    return () => {
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



  return (
    <StrictMode>
      <InputCompletion
        visible={visible}
        position={position}
        results={searchResults}
        isSearching={isSearching}
        onResourceSelected={handleResourceSelected}
        onClose={handleClose}
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
root.render(<InputCompletionApp />)
