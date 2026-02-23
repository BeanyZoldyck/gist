import { useState, useEffect, useRef, useMemo } from 'react'

export interface TagPromptProps {
  visible: boolean
  position: { top: number; left: number }
  url: string
  title: string
  onSave: (tags: string[], notes: string) => void
  onSkip: () => void
  existingTags: string[]
}

export default function TagPrompt({ visible, position, url, title, onSave, onSkip, existingTags }: TagPromptProps) {
  const [tags, setTags] = useState('')
  const [notes, setNotes] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<number | null>(null)

  const currentInputValue = useMemo(() => {
    const tagList = tags.split(',').map(t => t.trim())
    return tagList[tagList.length - 1] || ''
  }, [tags])

  useEffect(() => {
    if (!visible) return

   const handleMouseMove = () => {
     onSkip()
   }

    document.addEventListener('mousemove', handleMouseMove, { once: true })

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
    }
  }, [visible, onSkip])

  useEffect(() => {
    if (!visible) return

    timeoutRef.current = window.setTimeout(() => {
      onSkip()
    }, 3000)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [visible, onSkip])

  useEffect(() => {
    if (!visible) return

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onSkip()
      }
    }

    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 0)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [visible, onSkip])

  useEffect(() => {
    if (currentInputValue.length > 0 && existingTags.length > 0) {
      const filtered = existingTags.filter(tag => 
        tag.toLowerCase().includes(currentInputValue.toLowerCase())
      ).slice(0, 5)
      setSuggestions(filtered)
      setShowSuggestions(filtered.length > 0)
      setSelectedSuggestionIndex(-1)
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }, [currentInputValue, existingTags])

  useEffect(() => {
    if (!visible) {
      setTags('')
      setNotes('')
      setSuggestions([])
      setShowSuggestions(false)
      setSelectedSuggestionIndex(-1)
    }
  }, [visible])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onSkip()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (showSuggestions && selectedSuggestionIndex >= 0) {
        const tagList = tags.split(',').map(t => t.trim())
        tagList[tagList.length - 1] = suggestions[selectedSuggestionIndex]
        setTags(tagList.join(', '))
        setShowSuggestions(false)
        setSelectedSuggestionIndex(-1)
      } else {
        const finalTags = tags.split(',').map(t => t.trim()).filter(Boolean)
        onSave(finalTags, notes)
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (showSuggestions) {
        setSelectedSuggestionIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        )
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (showSuggestions) {
        setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : -1)
      }
    } else if (e.key === 'Tab' && showSuggestions && suggestions.length > 0) {
      e.preventDefault()
      const tagList = tags.split(',').map(t => t.trim())
      tagList[tagList.length - 1] = suggestions[selectedSuggestionIndex >= 0 ? selectedSuggestionIndex : 0]
      setTags(tagList.join(', '))
      setShowSuggestions(false)
      setSelectedSuggestionIndex(-1)
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    const tagList = tags.split(',').map(t => t.trim())
    tagList[tagList.length - 1] = suggestion
    setTags(tagList.join(', '))
    setShowSuggestions(false)
    setSelectedSuggestionIndex(-1)
  }

  const handleSave = () => {
    const finalTags = tags.split(',').map(t => t.trim()).filter(Boolean)
    onSave(finalTags, notes)
  }

  if (!visible) return null

  const PROMPT_WIDTH = 320
  const PROMPT_HEIGHT = 280

  let adjustedPosition = { ...position }

  if (position.left + PROMPT_WIDTH > window.innerWidth) {
    adjustedPosition.left = window.innerWidth - PROMPT_WIDTH - 10
  }
  if (adjustedPosition.left < 10) {
    adjustedPosition.left = 10
  }

  if (position.top + PROMPT_HEIGHT > window.innerHeight) {
    adjustedPosition.top = position.top - PROMPT_HEIGHT - 10
  }
  if (adjustedPosition.top < 10) {
    adjustedPosition.top = 10
  }

  return (
    <div
      ref={containerRef}
      className="tag-prompt"
      style={{
        position: 'fixed',
        top: `${adjustedPosition.top}px`,
        left: `${adjustedPosition.left}px`,
        zIndex: 2147483647,
      }}
      onKeyDown={handleKeyDown}
    >
      <div className="tag-prompt-header">
        <span className="tag-prompt-title">Save Link</span>
        <span className="tag-prompt-url" title={url}>{url}</span>
      </div>
      
      <div className="tag-prompt-field">
        <label className="tag-prompt-label">Tags</label>
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="tag1, tag2, tag3..."
          className="tag-prompt-input"
          autoFocus
        />
        {showSuggestions && suggestions.length > 0 && (
          <div className="tag-prompt-suggestions">
            {suggestions.map((suggestion, index) => (
              <div
                key={suggestion}
                className={`tag-prompt-suggestion ${index === selectedSuggestionIndex ? 'selected' : ''}`}
                onClick={() => handleSuggestionClick(suggestion)}
              >
                #{suggestion}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="tag-prompt-field">
        <label className="tag-prompt-label">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add notes..."
          className="tag-prompt-textarea"
          rows={2}
        />
      </div>

      <div className="tag-prompt-actions">
        <button onClick={onSkip} className="tag-prompt-btn tag-prompt-btn-skip">
          Skip
        </button>
        <button onClick={handleSave} className="tag-prompt-btn tag-prompt-btn-save">
          Save
        </button>
      </div>
    </div>
  )
}
