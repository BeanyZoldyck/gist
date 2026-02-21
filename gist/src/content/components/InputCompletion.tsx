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
      className="dropdown dropdown-end dropdown-content z-[2147483648] bg-base-300 rounded-box shadow-xl max-h-[400px] overflow-y-auto w-[350px]"
      style={{
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
    >
      <div className="bg-base-300 rounded-box">
        <div className="p-2 border-b border-base-200">
          <div className="text-xs font-semibold opacity-50 uppercase">Insert Saved Resource</div>
        </div>

        {resources.length === 0 ? (
          <div className="p-5 text-center opacity-50 text-xs">
            <div className="text-2xl mb-2">📂</div>
            <div>No resources saved yet</div>
            <div className="mt-2 text-[10px] opacity-70">
              Use link hints (Ctrl+Shift+L) to save links
            </div>
          </div>
        ) : (
          <>
            {query && (
              <div className="p-2 bg-base-200 border-b border-base-200">
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={handleQueryChange}
                  placeholder="Search resources..."
                  autoFocus
                  className="input input-bordered input-sm w-full"
                />
              </div>
            )}

            <ul className="menu menu-compact bg-base-100 w-full p-0">
              {resources.map((resource, index) => (
                <li key={resource.id}>
                  <div
                    data-index={index}
                    className={`cursor-pointer ${index === activeIndex ? 'active' : ''}`}
                    onClick={() => handleItemClick(resource)}
                  >
                    <div className="flex flex-col gap-1 p-2">
                      <div className="font-medium truncate">{resource.title}</div>
                      <div className="text-xs opacity-70 truncate">{resource.url}</div>
                      <div className="text-xs opacity-60 line-clamp-2">{getResourcePreviewText(resource)}</div>
                      <div className="flex items-center gap-2 mt-1">
                        {resource.tags.length > 0 && (
                          <div className="flex gap-1 flex-wrap">
                            {resource.tags.slice(0, 3).map(tag => (
                              <span key={tag} className="badge badge-xs badge-ghost">
                                {tag}
                              </span>
                            ))}
                            {resource.tags.length > 3 && (
                              <span className="badge badge-xs badge-ghost">
                                +{resource.tags.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                        <span className="text-[10px] opacity-50 ml-auto">
                          {formatResourceDate(resource.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="p-2 border-t border-base-200 bg-base-200 opacity-50 text-[11px] flex justify-between items-center">
              <div className="flex gap-3">
                <span className="flex gap-0.5"><kbd className="kbd kbd-xs">↑</kbd><kbd className="kbd kbd-xs">↓</kbd> Navigate</span>
                <span><kbd className="kbd kbd-xs">Enter</kbd> Insert</span>
                <span><kbd className="kbd kbd-xs">Esc</kbd> Close</span>
              </div>
              <div>{resources.length} resource{resources.length !== 1 ? 's' : ''}</div>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}
