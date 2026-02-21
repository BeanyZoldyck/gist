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

  const activateMode = () => {
    const foundHints = getLinkHints()
    console.log('[LinkHints] Found', foundHints.length, 'clickable elements')
    setHints(foundHints)
  }

  const deactivateMode = () => {
    setHints([])
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!visible || hints.length === 0) return

    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onClose()
    }
  }

  useEffect(() => {
    if (visible) {
      activateMode()
    } else {
      deactivateMode()
    }
  }, [visible])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [visible, hints])

  if (!visible || hints.length === 0) return null

  const getHintLabel = (index: number): string => {
    const chars = 'asdfghjkl'
    if (index < chars.length) {
      return chars[index]
    }
    return index.toString()
  }

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
            e.preventDefault()
            e.stopPropagation()
            onLinkSelected(hint)
            onClose()
          }}
        >
          <span className="font-bold text-[10px]">{getHintLabel(index)}</span>
        </div>
      ))}
      <div className="fixed bottom-5 right-5 bg-base-300 opacity-90 text-base-content px-4 py-3 rounded-box shadow-lg z-[2147483648]">
        <div className="font-semibold text-sm">Link Hints Mode</div>
        <div className="mt-1.5 text-xs opacity-70">
          Click a label to save link • Esc: Exit
        </div>
      </div>
    </div>
  )
}
