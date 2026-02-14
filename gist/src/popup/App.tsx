import './App.css'

export default function App() {
  const openSidePanel = async () => {
    const currentWindow = await chrome.windows.getCurrent()
    if (currentWindow.id) {
      await chrome.sidePanel.open({ windowId: currentWindow.id })
    }
  }

  return (
    <div className="popup-container">
      <div className="popup-header">
        <h1>Local RAG</h1>
        <p className="subtitle">Your personal AI knowledge assistant</p>
      </div>
      
      <div className="popup-content">
        <button onClick={openSidePanel} className="open-panel-btn">
          Open Side Panel
        </button>
        
        <div className="info-section">
          <h3>Setup</h3>
          <ol className="setup-steps">
            <li>Start the API server: <code>python api_server.py</code></li>
            <li>Open the side panel to start chatting</li>
            <li>Add documents via <code>upload.py</code> or API</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
