import { useEffect, useRef } from 'react'
import { InputFieldInfo } from '../utils/dom-utils'

interface InputOverlayProps {
  fieldInfo: InputFieldInfo | null
  position: { top: number; left: number } | null
  visible: boolean
  focusedElement: HTMLInputElement | HTMLTextAreaElement | null
}

export default function InputOverlay({ fieldInfo, position, visible, focusedElement }: InputOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  const getFieldTypeLabel = () => {
    if (!fieldInfo) return 'text input'

    const name = fieldInfo.name.toLowerCase()
    const id = fieldInfo.id.toLowerCase()
    const placeholder = fieldInfo.placeholder.toLowerCase()

    if (name.includes('email') || id.includes('email') || placeholder.includes('email')) {
      return 'email field'
    }
    if (name.includes('user') || id.includes('user') || placeholder.includes('user')) {
      return 'username field'
    }
    if (name.includes('pass') || id.includes('pass') || fieldInfo.type === 'password') {
      return 'password field'
    }
    if (name.includes('search') || id.includes('search') || placeholder.includes('search')) {
      return 'search field'
    }
    if (name.includes('url') || id.includes('url') || fieldInfo.type === 'url') {
      return 'URL field'
    }

    return `${fieldInfo.type} field`
  }

  useEffect(() => {
    if (visible && position && overlayRef.current) {
      const overlay = overlayRef.current
      const overlayRect = overlay.getBoundingClientRect()

      let top = position.top - overlayRect.height - 8
      let left = position.left

      if (top < 0) {
        top = position.top + 50
      }

      if (left + overlayRect.width > window.innerWidth) {
        left = window.innerWidth - overlayRect.width - 10
      }

      if (left < 10) {
        left = 10
      }

      overlay.style.top = `${top}px`
      overlay.style.left = `${left}px`
    }
  }, [visible, position])

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!visible || !focusedElement) return

    if (e.key === 'Escape') {
      focusedElement.blur()
    }
  }

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [visible, focusedElement])

  if (!visible || !fieldInfo) return null

  return (
    <div
      ref={overlayRef}
      className="fixed z-[2147483647] dropdown dropdown-content z-[2147483647] bg-base-300 rounded-box shadow-xl min-w-[200px] max-w-[300px]"
      style={{
        position: 'fixed',
      }}
    >
      <div className="card bg-base-300">
        <div className="card-body p-3">
          <h3 className="card-title text-sm mb-2">{getFieldTypeLabel()}</h3>
          <div className="space-y-1.5 text-xs">
            {fieldInfo.type && (
              <div className="flex justify-between">
                <span className="opacity-50">Type:</span>
                <span className="font-mono badge badge-sm badge-ghost">{fieldInfo.type}</span>
              </div>
            )}
            {fieldInfo.name && (
              <div className="flex justify-between">
                <span className="opacity-50">Name:</span>
                <span className="font-mono badge badge-sm badge-ghost truncate max-w-[150px]">{fieldInfo.name}</span>
              </div>
            )}
            {fieldInfo.placeholder && (
              <div className="flex justify-between">
                <span className="opacity-50">Placeholder:</span>
                <span className="font-mono badge badge-sm badge-ghost truncate max-w-[150px]">{fieldInfo.placeholder}</span>
              </div>
            )}
            <div className="text-[10px] opacity-50 mt-2 pt-2 border-t border-base-200">
              Press Ctrl+Space to insert saved resources
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
