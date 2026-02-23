import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { SearchResult } from '../utils/completion-manager'
import { formatResourceDate } from '../utils/resource-storage'

interface InputCompletionProps {
  visible: boolean
  position: { top: number; left: number } | null
  results: SearchResult[]
  isSearching: boolean
  onResourceSelected: (resource: SearchResult) => void
  onClose: () => void
  portalRoot: ShadowRoot
}

export default function InputCompletion({
  visible,
  position,
  results,
  isSearching,
  onResourceSelected,
  onClose,
  portalRoot
}: InputCompletionProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)

  console.log('[InputCompletion] Render - visible:', visible, 'position:', position, 'results:', results.length)

  useEffect(() => {
    setActiveIndex(0)
  }, [results])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!visible || !menuRef.current) return

      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
        return
      }

      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault()
        setActiveIndex(prev => results.length > 0 ? (prev + 1) % results.length : 0)
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault()
        setActiveIndex(prev => results.length > 0 ? (prev - 1 + results.length) % results.length : 0)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const activeResult = results[activeIndex]
        if (activeResult) {
          onResourceSelected(activeResult)
          onClose()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [visible, results, activeIndex, onResourceSelected, onClose])

  useEffect(() => {
    const activeItem = menuRef.current?.querySelector(`[data-index="${activeIndex}"]`) as HTMLElement
    if (activeItem) {
      activeItem.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIndex])

  const handleItemClick = (result: SearchResult) => {
    onResourceSelected(result)
    onClose()
  }

  if (!visible || !position) return null

  return createPortal(
    <div
      ref={menuRef}
      className="gist-completion-menu dropdown dropdown-end dropdown-content z-[2147483648] bg-base-300 rounded-box shadow-xl max-h-[400px] overflow-y-auto w-[350px]"
      style={{
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
        backgroundColor: 'var(--fallback-b1, oklch(0.28 0.046 264.705)',
        opacity: 1
      }}
    >
      <div className="bg-base-300 rounded-box" style={{ opacity: 1 }}>
        {results.length > 0 && (
          <div className="p-2 border-b border-base-200">
            <div className="text-xs font-semibold opacity-50 uppercase">Insert Saved Resource</div>
          </div>
        )}

        {results.length === 0 && !isSearching && (
          <div className="p-5 text-center opacity-50 text-xs">
            <div className="text-2xl mb-2">🔍</div>
            <div>Type to search saved resources...</div>
          </div>
        )}

        {isSearching && results.length === 0 && (
          <div className="p-5 text-center opacity-50 text-xs">
            <div className="text-2xl mb-2">⏳</div>
            <div>Searching...</div>
          </div>
        )}

        {results.length > 0 && (
          <ul className="menu menu-compact bg-base-100 w-full p-0">
            {results.slice(0, 3).map((result, index) => (
              <li key={result.id}>
                <div
                  data-index={index}
                  className={`cursor-pointer ${index === activeIndex ? 'active' : ''}`}
                  onClick={() => handleItemClick(result)}
                >
                  <div className="flex flex-col gap-1 p-2">
                    <div className="font-medium truncate">{result.title}</div>
                    <div className="text-xs opacity-70 truncate">{result.url}</div>
                    {result.notes && (
                      <div className="text-xs opacity-60 line-clamp-2">{result.notes}</div>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      {result.tags && result.tags.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {result.tags.slice(0, 3).map(tag => (
                            <span key={tag} className="badge badge-xs badge-ghost">
                              {tag}
                            </span>
                          ))}
                          {result.tags.length > 3 && (
                            <span className="badge badge-xs badge-ghost">
                              +{result.tags.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                      {result.createdAt && (
                        <span className="text-[10px] opacity-50 ml-auto">
                          {formatResourceDate(result.createdAt)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {results.length > 0 && (
          <div className="p-2 border-t border-base-200 bg-base-200 opacity-50 text-[11px] flex justify-between items-center">
            <div className="flex gap-3">
              <span className="flex gap-0.5"><kbd className="kbd kbd-xs">↑</kbd><kbd className="kbd kbd-xs">↓</kbd> Navigate</span>
              <span><kbd className="kbd kbd-xs">Enter</kbd> Insert</span>
              <span><kbd className="kbd kbd-xs">Esc</kbd> Close</span>
            </div>
            <div>{results.length} result{results.length !== 1 ? 's' : ''}</div>
          </div>
        )}
      </div>
    </div>,
    portalRoot
  )
}
