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
    <>
      <style>{`
        .completion-menu {
          font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
          background-color: #252526;
          border: 1px solid #3c3c3c;
          border-radius: 3px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
          max-height: 400px;
          overflow-y: auto;
          min-width: 350px;
        }

        .completion-menu-header {
          padding: 8px 12px;
          border-bottom: 1px solid #333;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 11px;
          font-weight: 600;
          color: #6a9955;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        .completion-menu-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          color: #6a9955;
        }

        .completion-menu-empty-icon {
          font-size: 32px;
          margin-bottom: 8px;
        }

        .completion-menu-empty-text {
          font-size: 12px;
          color: #9a9a9a;
        }

        .completion-menu-item {
          background-color: #252526;
          border: 1px solid transparent;
          border-bottom: 1px solid #333;
          padding: 10px 12px;
          cursor: pointer;
          transition: background-color 0.15s, border-color 0.15s;
        }

        .completion-menu-item:hover {
          background-color: #2d2d30;
          border-color: #3c3c3c;
        }

        .completion-menu-item.active {
          background-color: #2d2d30;
          border-left: 2px solid #0e639c;
          padding-left: 10px;
        }

        .completion-item-title {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 13px;
          font-weight: 500;
          color: #9cdcfe;
          margin-bottom: 4px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .completion-item-url {
          font-size: 11px;
          color: #9a9a9a;
          margin-bottom: 4px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .completion-item-notes {
          font-size: 11px;
          color: #ce9178;
          margin-bottom: 4px;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }

        .completion-item-footer {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 6px;
        }

        .completion-tag {
          font-size: 10px;
          padding: 2px 6px;
          background-color: #0e639c;
          color: #e8e8e8;
          border-radius: 2px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .completion-tag-more {
          font-size: 10px;
          padding: 2px 6px;
          background-color: #3c3c3c;
          color: #e8e8e8;
          border-radius: 2px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .completion-timestamp {
          font-size: 9px;
          color: #585858;
          margin-left: auto;
        }

        .completion-menu-footer {
          padding: 6px 12px;
          border-top: 1px solid #333;
          background-color: #1e1e1e;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 10px;
          color: #6a9955;
        }

        .completion-keybinding {
          display: flex;
          gap: 4px;
          align-items: center;
        }

        .completion-keybinding-kbd {
          padding: 2px 5px;
          background-color: #3c3c3c;
          border: 1px solid #4f4f4f;
          border-radius: 2px;
          font-size: 9px;
          color: #e8e8e8;
        }

        ::-webkit-scrollbar {
          width: 8px;
        }

        ::-webkit-scrollbar-track {
          background: #252526;
        }

        ::-webkit-scrollbar-thumb {
          background: #424242;
          border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: #4f4f4f;
        }
      `}</style>
      <div
        ref={menuRef}
        className="completion-menu"
        style={{
          position: 'fixed',
          top: `${position.top}px`,
          left: `${position.left}px`,
          zIndex: 2147483648
        }}
      >
        {results.length > 0 && (
          <div className="completion-menu-header">
            Insert Saved Resource
          </div>
        )}

        {results.length === 0 && !isSearching && (
          <div className="completion-menu-empty">
            <span className="completion-menu-empty-icon">🔍</span>
            <div className="completion-menu-empty-text">Type to search saved resources...</div>
          </div>
        )}

        {isSearching && results.length === 0 && (
          <div className="completion-menu-empty">
            <span className="completion-menu-empty-icon">⏳</span>
            <div className="completion-menu-empty-text">Searching...</div>
          </div>
        )}

        {results.length > 0 && (
          <div>
            {results.slice(0, 3).map((result, index) => (
              <div
                key={result.id}
                data-index={index}
                className={`completion-menu-item ${index === activeIndex ? 'active' : ''}`}
                onClick={() => handleItemClick(result)}
              >
                <div className="completion-item-title">{result.title}</div>
                <div className="completion-item-url" title={result.url}>{result.url}</div>
                {result.notes && (
                  <div className="completion-item-notes" title={result.notes}>{result.notes}</div>
                )}
                <div className="completion-item-footer">
                  {result.tags && result.tags.length > 0 && (
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {result.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="completion-tag">
                          #{tag}
                        </span>
                      ))}
                      {result.tags.length > 3 && (
                        <span className="completion-tag-more">
                          +{result.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                  {result.createdAt && (
                    <span className="completion-timestamp">
                      {formatResourceDate(result.createdAt)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {results.length > 0 && (
          <div className="completion-menu-footer">
            <div className="completion-keybinding">
              <span className="completion-keybinding-kbd">↑</span>
              <span className="completion-keybinding-kbd">↓</span>
              <span>Navigate</span>
              <span style={{ marginLeft: '8px' }} className="completion-keybinding-kbd">Enter</span>
              <span>Insert</span>
              <span style={{ marginLeft: '8px' }} className="completion-keybinding-kbd">Esc</span>
              <span>Close</span>
            </div>
            <div>{results.length} result{results.length !== 1 ? 's' : ''}</div>
          </div>
        )}
      </div>
    </>,
    portalRoot
  )
}
