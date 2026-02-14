import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import InputOverlay from './components/InputOverlay'
import { isTextInput, getInputInfo, getElementPosition, InputFieldInfo } from './utils/dom-utils'

console.log('[CRXJS] Input field detector loaded!')

let overlayRoot: any = null

function InputDetectorApp() {
  const [fieldInfo, setFieldInfo] = useState<InputFieldInfo | null>(null)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const [visible, setVisible] = useState(false)
  const [focusedElement, setFocusedElement] = useState<HTMLInputElement | HTMLTextAreaElement | null>(null)

  useEffect(() => {
    const handleFocus = (e: FocusEvent) => {
      const target = e.target
      if (!isTextInput(target)) return

      const info = getInputInfo(target)
      const pos = getElementPosition(target)

      setFieldInfo(info)
      setPosition(pos)
      setFocusedElement(target)
      setVisible(true)
    }

    const handleBlur = (e: FocusEvent) => {
      const overlay = document.querySelector('.input-overlay')
      if (overlay && overlay.contains(e.relatedTarget as Node)) {
        return
      }
      setVisible(false)
      setFocusedElement(null)
    }

    document.addEventListener('focusin', handleFocus, true)
    document.addEventListener('focusout', handleBlur, true)

    return () => {
      document.removeEventListener('focusin', handleFocus, true)
      document.removeEventListener('focusout', handleBlur, true)
    }
  }, [])

  return (
    <StrictMode>
      <InputOverlay fieldInfo={fieldInfo} position={position} visible={visible} focusedElement={focusedElement} />
    </StrictMode>
  )
}

const container = document.createElement('div')
container.id = 'input-detector-overlay'
document.body.appendChild(container)
overlayRoot = createRoot(container)
overlayRoot.render(<InputDetectorApp />)

const mutationObserver = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === 'childList') {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) {
          const inputs = node.querySelectorAll('input, textarea')
          inputs.forEach((input) => {
            input.addEventListener('focus', (e) => {
              if (isTextInput(e.target)) {
                const info = getInputInfo(e.target as HTMLInputElement | HTMLTextAreaElement)
                console.log('[InputDetector] New input focused:', info)
              }
            })
          })
        }
      })
    }
  })
})

mutationObserver.observe(document.body, {
  childList: true,
  subtree: true
})
