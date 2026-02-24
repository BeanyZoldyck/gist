import { saveAndSyncResource, Resource } from './utils/resource-storage'

function getSelectedText(): string {
  const selection = window.getSelection()
  return selection?.toString().trim() || ''
}

function saveSelectedText() {
  const selectedText = getSelectedText()
  
  if (!selectedText) {
    showNotification('No text selected', 'Please select some text to save')
    return
  }

  const url = window.location.href
  const title = document.title || 'Untitled Page'
  
  const resource: Omit<Resource, 'id' | 'createdAt'> = {
    url,
    title,
    text: selectedText,
    notes: '',
    tags: []
  }
  
  saveAndSyncResource(resource).then(result => {
    if (result.synced) {
      showNotification('Saved!', 'Content synced to knowledge base')
    } else {
      showNotification('Saved locally', result.error || 'Content saved (sync failed)')
    }
  }).catch(error => {
    console.error('[SaveSelection] Failed to save:', error)
    showNotification('Save failed', 'Could not save content')
  })
}

function showNotification(title: string, message: string) {
  const notification = document.createElement('div')
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 2147483647;
    background: #1a1a1a;
    border: 1px solid #333;
    border-radius: 8px;
    padding: 12px 16px;
    min-width: 280px;
    max-width: 400px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    font-family: system-ui, -apple-system, sans-serif;
  `
  
  notification.innerHTML = `
    <div style="font-weight: 600; font-size: 14px; color: ${title === 'Saved!' ? '#10b981' : title === 'Save failed' ? '#ef4444' : '#f59e0b'}; margin-bottom: 4px;">
      ${title}
    </div>
    <div style="font-size: 12px; color: #888;">
      ${message}
    </div>
  `
  
  document.body.appendChild(notification)
  
  requestAnimationFrame(() => {
    notification.style.opacity = '1'
    notification.style.transform = 'translateX(0)'
  })
  
  setTimeout(() => {
    notification.style.opacity = '0'
    notification.style.transform = 'translateX(400px)'
    setTimeout(() => notification.remove(), 300)
  }, 2500)
}

function handleKeyboardShortcut(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
    e.preventDefault()
    e.stopPropagation()
    saveSelectedText()
  }
}

function handleMessage(e: MessageEvent) {
  if (e.data.type === 'SAVE_SELECTION') {
    saveSelectedText()
  }
}

if (typeof window !== 'undefined' && window.location.protocol !== 'chrome-extension:') {
  document.addEventListener('keydown', handleKeyboardShortcut, true)
  window.addEventListener('message', handleMessage)
}

console.log('[SaveSelection] Content script loaded')
