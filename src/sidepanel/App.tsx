import { useState, useEffect } from "react";
import {
  Resource,
  getAllResources,
  deleteResource,
  deleteAllResources,
  updateResourceTags,
  updateResourceNotes,
  searchResources,
  formatResourceDate,
  getResourcePreviewText,
  addDocument,
  importVaultLines,
  getVaultStats,
} from "../content/utils/resource-storage";
import AIChat from "./AIChat";
import AskPanel from "./AskPanel";
import "./AIChat.css";

interface EditModal {
  resource: Resource | null;
  show: boolean;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<"resources" | "ai" | "ask">(
    "resources",
  );
  const [resources, setResources] = useState<Resource[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState<EditModal>({
    resource: null,
    show: false,
  });
  const [editTags, setEditTags] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [hoveredTitle, setHoveredTitle] = useState<string | null>(null);
  const [vaultCount, setVaultCount] = useState<number | null>(null);
  const [addDocModal, setAddDocModal] = useState({ show: false, content: "", docId: "" });
  const [importResult, setImportResult] = useState<string | null>(null);

  useEffect(() => {
    console.log("[SidePanel] App mounted");
    const newPort = chrome.runtime.connect({ name: "sidePanel" });
    console.log("[SidePanel] Connected to background script");

    newPort.onMessage.addListener(() => {
      console.log("[SidePanel] Received message from background");
      newPort.postMessage({ type: "sidePanelActive" });
    });

    newPort.onDisconnect.addListener(() => {
      console.log("[SidePanel] Disconnected from background script");
    });

    loadResources();

    return () => {
      console.log("[SidePanel] App unmounting");
      newPort.disconnect();
    };
  }, []);

  useEffect(() => {
    const handleMessage = (message: any) => {
      if (message.type === "RESOURCES_UPDATED") {
        loadResources();
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  const loadResources = async () => {
    setLoading(true);
    const loaded = await getAllResources();
    setResources(loaded);
    setLoading(false);
    const stats = await getVaultStats();
    setVaultCount(stats.count);
  };

  useEffect(() => {
    const performSearch = async () => {
      setLoading(true);
      const results = await searchResources(query);
      setResources(results);
      setLoading(false);
    };

    const debounceTimer = setTimeout(() => {
      if (query.length > 0) {
        performSearch();
      } else {
        loadResources();
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [query]);

  const handleDelete = async (id: string) => {
    const confirmed = await new Promise<boolean>((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "modal-overlay";
      overlay.innerHTML = `
        <div class="modal-box">
          <div class="modal-title">Delete Resource</div>
          <div class="modal-text">Are you sure you want to delete this resource?</div>
          <div class="modal-actions">
            <button class="btn-cancel">Cancel</button>
            <button class="btn-delete">Delete</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      overlay.querySelector(".btn-cancel")?.addEventListener("click", () => {
        document.body.removeChild(overlay);
        resolve(false);
      });
      overlay.querySelector(".btn-delete")?.addEventListener("click", () => {
        document.body.removeChild(overlay);
        resolve(true);
      });
    });

    if (confirmed) {
      await deleteResource(id);
      await loadResources();
    }
  };

  const handleDeleteAll = async () => {
    const confirmed = await new Promise<boolean>((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "modal-overlay";
      overlay.innerHTML = `
        <div class="modal-box">
          <div class="modal-title modal-title-danger">Clear vault</div>
          <div class="modal-text">Are you sure you want to delete all resources? This action cannot be undone.</div>
          <div class="modal-actions">
            <button class="btn-cancel">Cancel</button>
            <button class="btn-delete">Clear vault</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      overlay.querySelector(".btn-cancel")?.addEventListener("click", () => {
        document.body.removeChild(overlay);
        resolve(false);
      });
      overlay.querySelector(".btn-delete")?.addEventListener("click", () => {
        document.body.removeChild(overlay);
        resolve(true);
      });
    });

    if (confirmed) {
      await deleteAllResources();
      await loadResources();
    }
  };

  const openEditModal = (resource: Resource) => {
    setEditModal({ resource, show: true });
    setEditTags(resource.tags.join(", "));
    setEditNotes(resource.notes);
  };

  const closeEditModal = () => {
    setEditModal({ resource: null, show: false });
    setEditTags("");
    setEditNotes("");
  };

  const saveEdit = async () => {
    if (!editModal.resource) return;

    const tags = editTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    await updateResourceTags(editModal.resource.id, tags);
    await updateResourceNotes(editModal.resource.id, editNotes);
    closeEditModal();
    await loadResources();
  };

  const openResource = (url: string) => {
    if (url.startsWith("local://")) return;
    window.open(url, "_blank");
  };

  const handleAddDocumentClick = () => {
    setAddDocModal({ show: true, content: "", docId: "" });
    setImportResult(null);
  };

  const handleSubmitAddDocument = async () => {
    if (!addDocModal.content.trim()) return;
    try {
      await addDocument(addDocModal.content.trim(), addDocModal.docId.trim() || undefined);
      setAddDocModal({ show: false, content: "", docId: "" });
      await loadResources();
    } catch (err) {
      console.error("[SidePanel] Add document failed:", err);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const { addedCount } = await importVaultLines(lines);
      setImportResult(`Imported ${addedCount} line(s).`);
      await loadResources();
      setTimeout(() => setImportResult(null), 4000);
    } catch (err) {
      console.error("[SidePanel] Import failed:", err);
      setImportResult("Import failed.");
      setTimeout(() => setImportResult(null), 4000);
    }
  };

  return (
    <div className="app-container">
      <div className="app-header">
        <div className="tab-navigation">
          <button
            className={`tab-button ${activeTab === "resources" ? "active" : ""}`}
            onClick={() => setActiveTab("resources")}
          >
            📚 Resources
          </button>
          <button
            className={`tab-button ${activeTab === "ai" ? "active" : ""}`}
            onClick={() => setActiveTab("ai")}
          >
            🤖 AI Assistant
          </button>
          <button
            className={`tab-button ${activeTab === "ask" ? "active" : ""}`}
            onClick={() => setActiveTab("ask")}
          >
            💬 Ask
          </button>
        </div>
      </div>

      {activeTab === "resources" && (
        <div className="resources-panel">
          <div className="panel-header">
            <h2 className="header-title">RESOURCES</h2>
            {vaultCount !== null && (
              <span className="vault-count" title="Vault size">{vaultCount}</span>
            )}
            <div className="panel-header-actions">
              <button type="button" onClick={handleAddDocumentClick} className="btn-action">
                Add document
              </button>
              <label className="btn-action">
                Import from file
                <input
                  type="file"
                  accept=".txt,text/plain"
                  onChange={handleImportFile}
                  style={{ display: "none" }}
                />
              </label>
              {resources.length > 0 && (
                <button onClick={handleDeleteAll} className="btn-delete-all">
                  Clear vault
                </button>
              )}
            </div>
          </div>
          {importResult && (
            <div className="import-result">{importResult}</div>
          )}
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter resources..."
            className="search-input"
          />
          <div className="resource-list">
            {loading ? (
              <div className="empty-state">
                <span className="empty-icon">⟳</span>
                <div className="empty-text">Loading...</div>
              </div>
            ) : resources.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon large">∅</span>
                <div className="empty-text empty-title">No resources found</div>
                <div className="empty-text empty-subtitle">
                  Use Ctrl+Shift+L to capture links
                </div>
              </div>
            ) : (
              <div className="resources">
                {resources.map((resource) => (
                  <div
                    key={resource.id}
                    className={`resource-card ${hoveredCard === resource.id ? "resource-card-hover" : ""}`}
                    onMouseEnter={() => setHoveredCard(resource.id)}
                    onMouseLeave={() => setHoveredCard(null)}
                  >
                    <div>
                      <div
                        className={`resource-title ${hoveredTitle === resource.id ? "resource-title-hover" : ""}`}
                        onClick={() => openResource(resource.url)}
                        onMouseEnter={() => setHoveredTitle(resource.id)}
                        onMouseLeave={() => setHoveredTitle(null)}
                      >
                        {resource.title}
                      </div>
                      <div className="resource-url" title={resource.url}>
                        {resource.url}
                      </div>
                      {resource.pageUrl &&
                        resource.pageUrl !== resource.url && (
                          <div
                            className="metadata-row"
                            title={resource.pageUrl}
                          >
                            <span className="metadata-label">pageUrl:</span>{" "}
                            {resource.pageUrl}
                          </div>
                        )}
                      {resource.pageTitle &&
                        resource.pageTitle !== resource.title && (
                          <div
                            className="metadata-row"
                            title={resource.pageTitle}
                          >
                            <span className="metadata-label">pageTitle:</span>{" "}
                            {resource.pageTitle}
                          </div>
                        )}
                      {resource.linkContext && (
                        <div
                          className="metadata-row"
                          title={resource.linkContext}
                        >
                          <span className="metadata-label">context:</span> "
                          {resource.linkContext}"
                        </div>
                      )}
                      {resource.tags.length > 0 && (
                        <div className="tags-container">
                          {resource.tags.map((tag, i) => (
                            <span key={i} className="tag">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                      {resource.notes && (
                        <div className="resource-notes" title={resource.notes}>
                          {getResourcePreviewText(resource)}
                        </div>
                      )}
                      <div className="actions-container">
                        <button
                          onClick={() => openEditModal(resource)}
                          className="btn-action"
                        >
                          EDIT
                        </button>
                        <button
                          onClick={() => handleDelete(resource.id)}
                          className="btn-action btn-action-delete"
                        >
                          DELETE
                        </button>
                      </div>
                      <div className="timestamp">
                        {formatResourceDate(resource.createdAt)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "ai" && <AIChat />}

      {activeTab === "ask" && <AskPanel />}

      {addDocModal.show && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-title">Add document</div>
            <div className="modal-field">
              <label className="modal-label">Content</label>
              <textarea
                value={addDocModal.content}
                onChange={(e) => setAddDocModal((p) => ({ ...p, content: e.target.value }))}
                placeholder="Paste or type document content..."
                className="modal-textarea"
                rows={5}
              />
            </div>
            <div className="modal-field">
              <label className="modal-label">Document ID (optional, for update)</label>
              <input
                type="text"
                value={addDocModal.docId}
                onChange={(e) => setAddDocModal((p) => ({ ...p, docId: e.target.value }))}
                placeholder="doc_1"
                className="modal-input"
              />
            </div>
            <div className="modal-actions">
              <button
                onClick={() => setAddDocModal({ show: false, content: "", docId: "" })}
                className="btn-cancel"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitAddDocument}
                className="btn-save"
                disabled={!addDocModal.content.trim()}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {editModal.show && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-title">Edit Resource</div>
            <div className="modal-field">
              <label className="modal-label">title</label>
              <div className="modal-value">{editModal.resource?.title}</div>
            </div>
            <div className="modal-field">
              <label className="modal-label">url</label>
              <div
                className="modal-value modal-value-truncate"
                title={editModal.resource?.url}
              >
                {editModal.resource?.url}
              </div>
            </div>
            <div className="modal-field">
              <label className="modal-label">tags</label>
              <input
                type="text"
                value={editTags}
                onChange={(e) => setEditTags(e.target.value)}
                placeholder="tag1, tag2, tag3"
                className="modal-input"
              />
            </div>
            <div className="modal-field">
              <label className="modal-label">notes</label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                className="modal-textarea"
              />
            </div>
            <div className="modal-actions">
              <button onClick={closeEditModal} className="btn-cancel">
                Cancel
              </button>
              <button onClick={saveEdit} className="btn-save">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
