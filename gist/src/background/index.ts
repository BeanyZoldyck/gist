chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'save-selection',
    title: 'Save to Gist Knowledge Base',
    contexts: ['selection']
  })
})

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'save-selection') {
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'SAVE_SELECTION' })
    }
  }
})

console.log('[Background] Service worker loaded')
