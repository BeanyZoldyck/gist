import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Resource, searchResources, getResourcePreviewText, formatResourceDate } from '../utils/resource-storage'

interface InputCompletionProps {
  visible: boolean
  position: { top: number; left: number } | null
  activeElement: HTMLElement | null
  onResourceSelected: (resource: Resource) => void
  onClose: () => void
}

export default function InputCompletion({
  visible,
  position,
  activeElement,
  onResourceSelected,
  onClose
}: InputCompletionProps) {
  const [resources, setResources] = useState<Resource[]>([])
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [allResources, setAllResources] = useState<Resource[]>([])
  const menuRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (visible && activeElement) {
      loadResources()
    }
  }, [visible])

  const loadResources = async () => {
    const loaded = await searchResources('')
    setAllResources(loaded)
    setResources(loaded)
    setActiveIndex(0)
  }

  useEffect(() => {
    if (!query) {
      setResources(allResources)
    } else {
      const filtered = allResources.filter(r => {
        const q = query.toLowerCase()
        return r.title.toLowerCase().includes(q) ||
               r.url.toLowerCase().includes(q) ||
               r.tags.some(t => t.toLowerCase().includes(q)) ||
               r.notes.toLowerCase().includes(q)
      })
      setResources(filtered)
    }
    setActiveIndex(0)
  }, [query, allResources])

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
        setActiveIndex(prev => resources.length > 0 ? (prev + 1) % resources.length : 0)
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault()
        setActiveIndex(prev => resources.length > 0 ? (prev - 1 + resources.length) % resources.length : 0)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const activeResource = resources[activeIndex]
        if (activeResource) {
          onResourceSelected(activeResource)
          onClose()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [visible, resources, activeIndex])

  useEffect(() => {
    const activeItem = menuRef.current?.querySelector(`[data-index="${activeIndex}"]`) as HTMLElement
    if (activeItem) {
      activeItem.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIndex])

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
  }

  const handleItemClick = (resource: Resource) => {
    onResourceSelected(resource)
    onClose()
  }

  if (!visible || !position) return null

  return createPortal(
    <div
      ref={menuRef}
      className="fixed bg-[#1e1e1e] border border-[#3e3e3e] rounded-lg shadow-2xl max-h-[400px] overflow-y-auto z-[2147483648] font-sans text-sm w-[350px]"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
    >
      <div className="px-4 py-2.5 border-b border-[#3e3e3e] bg-[#252525] font-medium text-white text-xs uppercase tracking-wide">
        Insert Saved Resource
      </div>

      {resources.length === 0 ? (
        <div className="p-5 text-center text-[#888] text-xs">
          <div className="text-2xl mb-2 opacity-50">📂</div>
          <div>No resources saved yet</div>
          <div className="mt-2 text-[11px] opacity-70">
            Use link hints (Ctrl+Shift+L) to save links
          </div>
        </div>
      ) : (
        <>
          {query && (
            <div className="px-[14px] py-2 bg-[#252525] border-b border-[#2d2d2d]">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={handleQueryChange}
                placeholder="Search resources..."
                autoFocus
                className="w-full bg-[#1e1e1e] border border-[#3e3e3e] rounded px-3 py-2 text-white text-[13px] outline-none"
              />
            </div>
          )}

          <div>
            {resources.map((resource, index) => (
              <div
                key={resource.id}
                data-index={index}
                className={`px-4 py-2.5 cursor-pointer border-b border-[#2d2d2d] transition-colors duration-150 ${index === activeIndex ? 'bg-[#2d5a2d] border-[#3d7a3d]' : 'hover:bg-[#2d5a2d]/50'}`}
                onClick={() => handleItemClick(resource)}
              >
                <div className={`font-medium text-white mb-1 overflow-hidden text-ellipsis whitespace-nowrap ${index === activeIndex ? 'text-[#e8f5e9]' : ''}`}>{resource.title}</div>
                <div className={`text-[#888] text-[11px] mb-1.5 overflow-hidden text-ellipsis whitespace-nowrap ${index === activeIndex ? 'text-[#a8d8a8]' : ''}`}>{resource.url}</div>
                <div className={`text-[#aaa] text-[11px] leading-relaxed overflow-hidden line-clamp-2 ${index === activeIndex ? 'text-[#c8e8c8]' : ''}`}>
                  {getResourcePreviewText(resource)}
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  {resource.tags.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {resource.tags.slice(0, 3).map(tag => (
                        <span key={tag} className={`text-[10px] px-1.5 py-0.5 rounded ${index === activeIndex ? 'bg-[#4e7a4e] text-[#e8f5e9]' : 'bg-[#3e3e3e] text-[#aaa]'}`}>
                          {tag}
                        </span>
                      ))}
                      {resource.tags.length > 3 && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${index === activeIndex ? 'bg-[#4e7a4e] text-[#e8f5e9]' : 'bg-[#3e3e3e] text-[#aaa]'}`}>
                          +{resource.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                  <span className={`text-[10px] ml-auto ${index === activeIndex ? 'text-[#98c898]' : 'text-[#666]'}`}>
                    {formatResourceDate(resource.createdAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="px-4 py-2 border-t border-[#3e3e3e] bg-[#252525] text-[#666] text-[11px] flex justify-between items-center">
            <div className="flex gap-3">
              <span className="flex gap-0.5"><kbd className="bg-[#3e3e3e] px-1.5 py-0.5 rounded text-[#aaa] font-mono text-[10px]">↑</kbd><kbd className="bg-[#3e3e3e] px-1.5 py-0.5 rounded text-[#aaa] font-mono text-[10px]">↓</kbd> Navigate</span>
              <span><kbd className="bg-[#3e3e3e] px-1.5 py-0.5 rounded text-[#aaa] font-mono text-[10px]">Enter</kbd> Insert</span>
              <span><kbd className="bg-[#3e3e3e] px-1.5 py-0.5 rounded text-[#aaa] font-mono text-[10px]">Esc</kbd> Close</span>
            </div>
            <div>{resources.length} resource{resources.length !== 1 ? 's' : ''}</div>
          </div>
        </>
      )}
    </div>,
    document.body
  )
}
