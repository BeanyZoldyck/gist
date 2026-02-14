import { useEffect, useRef, useState } from 'react'
import { InputFieldInfo } from '../utils/dom-utils'
import './InputOverlay.css'

interface InputOverlayProps {
  fieldInfo: InputFieldInfo | null
  position: { top: number; left: number } | null
  visible: boolean
  focusedElement: HTMLInputElement | HTMLTextAreaElement | null
}

const mockSuggestions = {
  email: ['test@example.com', 'user@domain.com', 'admin@company.org', 'support@test.com'],
  username: ['john_doe', 'jane_smith', 'user123', 'admin', 'tester'],
  password: ['Password123!', 'SecurePass@2024', 'MyP@ssw0rd', 'Temp#1234'],
  search: ['how to write code', 'best practices', 'tutorial guide', 'documentation'],
  url: ['https://example.com', 'https://google.com', 'https://github.com'],
  default: ['Suggestion 1', 'Suggestion 2', 'Suggestion 3', 'Suggestion 4']
}

export default function InputOverlay({ fieldInfo, position, visible, focusedElement }: InputOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  const getSuggestions = () => {
    if (!fieldInfo) return []

    const name = fieldInfo.name.toLowerCase()
    const id = fieldInfo.id.toLowerCase()
    const placeholder = fieldInfo.placeholder.toLowerCase()

    if (name.includes('email') || id.includes('email') || placeholder.includes('email')) {
      return mockSuggestions.email
    }
    if (name.includes('user') || id.includes('user') || placeholder.includes('user')) {
      return mockSuggestions.username
    }
    if (name.includes('pass') || id.includes('pass') || fieldInfo.type === 'password') {
      return mockSuggestions.password
    }
    if (name.includes('search') || id.includes('search') || placeholder.includes('search')) {
      return mockSuggestions.search
    }
    if (name.includes('url') || id.includes('url') || fieldInfo.type === 'url') {
      return mockSuggestions.url
    }

    return mockSuggestions.default
  }

  const suggestions = getSuggestions()

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!visible || !focusedElement) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex(prev => (prev + 1) % suggestions.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex(prev => (prev - 1 + suggestions.length) % suggestions.length)
      } else if (e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault()
        if (focusedElement) {
          focusedElement.value = suggestions[activeIndex]
          focusedElement.dispatchEvent(new Event('input', { bubbles: true }))
        }
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
    <div ref={overlayRef} className="input-overlay">
      <div className="overlay-header">
        <span className="overlay-title">Suggestions</span>
        <span className="overlay-subtitle">Press Ctrl+Enter to fill</span>
      </div>
      <div className="autocomplete-list">
        {suggestions.map((suggestion, index) => (
          <div
            key={index}
            className={`autocomplete-item ${index === activeIndex ? 'active' : ''}`}
            onClick={() => handleSuggestionClick(suggestion)}
          >
            <span className="suggestion-text">{suggestion}</span>
            {index === activeIndex && <span className="keyboard-hint">Ctrl+Enter</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
