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
    <div ref={containerRef} className="fixed inset-0 pointer-events-none z-[2147483647] overflow-visible">
      {hints.map((hint, index) => (
        <div
          key={index}
          className="absolute inline-block whitespace-nowrap text-xs font-bold font-helvetica px-[5px] py-[2px] bg-gradient-to-b from-[#fff785] to-[#ffc542] border border-[#c38a22] rounded-[3px] shadow-md text-[#302505] uppercase min-w-[16px] text-center pointer-events-auto cursor-pointer hover:scale-110 hover:bg-gradient-to-b hover:from-[#ff6b6b] hover:to-[#ee5a5a] hover:border-[#c0392b] hover:text-white hover:shadow-lg transition-transform"
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
          <span className="font-bold">{getHintLabel(index)}</span>
        </div>
      ))}
      <div className="fixed bottom-5 right-5 bg-black/80 text-white px-4 py-3 rounded-lg text-xs font-helvetica z-[2147483648]">
        <div>Link Hints Mode</div>
        <div className="mt-1.5 opacity-80">
          Click a label to save link • Esc: Exit
        </div>
      </div>
    </div>
  )
}
