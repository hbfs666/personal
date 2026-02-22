import type { DraftRecord } from '../types/draft'

interface DraftBoxProps {
  drafts: DraftRecord[]
  onBack: () => void
  onOpenDraft: (draft: DraftRecord) => void
  onDeleteDraft: (draft: DraftRecord) => void
}

export default function DraftBox({ drafts, onBack, onOpenDraft, onDeleteDraft }: DraftBoxProps) {
  const handleOpen = (draft: DraftRecord) => {
    const input = window.prompt(`請輸入草稿「${draft.title}」的查看密碼`)
    if (input === null) return

    if (input !== draft.password) {
      window.alert('密碼錯誤，無法查看草稿')
      return
    }

    onOpenDraft(draft)
  }

  return (
    <div className="min-h-screen bg-transparent py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-8 bg-white/85 backdrop-blur-sm rounded-2xl shadow-lg border border-white/70 py-8 px-6">
          <h1 className="text-4xl font-bold text-indigo-900 mb-2">🗂 草稿箱</h1>
          <p className="text-indigo-600">點開草稿需要密碼，避免他人查看</p>
        </header>

        <div className="mb-4">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg"
          >
            ← 返回寄信頁
          </button>
        </div>

        {drafts.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-2xl p-8 text-center text-gray-600">
            目前沒有已保存的草稿
          </div>
        ) : (
          <div className="space-y-4">
            {drafts
              .slice()
              .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
              .map((draft) => (
                <div key={draft.id} className="bg-white rounded-xl shadow-md border border-gray-200 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-bold text-gray-900">{draft.title}</p>
                      <p className="text-sm text-gray-600 mt-1">
                        寄件人：{draft.payload.formData.senderName || '未填'} ｜ 收件人：{draft.payload.formData.recipientName || '未填'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        更新時間：{new Date(draft.updatedAt).toLocaleString('zh-TW')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpen(draft)}
                      className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                    >
                      🔓 輸入密碼查看
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteDraft(draft)}
                      className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold"
                    >
                      🗑 刪除草稿
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}
