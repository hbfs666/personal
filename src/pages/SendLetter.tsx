import { useState, useRef } from 'react'
import { motion } from 'framer-motion'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
const apiUrl = (path: string) => `${API_BASE_URL}${path}`
const STAMP_BG_COLOR = '#fff7ed'
const STAMP_BORDER_COLOR = '#f59e0b'
const STAMP_COLOR_OPTIONS = [
  '#0f172a', '#1e3a8a', '#1d4ed8', '#0ea5e9', '#06b6d4',
  '#065f46', '#16a34a', '#65a30d', '#eab308', '#f59e0b',
  '#ea580c', '#dc2626', '#be123c', '#db2777', '#7c3aed',
  '#6d28d9', '#4b5563', '#111827', '#ffffff'
]

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
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [shareLink, setShareLink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const audioInputRef = useRef<HTMLInputElement>(null)
  const stampCanvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawingRef = useRef(false)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)
  const [copied, setCopied] = useState(false)
  const [shared, setShared] = useState(false)
  const [stampDataUrl, setStampDataUrl] = useState<string | null>(null)
  const [showStampEditor, setShowStampEditor] = useState(false)
  const [brushColor, setBrushColor] = useState('#1e3a8a')
  const [brushSize, setBrushSize] = useState(6)
  const [isEraserMode, setIsEraserMode] = useState(false)

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

  const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedAudio = e.target.files?.[0] || null
    setAudioFile(selectedAudio)
  }

  const removeAudio = () => {
    setAudioFile(null)
    if (audioInputRef.current) {
      audioInputRef.current.value = ''
    }
  }

  const initializeStampCanvas = (withExistingStamp = true) => {
    const canvas = stampCanvasRef.current
    if (!canvas) {
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    ctx.fillStyle = STAMP_BG_COLOR
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = STAMP_BORDER_COLOR
    ctx.lineWidth = 3
    ctx.strokeRect(1.5, 1.5, canvas.width - 3, canvas.height - 3)

    if (withExistingStamp && stampDataUrl) {
      const image = new Image()
      image.onload = () => {
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
      }
      image.src = stampDataUrl
    }
  }

  const getStampPointerPosition = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = stampCanvasRef.current
    if (!canvas) {
      return { x: 0, y: 0 }
    }

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    }
  }

  const handleStampPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = stampCanvasRef.current
    if (!canvas) {
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    canvas.setPointerCapture(e.pointerId)
    isDrawingRef.current = true
    const startPoint = getStampPointerPosition(e)
    lastPointRef.current = startPoint
    const activeColor = isEraserMode ? STAMP_BG_COLOR : brushColor

    ctx.beginPath()
    ctx.fillStyle = activeColor
    ctx.arc(startPoint.x, startPoint.y, Math.max(brushSize / 2, 2), 0, Math.PI * 2)
    ctx.fill()
  }

  const handleStampPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) {
      return
    }

    const canvas = stampCanvasRef.current
    if (!canvas || !lastPointRef.current) {
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    const currentPoint = getStampPointerPosition(e)
    ctx.strokeStyle = isEraserMode ? STAMP_BG_COLOR : brushColor
    ctx.lineWidth = brushSize
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y)
    ctx.lineTo(currentPoint.x, currentPoint.y)
    ctx.stroke()
    lastPointRef.current = currentPoint
  }

  const handleStampPointerEnd = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = stampCanvasRef.current
    if (canvas && canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId)
    }
    isDrawingRef.current = false
    lastPointRef.current = null
  }

  const openStampEditor = () => {
    setShowStampEditor(true)
    requestAnimationFrame(() => initializeStampCanvas(true))
  }

  const handleSelectBrushColor = (color: string) => {
    setBrushColor(color)
    setIsEraserMode(false)
  }

  const clearStampCanvas = () => {
    initializeStampCanvas(false)
  }

  const saveStampDrawing = () => {
    const canvas = stampCanvasRef.current
    if (!canvas) {
      return
    }
    setStampDataUrl(canvas.toDataURL('image/png'))
    setShowStampEditor(false)
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

      if (audioFile) {
        formDataToSend.append('audio', audioFile)
      }

      if (stampDataUrl) {
        formDataToSend.append('stampData', stampDataUrl)
      }

      const response = await fetch(apiUrl('/api/letters'), {
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
            setAudioFile(null)
            setStampDataUrl(null)
            setShowStampEditor(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
            if (audioInputRef.current) audioInputRef.current.value = ''
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

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            🎵 附加音頻（可選）
          </label>
          <input
            ref={audioInputRef}
            type="file"
            accept="audio/*"
            onChange={handleAudioChange}
            className="w-full px-4 py-2 border-2 border-dashed border-indigo-300 rounded-lg cursor-pointer"
          />
          {audioFile && (
            <div className="mt-3 flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
              <p className="text-sm text-indigo-800 truncate">🎧 {audioFile.name}</p>
              <button
                type="button"
                onClick={removeAudio}
                className="ml-3 px-2 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700"
              >
                移除
              </button>
            </div>
          )}
          <p className="text-xs text-gray-600 mt-2">解鎖後筆友可直接播放這段音頻</p>
        </div>

        <div className="bg-amber-50 p-4 rounded-lg border-2 border-amber-200">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            🎟️ 自製郵票（可選）
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={openStampEditor}
              className="px-4 py-2 rounded-lg bg-amber-500 text-white font-semibold hover:bg-amber-600 transition"
            >
              {stampDataUrl ? '重新繪製郵票' : '開始繪製郵票'}
            </button>
            {stampDataUrl && (
              <button
                type="button"
                onClick={() => setStampDataUrl(null)}
                className="px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition"
              >
                移除郵票
              </button>
            )}
          </div>

          {stampDataUrl && (
            <div className="mt-3">
              <p className="text-xs text-gray-600 mb-2">郵票預覽</p>
              <img
                src={stampDataUrl}
                alt="自製郵票預覽"
                className="w-24 h-24 object-cover rounded-md border-2 border-amber-300 bg-white"
              />
            </div>
          )}

          <p className="text-xs text-gray-600 mt-3">筆友收到信後，郵票會顯示在信件右上角</p>
        </div>

        {showStampEditor && (
          <div className="bg-white border-2 border-amber-300 rounded-lg p-4 space-y-3">
            <p className="font-semibold text-amber-900">在小郵票內自由塗鴉</p>
            <div className="flex flex-wrap items-center gap-2">
              {STAMP_COLOR_OPTIONS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => handleSelectBrushColor(color)}
                  className={`w-7 h-7 rounded-full border-2 transition ${
                    !isEraserMode && brushColor === color ? 'border-gray-900 scale-110' : 'border-white'
                  }`}
                  style={{ backgroundColor: color }}
                  aria-label={`選擇顏色 ${color}`}
                />
              ))}
              <label className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 text-xs text-gray-700">
                自定義
                <input
                  type="color"
                  value={brushColor}
                  onChange={(e) => handleSelectBrushColor(e.target.value)}
                  className="w-7 h-7 border-0 p-0 bg-transparent cursor-pointer"
                  aria-label="自定義畫筆顏色"
                />
              </label>
              <button
                type="button"
                onClick={() => setIsEraserMode((prev) => !prev)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition ${
                  isEraserMode
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                }`}
              >
                {isEraserMode ? '🧽 橡皮擦中' : '🧽 橡皮擦'}
              </button>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">畫筆粗細：{brushSize}px</label>
              <input
                type="range"
                min={2}
                max={18}
                value={brushSize}
                onChange={(e) => setBrushSize(Number.parseInt(e.target.value, 10))}
                className="w-56 accent-amber-500"
              />
            </div>
            <canvas
              ref={stampCanvasRef}
              width={240}
              height={240}
              onPointerDown={handleStampPointerDown}
              onPointerMove={handleStampPointerMove}
              onPointerUp={handleStampPointerEnd}
              onPointerLeave={handleStampPointerEnd}
              className="w-60 h-60 rounded-md border-2 border-amber-400 bg-amber-100 touch-none"
              style={{ cursor: isEraserMode ? 'cell' : 'crosshair' }}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={clearStampCanvas}
                className="px-3 py-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm font-semibold transition"
              >
                清空重畫
              </button>
              <button
                type="button"
                onClick={saveStampDrawing}
                className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition"
              >
                保存郵票
              </button>
              <button
                type="button"
                onClick={() => setShowStampEditor(false)}
                className="px-3 py-1.5 rounded-lg bg-gray-600 hover:bg-gray-700 text-white text-sm font-semibold transition"
              >
                取消
              </button>
            </div>
          </div>
        )}

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
