import { useState, useEffect, useRef } from 'react'
import { LinkHint, getLinkHints } from '../utils/link-hints'

interface LinkHintsProps {
  visible: boolean
  onLinkSelected: (hint: LinkHint) => void
  onClose: () => void
}

export default function LinkHints({ visible, onLinkSelected, onClose }: LinkHintsProps) {
  const [hints, setHints] = useState<LinkHint[]>([])
  const containerRef = useRef<HTMLDivElement>(null)

  console.log('[LinkHints] Render - visible:', visible, 'hints.length:', hints.length)

  const activateMode = () => {
    const foundHints = getLinkHints()
    console.log('[LinkHints] Found', foundHints.length, 'clickable elements')
    console.log('[LinkHints] Setting hints to state, length:', foundHints.length)
    const labels = foundHints.map((_, i) => getHintLabel(i))
    console.log('[LinkHints] Generated labels:', labels)
    setHints(foundHints)
    console.log('[LinkHints] Hints set in state')
  }

  const deactivateMode = () => {
    setHints([])
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    console.log('[LinkHints] Key pressed:', e.key, 'visible:', visible, 'hints.length:', hints.length)
    if (!visible || hints.length === 0) return

    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onClose()
      return
    }

    const labelChar = e.key.toLowerCase()
    console.log('[LinkHints] Looking for label:', labelChar)
    console.log('[LinkHints] Available labels:', hints.map((_, i) => getHintLabel(i)))
    const matchingIndex = hints.findIndex((_, index) => getHintLabel(index).toLowerCase() === labelChar)
    console.log('[LinkHints] Matching index:', matchingIndex)

    if (matchingIndex !== -1) {
      e.preventDefault()
      e.stopPropagation()
      console.log('[LinkHints] Calling onLinkSelected for hint:', matchingIndex)
      onLinkSelected(hints[matchingIndex])
      onClose()
    }
  }

  useEffect(() => {
    console.log('[LinkHints] useEffect - visible changed to:', visible)
    if (visible) {
      console.log('[LinkHints] Activating mode...')
      activateMode()
    } else {
      console.log('[LinkHints] Deactivating mode...')
      deactivateMode()
    }
  }, [visible])

  useEffect(() => {
    console.log('[LinkHints] Container ref set:', containerRef.current)
  }, [containerRef.current])

  useEffect(() => {
    console.log('[LinkHints] Setting up keyboard listener')
    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      console.log('[LinkHints] Removing keyboard listener')
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [visible, hints])

  if (!visible || hints.length === 0) {
    console.log('[LinkHints] Not rendering - visible:', visible, 'hints.length:', hints.length)
    return null
  }
  console.log('[LinkHints] Rendering', hints.length, 'hints')
  console.log('[LinkHints] First 3 hints:', hints.slice(0, 3).map((h, i) => ({ index: i, label: getHintLabel(i), rect: h.rect, text: h.text?.substring(0, 30) })))

  const getHintLabel = (index: number): string => {
    const chars = 'asdfghjkl'
    const label = index < chars.length ? chars[index] : index.toString()
    console.log('[LinkHints] getHintLabel(', index, ') =', label)
    return label
  }

  console.log('[LinkHints] About to render container')

  return (
    <div ref={containerRef} className="fixed inset-0 pointer-events-none z-[2147483647]">
      {hints.map((hint, index) => (
        <div
          key={index}
          className="absolute badge badge-warning pointer-events-auto cursor-pointer hover:badge-warning hover:scale-110 transition-transform"
          style={{
            top: `${hint.rect.top}px`,
            left: `${hint.rect.left}px`,
          }}
          onClick={(e) => {
            console.log('[LinkHints] Clicked label for index:', index)
            e.preventDefault()
            e.stopPropagation()
            console.log('[LinkHints] Calling onLinkSelected')
            onLinkSelected(hint)
            console.log('[LinkHints] Called onClose')
            onClose()
          }}
        >
          <span className="font-bold text-[10px]">{getHintLabel(index)}</span>
        </div>
      ))}
      <div className="fixed bottom-5 right-5 bg-base-300 opacity-90 text-base-content px-4 py-3 rounded-box shadow-lg z-[2147483648]">
        <div className="font-semibold text-sm">Link Hints Mode</div>
        <div className="mt-1.5 text-xs opacity-70">
          Click a number to bookmark • Esc: Exit
        </div>
      </div>
    </div>
  )
}
