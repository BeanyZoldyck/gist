import { useState, useEffect, useRef, useMemo } from 'react'
import { LinkHint, getLinkHints } from '../utils/link-hints'

interface LinkHintsProps {
  visible: boolean
  onLinkSelected: (hint: LinkHint) => void
  onClose: () => void
}

interface HintWithLabel extends LinkHint {
  hintString: string
  visible: boolean
  matchCount: number
}

export default function LinkHints({ visible, onLinkSelected, onClose }: LinkHintsProps) {
  const [allHints, setAllHints] = useState<HintWithLabel[]>([])
  const [keyStrokeQueue, setKeyStrokeQueue] = useState<string[]>([])
  const containerRef = useRef<HTMLDivElement>(null)

  const hintCharacters = 'asdfghjklqwertyuiopzxcvbnm'

  const matchingHints = useMemo(() => {
    return allHints.filter(h => h.visible)
  }, [allHints])

  const activateMode = () => {
    const foundHints = getLinkHints()
    const chars = hintCharacters
    const count = foundHints.length

    let hints = ['']
    let offset = 0
    while ((hints.length - offset < count) || hints.length === 1) {
      const hint = hints[offset++]
      for (const ch of chars) {
        hints.push(ch + hint)
      }
    }
    hints = hints.slice(offset, offset + count)
    const hintStringList = hints.sort().map(str => str.split('').reverse().join(''))

    const hintsWithLabels: HintWithLabel[] = foundHints.map((hint, index) => ({
      ...hint,
      hintString: hintStringList[index],
      visible: true,
      matchCount: 0
    }))
    setAllHints(hintsWithLabels)
    setKeyStrokeQueue([])
  }

  const deactivateMode = () => {
    setAllHints([])
    setKeyStrokeQueue([])
  }

  const updateHintVisibility = (queue: string[]) => {
    setAllHints(prevHints => {
      const matchString = queue.join('')
      return prevHints.map(hint => ({
        ...hint,
        visible: hint.hintString.startsWith(matchString),
        matchCount: matchString.length
      }))
    })
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!visible || allHints.length === 0) return

    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onClose()
      return
    }

    if (e.key === 'Backspace') {
      e.preventDefault()
      e.stopPropagation()
      const newQueue = keyStrokeQueue.slice(0, -1)
      setKeyStrokeQueue(newQueue)
      updateHintVisibility(newQueue)
      return
    }

    if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      if (matchingHints.length === 1) {
        onLinkSelected(matchingHints[0])
        onClose()
      }
      return
    }

    const keyChar = e.key.toLowerCase()
    if (keyChar.length === 1 && hintCharacters.includes(keyChar)) {
      e.preventDefault()
      e.stopPropagation()
      const newQueue = [...keyStrokeQueue, keyChar]
      setKeyStrokeQueue(newQueue)
      updateHintVisibility(newQueue)
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
    if (matchingHints.length === 1 && keyStrokeQueue.length > 0) {
      const timer = setTimeout(() => {
        onLinkSelected(matchingHints[0])
        onClose()
      }, 200)
      return () => clearTimeout(timer)
    }
  }, [matchingHints, keyStrokeQueue, onLinkSelected, onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [visible, allHints, keyStrokeQueue, matchingHints.length])

  if (!visible || allHints.length === 0) {
    return null
  }

  const renderLabel = (hintString: string, matchCount: number) => {
    const chars = hintString.split('')
    return chars.map((char, index) => (
      <span
        key={index}
        style={{
          color: index < matchCount ? '#000' : '#666',
          fontWeight: index < matchCount ? 'bold' : 'normal'
        }}
      >
        {char}
      </span>
    ))
  }

  return (
    <div ref={containerRef} className="fixed inset-0 pointer-events-none z-[2147483647]">
      {allHints.map((hint, index) => {
        if (!hint.visible) return null
        return (
          <div
            key={index}
            className="absolute badge pointer-events-auto cursor-pointer hover:scale-110 transition-transform"
            style={{
              top: `${hint.rect.top}px`,
              left: `${hint.rect.left}px`,
              fontSize: '16px',
              padding: '6px 10px',
              background: 'rgba(255, 255, 0, 0.9)',
              color: '#000',
              border: '2px solid #000',
              borderRadius: '4px',
              zIndex: 2147483647,
            }}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onLinkSelected(hint)
              onClose()
            }}
          >
            {renderLabel(hint.hintString, hint.matchCount)}
          </div>
        )
      })}
      <div className="fixed bottom-5 right-5 bg-base-300 opacity-90 text-base-content px-4 py-3 rounded-box shadow-lg z-[2147483648]">
        <div className="font-semibold text-sm">Link Hints Mode</div>
        <div className="mt-1.5 text-xs opacity-70">
          Type characters to filter • Backspace: Remove • Esc: Exit
        </div>
        {keyStrokeQueue.length > 0 && (
          <div className="mt-1 text-xs font-bold">
            Typed: {keyStrokeQueue.join('')}
          </div>
        )}
        <div className="mt-1 text-xs">
          {matchingHints.length} hint{matchingHints.length !== 1 ? 's' : ''} remaining
        </div>
      </div>
    </div>
  )
}
