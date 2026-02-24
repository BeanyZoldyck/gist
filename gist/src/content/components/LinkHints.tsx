import { useState, useEffect, useRef } from 'react'
import { LinkHint, getLinkHints } from '../utils/link-hints'

interface LinkHintsProps {
  visible: boolean
  onLinkSelected: (hint: LinkHint, openLink: boolean) => void
  onClose: () => void
}

export default function LinkHints({ visible, onLinkSelected, onClose }: LinkHintsProps) {
  const [allHints, setAllHints] = useState<LinkHint[]>([])
  const [hints, setHints] = useState<LinkHint[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [inputSequence, setInputSequence] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const filteredHintsRef = useRef<LinkHint[]>([])

  const activateMode = () => {
    const foundHints = getLinkHints()
    console.log('[LinkHints] Found', foundHints.length, 'clickable elements')
    setAllHints(foundHints)
    setHints(foundHints)
    setActiveIndex(0)
    setInputSequence('')
    filteredHintsRef.current = foundHints
  }

  const deactivateMode = () => {
    setAllHints([])
    setHints([])
    setActiveIndex(0)
    setInputSequence('')
    filteredHintsRef.current = []
  }

  const getHintLabel = (index: number): string => {
    const chars = 'asdfghjkl'
    if (index < chars.length) {
      return chars[index]
    }
    return index.toString()
  }

  const getHintLabelForHint = (hint: LinkHint): string => {
    const originalIndex = allHints.indexOf(hint)
    return getHintLabel(originalIndex)
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!visible || allHints.length === 0) return

    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onClose()
      return
    }

    if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      if (hints.length > 0 && hints[activeIndex]) {
        onLinkSelected(hints[activeIndex], false)
        onClose()
      }
      return
    }

    if (e.key === 'ArrowDown' || e.key === 'j') {
      e.preventDefault()
      e.stopPropagation()
      setActiveIndex(prev => (prev + 1) % hints.length)
      return
    }

    if (e.key === 'ArrowUp' || e.key === 'k') {
      e.preventDefault()
      e.stopPropagation()
      setActiveIndex(prev => (prev - 1 + hints.length) % hints.length)
      return
    }

    const validChars = 'asdfghjkl'
    const isNumber = /^[0-9]$/.test(e.key)
    
    if (validChars.includes(e.key.toLowerCase()) || isNumber) {
      e.preventDefault()
      e.stopPropagation()
      
      const newSequence = inputSequence + e.key.toLowerCase()
      setInputSequence(newSequence)
      
      if (newSequence.length === 1) {
        const filteredHints = allHints.filter((_, idx) => {
          const hintChars = getHintLabel(idx)
          return hintChars.toLowerCase().startsWith(newSequence)
        })
        
        setHints(filteredHints)
        filteredHintsRef.current = filteredHints
        if (filteredHints.length > 0) {
          setActiveIndex(0)
        }
      } else if (newSequence.length >= 2) {
        if (/^\d+$/.test(newSequence)) {
          const targetIndex = parseInt(newSequence) - 1
          const targetHint = allHints[targetIndex]
          
          if (targetHint) {
            onLinkSelected(targetHint, false)
            onClose()
          }
        } else {
          const firstCharIndex = 'asdfghjkl'.indexOf(newSequence[0])
          const secondCharIndex = 'asdfghjkl'.indexOf(newSequence[1])
          
          if (firstCharIndex >= 0 && secondCharIndex >= 0) {
            const targetIndex = firstCharIndex * 9 + secondCharIndex
            const targetHint = allHints[targetIndex]
            
            if (targetHint) {
              onLinkSelected(targetHint, false)
              onClose()
            }
          }
        }
      }
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
  }, [visible, allHints, hints, activeIndex, inputSequence])

  useEffect(() => {
    if (visible && hints.length > 0) {
      const activeHint = hints[activeIndex]
      if (activeHint) {
        activeHint.element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }, [activeIndex, hints, visible])

  if (!visible || hints.length === 0) return null

  return (
    <div ref={containerRef} className="fixed inset-0 pointer-events-none z-[2147483647] overflow-visible">
      {hints.map((hint, index) => (
        <div
          key={allHints.indexOf(hint)}
          className={`absolute inline-block whitespace-nowrap text-xs font-bold font-helvetica px-[5px] py-[2px] rounded-[3px] shadow-md uppercase min-w-[16px] text-center pointer-events-auto cursor-pointer transition-all ${
            index === activeIndex
              ? 'bg-gradient-to-b from-[#ff6b6b] to-[#ee5a5a] border-[#c0392b] text-white shadow-lg scale-110'
              : 'bg-gradient-to-b from-[#fff785] to-[#ffc542] border-[#c38a22] text-[#302505]'
          }`}
          style={{
            top: `${hint.rect.top}px`,
            left: `${hint.rect.left}px`,
            zIndex: index === activeIndex ? 2147483648 : 2147483647,
          }}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setActiveIndex(index)
            onLinkSelected(hint, true)
            onClose()
          }}
        >
          <span className="font-bold">{getHintLabelForHint(hint)}</span>
        </div>
      ))}
      <div className="fixed bottom-5 right-5 bg-black/80 text-white px-4 py-3 rounded-lg text-xs font-helvetica z-[2147483648]">
        <div>Link Hints Mode ({hints.length} shown)</div>
        <div className="mt-1.5 opacity-80">
          Type letters or numbers to filter/select • j/k or ↑/↓: Navigate • Enter: Save • Click: Save & Open • Esc: Exit
        </div>
        {inputSequence && (
          <div className="mt-1.5 text-yellow-400">
            Typing: {inputSequence}
          </div>
        )}
      </div>
    </div>
  )
}
