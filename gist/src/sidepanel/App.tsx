import { useState, useEffect } from 'react'
import { Resource, getAllResources, deleteResource, updateResourceTags, updateResourceNotes, searchResources, formatResourceDate, getResourcePreviewText } from '../content/utils/resource-storage'

interface EditModal {
  resource: Resource | null
  show: boolean
}

export default function App() {
  const [resources, setResources] = useState<Resource[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [editModal, setEditModal] = useState<EditModal>({ resource: null, show: false })
  const [editTags, setEditTags] = useState('')
  const [editNotes, setEditNotes] = useState('')

  useEffect(() => {
    loadResources()
  }, [])

  const loadResources = async () => {
    setLoading(true)
    const loaded = await getAllResources()
    setResources(loaded)
    setLoading(false)
  }

  useEffect(() => {
    const performSearch = async () => {
      setLoading(true)
      const results = await searchResources(query)
      setResources(results)
      setLoading(false)
    }

    const debounceTimer = setTimeout(() => {
      if (query.length > 0) {
        performSearch()
      } else {
        loadResources()
      }
    }, 300)

    return () => clearTimeout(debounceTimer)
  }, [query])

  const handleDelete = async (id: string) => {
    const confirmed = await new Promise<boolean>((resolve) => {
      const modal = document.createElement('dialog')
      modal.className = 'modal modal-open'
      modal.innerHTML = `
        <div class="modal-box">
          <h3 class="font-bold text-lg">Delete Resource</h3>
          <p class="py-4">Are you sure you want to delete this resource?</p>
          <div class="modal-action">
            <form method="dialog" class="btn-cancel">
              <button class="btn">Cancel</button>
            </form>
            <form method="dialog" class="btn-confirm">
              <button class="btn btn-error">Delete</button>
            </form>
          </div>
        </div>
        <form method="dialog" class="modal-backdrop">
          <button>close</button>
        </form>
      `
      document.body.appendChild(modal)

      modal.querySelector('.btn-cancel button')?.addEventListener('click', () => resolve(false))
      modal.querySelector('.btn-confirm button')?.addEventListener('click', () => resolve(true))
    })

    if (confirmed) {
      await deleteResource(id)
      await loadResources()
    }
  }

  const openEditModal = (resource: Resource) => {
    setEditModal({ resource, show: true })
    setEditTags(resource.tags.join(', '))
    setEditNotes(resource.notes)
  }

  const closeEditModal = () => {
    setEditModal({ resource: null, show: false })
    setEditTags('')
    setEditNotes('')
  }

  const saveEdit = async () => {
    if (!editModal.resource) return

    const tags = editTags.split(',').map(t => t.trim()).filter(Boolean)
    await updateResourceTags(editModal.resource.id, tags)
    await updateResourceNotes(editModal.resource.id, editNotes)
    closeEditModal()
    await loadResources()
  }

  const openResource = (url: string) => {
    window.open(url, '_blank')
  }

  return (
    <div className="h-screen flex flex-col bg-base-200">
      <div className="p-4 border-b border-base-300">
        <h2 className="text-lg font-semibold mb-3">Saved Resources</h2>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search resources..."
          className="input input-bordered w-full"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="text-center opacity-50 mt-10">Loading...</div>
        ) : resources.length === 0 ? (
          <div className="text-center opacity-50 mt-10">
            <p className="text-4xl mb-2">📂</p>
            <p>No resources saved yet</p>
            <p className="text-sm mt-2">Use link hints (Ctrl+Shift+L) to save links</p>
          </div>
        ) : (
          <div className="space-y-3">
            {resources.map((resource) => (
              <div
                key={resource.id}
                className="card bg-base-100 shadow-sm border border-base-300"
              >
                <div className="card-body p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3
                        className="card-title text-base cursor-pointer hover:text-primary"
                        onClick={() => openResource(resource.url)}
                      >
                        {resource.title}
                      </h3>
                      <p className="text-xs opacity-70 truncate mt-1">{resource.url}</p>
                      {resource.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {resource.tags.map((tag, i) => (
                            <span key={i} className="badge badge-sm badge-ghost">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      {resource.notes && (
                        <p className="text-xs opacity-60 mt-2 line-clamp-2">{getResourcePreviewText(resource)}</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => openEditModal(resource)}
                        className="btn btn-xs btn-ghost text-primary"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(resource.id)}
                        className="btn btn-xs btn-ghost text-error"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <div className="text-[10px] opacity-50 mt-2">
                    {formatResourceDate(resource.createdAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <dialog className={`modal ${editModal.show ? 'modal-open' : ''}`}>
        <div className="modal-box">
          <h3 className="font-bold text-lg">Edit Resource</h3>
          <div className="py-4 space-y-4">
            <div>
              <label className="label">
                <span className="label-text">Title</span>
              </label>
              <div className="text-sm opacity-70">{editModal.resource?.title}</div>
            </div>
            <div>
              <label className="label">
                <span className="label-text">URL</span>
              </label>
              <div className="text-sm opacity-70 truncate">{editModal.resource?.url}</div>
            </div>
            <div>
              <label className="label">
                <span className="label-text">Tags (comma-separated)</span>
              </label>
              <input
                type="text"
                value={editTags}
                onChange={(e) => setEditTags(e.target.value)}
                className="input input-bordered w-full"
              />
            </div>
            <div>
              <label className="label">
                <span className="label-text">Notes</span>
              </label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                className="textarea textarea-bordered w-full"
                rows={4}
              />
            </div>
          </div>
          <div className="modal-action">
            <button onClick={closeEditModal} className="btn">
              Cancel
            </button>
            <button onClick={saveEdit} className="btn btn-primary">
              Save
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button onClick={closeEditModal}>close</button>
        </form>
      </dialog>
    </div>
  )
}
