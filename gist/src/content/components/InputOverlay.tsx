import { useEffect, useRef, useState } from 'react'
import { InputFieldInfo } from '../utils/dom-utils'
import { generateSuggestions, loadModel } from '../hooks/useTransformers'

interface InputOverlayProps {
  fieldInfo: InputFieldInfo | null
  position: { top: number; left: number } | null
  visible: boolean
  focusedElement: HTMLInputElement | HTMLTextAreaElement | null
}

export default function InputOverlay({ fieldInfo, position, visible, focusedElement }: InputOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [modelLoaded, setModelLoaded] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  const getCurrentInputValue = () => {
    return focusedElement?.value || ''
  }

  const getFieldType = () => {
    if (!fieldInfo) return 'text'

    const name = fieldInfo.name.toLowerCase()
    const id = fieldInfo.id.toLowerCase()
    const placeholder = fieldInfo.placeholder.toLowerCase()

    if (name.includes('email') || id.includes('email') || placeholder.includes('email')) {
      return 'email'
    }
    if (name.includes('user') || id.includes('user') || placeholder.includes('user')) {
      return 'username'
    }
    if (name.includes('pass') || id.includes('pass') || fieldInfo.type === 'password') {
      return 'password'
    }
    if (name.includes('search') || id.includes('search') || placeholder.includes('search')) {
      return 'search'
    }
    if (name.includes('url') || id.includes('url') || fieldInfo.type === 'url') {
      return 'url'
    }

    return fieldInfo.type
  }

  useEffect(() => {
    if (visible && !modelLoaded) {
      loadModel()
        .then(() => setModelLoaded(true))
        .catch(() => console.error('[InputOverlay] Failed to load model'))
    }
  }, [visible, modelLoaded])

  useEffect(() => {
    if (visible && position && overlayRef.current) {
      const overlay = overlayRef.current
      const overlayRect = overlay.getBoundingClientRect()
      
      let top = position.top - overlayRect.height - 10
      let left = position.left
      
      if (top < 0) {
        top = position.top + 50
      }
      
      if (left + overlayRect.width > window.innerWidth) {
        left = window.innerWidth - overlayRect.width - 10
      }
      
      if (left < 10) {
        left = 10
      }
      
      overlay.style.top = `${top}px`
      overlay.style.left = `${left}px`
    }
  }, [visible, position])

  const searchSuggestions = async () => {
    const inputValue = getCurrentInputValue()
    const fieldType = getFieldType()

    if (inputValue.length < 1) return

    setIsLoading(true)
    setHasSearched(true)

    try {
      const results = await generateSuggestions(inputValue, fieldType, 4)
      setSuggestions(results)
      setActiveIndex(0)
    } catch (error) {
      console.error('[InputOverlay] Failed to generate suggestions:', error)
      setSuggestions([])
    } finally {
      setIsLoading(false)
    }
  }

  const insertSuggestion = () => {
    if (focusedElement && suggestions.length > 0) {
      focusedElement.value = suggestions[activeIndex]
      focusedElement.dispatchEvent(new Event('input', { bubbles: true }))
      focusedElement.focus()
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!visible || !focusedElement) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex(prev => suggestions.length > 0 ? (prev + 1) % suggestions.length : 0)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex(prev => suggestions.length > 0 ? (prev - 1 + suggestions.length) % suggestions.length : 0)
      } else if (e.key === ' ' && e.ctrlKey) {
        e.preventDefault()
        if (suggestions.length > 0) {
          insertSuggestion()
        } else if (getCurrentInputValue().length >= 1) {
          searchSuggestions()
        }
      } else if (e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault()
        insertSuggestion()
      } else if (e.key === 'Escape') {
        focusedElement.blur()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [visible, suggestions, activeIndex, focusedElement])

  const handleSuggestionClick = (suggestion: string) => {
    if (focusedElement) {
      focusedElement.value = suggestion
      focusedElement.dispatchEvent(new Event('input', { bubbles: true }))
      focusedElement.dispatchEvent(new Event('change', { bubbles: true }))
      focusedElement.focus()
    }
  }

  if (!visible || !fieldInfo) return null

  return (
    <div ref={overlayRef} className="fixed z-[2147483647] bg-white rounded-lg shadow-lg min-w-[280px] max-w-[400px] font-sans text-sm border border-[#e0e0e0] overflow-hidden animate-slide-down">
      <div className="bg-gradient-to-r from-[#667eea] to-[#764ba2] px-4 py-2.5 flex justify-between items-center">
        <span className="text-white/80 text-[11px] font-normal">
          {isLoading ? 'Searching...' : suggestions.length > 0 ? 'Press Ctrl+Enter to insert' : 'Press Ctrl+Space to search'}
        </span>
      </div>
      <div className="max-h-[300px] overflow-y-auto py-1">
        {isLoading ? (
          <div className="flex items-center justify-center gap-3 py-5 text-[#666]">
            <div className="w-5 h-5 border-2 border-[#e0e0e0] border-t-[#667eea] rounded-full animate-spin"></div>
            <span>Generating suggestions...</span>
          </div>
        ) : suggestions.length > 0 ? (
          suggestions.map((suggestion, index) => (
            <div
              key={index}
              className={`px-4 py-2.5 cursor-pointer flex justify-between items-center transition-colors duration-150 border-l-3 ${index === activeIndex ? 'bg-[#667eea] border-[#764ba2]' : 'hover:bg-[#f5f5f5] border-transparent'}`}
              onClick={() => handleSuggestionClick(suggestion)}
            >
              <span className={`flex-1 font-mono text-[13px] break-all ${index === activeIndex ? 'text-white' : 'text-[#333]'}`}>{suggestion}</span>
              {index === activeIndex && <span className="text-[10px] text-white/80 pl-3 flex-shrink-0">Ctrl+Enter</span>}
            </div>
          ))
        ) : hasSearched ? (
          <div className="flex items-center justify-center py-5 text-[#999] text-[13px]">
            <span>No suggestions found</span>
          </div>
        ) : getCurrentInputValue().length >= 1 ? (
          <div className="flex items-center justify-center py-5 text-[#999] text-[13px]">
            <span>Press Ctrl+Space to search</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}
