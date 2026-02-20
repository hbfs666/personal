import { useState, useRef } from 'react'
import { motion } from 'framer-motion'

interface SendLetterProps {
  onLetterSent: (id: string) => void
}

export default function SendLetter({ onLetterSent }: SendLetterProps) {
  const [formData, setFormData] = useState({
    senderName: '',
    recipientName: '',
    letterContent: ''
  })
  const [delayUnit, setDelayUnit] = useState<'immediate' | 'day' | 'hour' | 'minute'>('day')
  const [delayValue, setDelayValue] = useState(5)

  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [shareLink, setShareLink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [copied, setCopied] = useState(false)
  const [shared, setShared] = useState(false)

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const getDelayMinutes = () => {
    if (delayUnit === 'immediate') return 0
    if (delayUnit === 'day') return delayValue * 24 * 60
    if (delayUnit === 'hour') return delayValue * 60
    return delayValue
  }

  const getDelayLabel = () => {
    if (delayUnit === 'immediate') return '立即可以看到'
    if (delayUnit === 'day') return `${delayValue} 天後解鎖`
    if (delayUnit === 'hour') return `${delayValue} 小時後解鎖`
    return `${delayValue} 分鐘後解鎖`
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) {
      Array.from(files).forEach(file => {
        const reader = new FileReader()
        reader.onload = (event) => {
          setImagePreviews(prev => [...prev, event.target?.result as string])
        }
        reader.readAsDataURL(file)
      })
    }
  }

  const removeImage = (index: number) => {
    setImagePreviews(prev => prev.filter((_, i) => i !== index))
    if (fileInputRef.current) {
      const dt = new DataTransfer()
      Array.from(fileInputRef.current.files || []).forEach((file, i) => {
        if (i !== index) {
          dt.items.add(file)
        }
      })
      fileInputRef.current.files = dt.files
    }
  }

  const handleCopyLink = async () => {
    if (shareLink) {
      await navigator.clipboard.writeText(shareLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleNativeShare = async () => {
    if (!shareLink) {
      return
    }

    try {
      if (navigator.share) {
        await navigator.share({
          title: `${formData.senderName} 寄來的一封信`,
          text: `${formData.recipientName}，這封信${delayUnit === 'immediate' ? '已可查看' : `將在 ${getDelayLabel()}。`}`,
          url: shareLink
        })
        setShared(true)
        setTimeout(() => setShared(false), 2000)
      } else {
        await navigator.clipboard.writeText(shareLink)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch (error) {
      console.error('Share canceled or failed:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    // 檢查必填欄位
    if (!formData.senderName || !formData.letterContent) {
      setError('請填入你的名字和信件內容')
      setIsLoading(false)
      return
    }

    try {
      const formDataToSend = new FormData()
      formDataToSend.append('senderName', formData.senderName)
      formDataToSend.append('recipientName', formData.recipientName)
      formDataToSend.append('letterContent', formData.letterContent)
      formDataToSend.append('delayMinutes', getDelayMinutes().toString())
      
      if (fileInputRef.current?.files) {
        Array.from(fileInputRef.current.files).forEach(file => {
          formDataToSend.append('images', file)
        })
      }

      const response = await fetch('http://localhost:3001/api/letters', {
        method: 'POST',
        body: formDataToSend
      })

      if (!response.ok) {
        const responseText = await response.text()
        let errorMessage = `伺服器錯誤 (${response.status})`

        try {
          const errorData = JSON.parse(responseText)
          if (errorData?.message) {
            errorMessage = errorData.message
          }
        } catch {
          if (responseText.includes('MulterError: Unexpected field')) {
            errorMessage = '上傳欄位不匹配，請重啟後端再試一次'
          } else if (responseText.trim()) {
            errorMessage = responseText.slice(0, 120)
          }
        }

        throw new Error(errorMessage)
      }

      const letter = await response.json()
      const link = `${window.location.origin}?id=${letter.id}`
      setShareLink(link)
      onLetterSent(letter.id)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '發送信件失敗，請檢查後端服務器是否運行'
      setError(errorMessage)
      console.error('Error sending letter:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (shareLink) {
    return (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl p-8 text-center"
      >
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-3xl font-bold text-indigo-900 mb-4">信件已發送！</h2>
        <p className="text-gray-600 mb-6">
          分享這個連結給 <span className="font-bold">{formData.recipientName}</span>
        </p>
        
        <div className="bg-blue-50 p-4 rounded-lg mb-6">
          <p className="text-sm text-gray-600 mb-2">分享連結：</p>
          <div className="mb-3">
            <input
              type="text"
              value={shareLink}
              readOnly
              className="w-full px-4 py-2 border-2 border-blue-300 rounded-lg bg-white text-blue-600 font-mono text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              onClick={handleCopyLink}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                copied
                  ? 'bg-green-600 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {copied ? '✓ 已複製' : '📋 複製'}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              onClick={handleNativeShare}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                shared
                  ? 'bg-green-600 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              {shared ? '✓ 已分享' : '📤 分享'}
            </motion.button>
          </div>
        </div>

        <div className="space-y-2 text-left bg-yellow-50 p-4 rounded-lg">
          <p className="font-semibold text-yellow-900">⏰ 延遲設定：</p>
          <p className="text-yellow-800">{getDelayLabel()}</p>
          <p className="text-sm text-yellow-700 mt-2">
            {delayUnit === 'immediate' ? '信件馬上就能查看' : '在這之前，你的筆友看到的會是模糊的信件 😉'}
          </p>
        </div>

        <button
          onClick={() => {
            setShareLink(null)
            setFormData({
              senderName: '',
              recipientName: '',
              letterContent: ''
            })
            setDelayUnit('day')
            setDelayValue(5)
            setImagePreviews([])
            if (fileInputRef.current) fileInputRef.current.value = ''
          }}
          className="mt-6 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
        >
          ✉️ 寄送另一封信
        </button>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="bg-white rounded-2xl shadow-2xl p-8"
    >
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-100 border-2 border-red-400 text-red-800 px-4 py-3 rounded-lg mb-6"
        >
          <p className="font-semibold">❌ 發送失敗</p>
          <p className="text-sm mt-1">{error}</p>
        </motion.div>
      )}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              你的名字
            </label>
            <input
              type="text"
              name="senderName"
              value={formData.senderName}
              onChange={handleInputChange}
              placeholder="例：小王"
              required
              className="w-full px-4 py-2 border-2 border-indigo-300 rounded-lg focus:outline-none focus:border-indigo-600 bg-indigo-50"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              筆友的名字
            </label>
            <input
              type="text"
              name="recipientName"
              value={formData.recipientName}
              onChange={handleInputChange}
              placeholder="例：小李"
              required
              className="w-full px-4 py-2 border-2 border-indigo-300 rounded-lg focus:outline-none focus:border-indigo-600 bg-indigo-50"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            信件內容
          </label>
          <textarea
            name="letterContent"
            value={formData.letterContent}
            onChange={handleInputChange}
            placeholder="寫下你的心語..."
            rows={6}
            required
            className="w-full px-4 py-2 border-2 border-indigo-300 rounded-lg focus:outline-none focus:border-indigo-600 bg-indigo-50 resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            📷 上傳信紙照片（可上傳多張）
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageChange}
            className="w-full px-4 py-2 border-2 border-dashed border-indigo-300 rounded-lg cursor-pointer"
          />
          {imagePreviews.length > 0 && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
              {imagePreviews.map((preview, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="relative group"
                >
                  <img
                    src={preview}
                    alt={`Preview ${index + 1}`}
                    className="w-full h-32 object-cover rounded-lg"
                  />
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => removeImage(index)}
                    type="button"
                    className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
                  >
                    ✕
                  </motion.button>
                </motion.div>
              ))}
            </div>
          )}
          <p className="text-xs text-gray-600 mt-2">
            {imagePreviews.length > 0 && `已上傳 ${imagePreviews.length} 張圖片`}
          </p>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            ⏰ 多久後才能看到？
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <select
              value={delayUnit}
              onChange={(e) => {
                const unit = e.target.value as 'immediate' | 'day' | 'hour' | 'minute'
                setDelayUnit(unit)
                if (unit === 'immediate') setDelayValue(0)
                if (unit === 'day' && delayValue < 1) setDelayValue(1)
                if (unit === 'hour' && (delayValue < 1 || delayValue > 23)) setDelayValue(1)
                if (unit === 'minute' && (delayValue < 1 || delayValue > 59)) setDelayValue(1)
              }}
              className="px-4 py-2 border-2 border-indigo-300 rounded-lg bg-white focus:outline-none focus:border-indigo-600"
            >
              <option value="immediate">立即</option>
              <option value="day">天</option>
              <option value="hour">小時（1-23）</option>
              <option value="minute">分鐘（1-59）</option>
            </select>

            {delayUnit !== 'immediate' ? (
              <input
                type="number"
                min={1}
                max={delayUnit === 'day' ? 30 : delayUnit === 'hour' ? 23 : 59}
                value={delayValue}
                onChange={(e) => {
                  const max = delayUnit === 'day' ? 30 : delayUnit === 'hour' ? 23 : 59
                  const numericValue = Number.parseInt(e.target.value || '1', 10)
                  const safeValue = Math.max(1, Math.min(Number.isFinite(numericValue) ? numericValue : 1, max))
                  setDelayValue(safeValue)
                }}
                className="px-4 py-2 border-2 border-indigo-300 rounded-lg bg-white focus:outline-none focus:border-indigo-600"
              />
            ) : (
              <div className="px-4 py-2 border-2 border-indigo-200 rounded-lg bg-indigo-50 text-indigo-700 font-semibold">
                立即可查看
              </div>
            )}
          </div>
          <p className="text-lg font-bold text-indigo-900 mt-3">{getDelayLabel()}</p>
          <p className="text-xs text-gray-600 mt-2">
            在這段時間內，信件會呈現模糊狀態 🔒
          </p>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-bold py-3 px-6 rounded-lg transition"
        >
          {isLoading ? '📤 發送中...' : '📮 寄出信件'}
        </button>
      </form>
    </motion.div>
  )
}
