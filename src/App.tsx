import { useCallback, useEffect, useState } from 'react'
import SendLetter from './pages/SendLetter'
import ViewLetter from './pages/ViewLetter'
import DraftBox from './pages/DraftBox'
import SendToMailboxTransition from './components/SendToMailboxTransition'
import type { DraftRecord } from './types/draft'
import './index.css'

const DRAFT_BOX_STORAGE_KEY = 'letter_draft_box_v1'
const DRAFT_ASSET_DB_NAME = 'letter_draft_assets_db'
const DRAFT_ASSET_STORE_NAME = 'draft_assets'

function App() {
  const [currentPage, setCurrentPage] = useState<'send' | 'view' | 'drafts'>('send')
  const [letterId, setLetterId] = useState<string | null>(null)
  const [pendingLetterId, setPendingLetterId] = useState<string | null>(null)
  const [isTransitioningToView, setIsTransitioningToView] = useState(false)
  const [drafts, setDrafts] = useState<DraftRecord[]>([])
  const [selectedDraft, setSelectedDraft] = useState<DraftRecord | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const id = params.get('id')
    if (id) {
      setLetterId(id)
      setCurrentPage('view')
    }
  }, [])

  useEffect(() => {
    const raw = localStorage.getItem(DRAFT_BOX_STORAGE_KEY)
    if (!raw) {
      return
    }

    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        setDrafts(parsed)
      }
    } catch (error) {
      console.error('Failed to parse draft box:', error)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(DRAFT_BOX_STORAGE_KEY, JSON.stringify(drafts))
  }, [drafts])

  const handleShareLink = (id: string) => {
    setPendingLetterId(id)
    setIsTransitioningToView(true)
  }

  const handleTransitionComplete = useCallback(() => {
    if (!pendingLetterId) {
      setIsTransitioningToView(false)
      return
    }

    window.history.pushState({}, '', `?id=${pendingLetterId}`)
    setLetterId(pendingLetterId)
    setCurrentPage('view')
    setPendingLetterId(null)
    setIsTransitioningToView(false)
  }, [pendingLetterId])

  useEffect(() => {
    if (currentPage !== 'send') {
      return
    }

    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search)
      const id = params.get('id')
      if (id) {
        setLetterId(id)
        setCurrentPage('view')
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [currentPage])

  useEffect(() => {
    if (currentPage === 'view') {
      setPendingLetterId(null)
      setIsTransitioningToView(false)
    }
  }, [currentPage])

  const handleBackToSend = () => {
    window.history.pushState({}, '', '/')
    setCurrentPage('send')
  }

  const handleOpenDrafts = () => {
    setCurrentPage('drafts')
  }

  const handleSaveDraft = (draft: DraftRecord) => {
    setDrafts((prev) => {
      const index = prev.findIndex((item) => item.id === draft.id)
      if (index === -1) {
        return [draft, ...prev]
      }

      const updated = [...prev]
      updated[index] = draft
      return updated
    })
  }

  const handleOpenDraft = (draft: DraftRecord) => {
    setSelectedDraft(draft)
    setCurrentPage('send')
  }

  const deleteDraftAssets = async (draftId: string) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return
    }

    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = window.indexedDB.open(DRAFT_ASSET_DB_NAME, 1)
      request.onupgradeneeded = () => {
        const nextDb = request.result
        if (!nextDb.objectStoreNames.contains(DRAFT_ASSET_STORE_NAME)) {
          nextDb.createObjectStore(DRAFT_ASSET_STORE_NAME, { keyPath: 'draftId' })
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error || new Error('開啟附件資料庫失敗'))
    })

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DRAFT_ASSET_STORE_NAME, 'readwrite')
      const store = tx.objectStore(DRAFT_ASSET_STORE_NAME)
      store.delete(draftId)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error || new Error('刪除草稿附件失敗'))
      tx.onabort = () => reject(tx.error || new Error('刪除草稿附件被中止'))
    })

    db.close()
  }

  const handleDeleteDraft = async (draft: DraftRecord) => {
    const confirmed = window.confirm(`確定要刪除草稿「${draft.title}」嗎？`)
    if (!confirmed) {
      return
    }

    try {
      await deleteDraftAssets(draft.id)
    } catch (error) {
      console.error('Delete draft assets failed:', error)
    }

    setDrafts((prev) => prev.filter((item) => item.id !== draft.id))

    if (selectedDraft?.id === draft.id) {
      setSelectedDraft(null)
    }
  }

  const handleDraftLoaded = () => {
    setSelectedDraft(null)
  }

  if (currentPage === 'view' && letterId) {
    return <ViewLetter letterId={letterId} onBack={handleBackToSend} />
  }

  if (currentPage === 'drafts') {
    return (
      <DraftBox
        drafts={drafts}
        onBack={handleBackToSend}
        onOpenDraft={handleOpenDraft}
        onDeleteDraft={handleDeleteDraft}
      />
    )
  }

  return (
    <div className="min-h-screen bg-transparent py-12 px-4">
      <SendToMailboxTransition
        visible={isTransitioningToView}
        onComplete={handleTransitionComplete}
      />
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-12 bg-white/85 backdrop-blur-sm rounded-2xl shadow-lg border border-white/70 py-8 px-6">
          <h1 className="text-5xl font-bold text-indigo-900 mb-2">
            📮 延時信件系統
          </h1>
          <p className="text-indigo-600 text-lg">
            寄送你的信件，設定延遲時間讓朋友驚喜發現
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => setCurrentPage('send')}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
            >
              ✉️ 寄信
            </button>
            <button
              type="button"
              onClick={handleOpenDrafts}
              className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-800 text-white font-semibold"
            >
              🗂 草稿箱
            </button>
          </div>
        </header>

        <SendLetter
          onLetterSent={handleShareLink}
          onSaveDraft={handleSaveDraft}
          onOpenDraftBox={handleOpenDrafts}
          externalDraftToLoad={selectedDraft}
          onExternalDraftLoaded={handleDraftLoaded}
        />
      </div>
    </div>
  )
}

export default App
