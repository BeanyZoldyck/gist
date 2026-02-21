import { StrictMode, useState, useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import InputCompletion from './components/InputCompletion'
import { Resource } from './utils/resource-storage'

function InputCompletionApp() {
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const [activeElement, setActiveElement] = useState<HTMLInputElement | HTMLTextAreaElement | null>(null)
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

  const getCursorPosition = (element: HTMLInputElement | HTMLTextAreaElement): number => {
    return element.selectionStart || 0
  }

  const insertTextAtCursor = (element: HTMLInputElement | HTMLTextAreaElement, text: string) => {
    const cursorPos = getCursorPosition(element)
    const currentValue = element.value
    const newValue = currentValue.substring(0, cursorPos) + text + currentValue.substring(cursorPos)
    
    element.value = newValue
    element.focus()
    element.setSelectionRange(cursorPos + text.length, cursorPos + text.length)
    
    element.dispatchEvent(new Event('input', { bubbles: true }))
    element.dispatchEvent(new Event('change', { bubbles: true }))
  }

  const activateCompletion = () => {
    const focusedElement = document.activeElement
    
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
      
      setActiveElement(focusedElement as HTMLInputElement | HTMLTextAreaElement)
      activeElementRef.current = focusedElement as HTMLInputElement | HTMLTextAreaElement
      setPosition({ top, left })
      setVisible(true)
    }
  }

  const handleResourceSelected = (resource: Resource) => {
    if (activeElementRef.current) {
      insertTextAtCursor(activeElementRef.current, resource.url)
    }
  }

  const handleClose = () => {
    setVisible(false)
    setActiveElement(null)
    activeElementRef.current = null
    setPosition(null)
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.code === 'Space') {
        e.preventDefault()
        e.stopPropagation()
        
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
  }, [visible])

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
  }, [visible])

  return (
    <StrictMode>
      <InputCompletion
        visible={visible}
        position={position}
        activeElement={activeElement}
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
