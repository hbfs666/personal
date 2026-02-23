import { useEffect, useState, useRef } from 'react'
import { motion } from 'framer-motion'
import type { DraftRecord } from '../types/draft'

const LOCAL_FALLBACK_API_BASE_URL =
  typeof window !== 'undefined' && /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname)
    ? 'http://localhost:3001'
    : ''
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || LOCAL_FALLBACK_API_BASE_URL || '').replace(/\/$/, '')
const apiUrl = (path: string) => `${API_BASE_URL}${path}`
const STAMP_BG_COLOR = '#fff7ed'
const STAMP_BORDER_COLOR = '#f59e0b'
const DRAFT_STORAGE_KEY = 'letter_draft_v1'
const DRAFT_ASSET_DB_NAME = 'letter_draft_assets_db'
const DRAFT_ASSET_STORE_NAME = 'draft_assets'
const PAPER_THEME_OPTIONS = [
  { value: 'classic', label: '經典信紙' },
  { value: 'warm', label: '暖黃信紙' },
  { value: 'mint', label: '薄荷信紙' },
  { value: 'lavender', label: '薰衣草信紙' }
] as const
const STAMP_TEMPLATE_OPTIONS = [
  { value: 'classic', label: '經典' },
  { value: 'star', label: '星星' },
  { value: 'heart', label: '愛心' },
  { value: 'wave', label: '波紋' }
] as const
const STAMP_COLOR_OPTIONS = [
  '#0f172a', '#1e3a8a', '#1d4ed8', '#0ea5e9', '#06b6d4',
  '#065f46', '#16a34a', '#65a30d', '#eab308', '#f59e0b',
  '#ea580c', '#dc2626', '#be123c', '#db2777', '#7c3aed',
  '#6d28d9', '#4b5563', '#111827', '#ffffff'
]

interface SendLetterProps {
  onLetterSent: (id: string) => void
  onSaveDraft: (draft: DraftRecord) => void
  onOpenDraftBox: () => void
  externalDraftToLoad: DraftRecord | null
  onExternalDraftLoaded: () => void
}

interface MediaPreviewItem {
  url: string
  type: 'image' | 'video'
  name: string
  file: File
}

interface DraftAssetRecord {
  draftId: string
  mediaFiles: File[]
  audioFile: File | null
  updatedAt: string
}

export default function SendLetter({
  onLetterSent,
  onSaveDraft,
  onOpenDraftBox,
  externalDraftToLoad,
  onExternalDraftLoaded
}: SendLetterProps) {
  const [formData, setFormData] = useState({
    senderName: '',
    recipientName: '',
    letterContent: ''
  })
  const [delayDays, setDelayDays] = useState(5)
  const [delayHours, setDelayHours] = useState(0)
  const [delayMinutesPart, setDelayMinutesPart] = useState(0)
  const [editPassword, setEditPassword] = useState('')

  const [mediaPreviews, setMediaPreviews] = useState<MediaPreviewItem[]>([])
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
  const [stampTemplate, setStampTemplate] = useState<'classic' | 'star' | 'heart' | 'wave'>('classic')
  const [paperTheme, setPaperTheme] = useState<'classic' | 'warm' | 'mint' | 'lavender'>('classic')
  const [brushColor, setBrushColor] = useState('#1e3a8a')
  const [brushSize, setBrushSize] = useState(6)
  const [isEraserMode, setIsEraserMode] = useState(false)
  const [ambienceMusic, setAmbienceMusic] = useState(false)
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null)
  const [draggingMediaIndex, setDraggingMediaIndex] = useState<number | null>(null)

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
    const safeDays = Math.max(0, Math.min(30, Number.isFinite(delayDays) ? delayDays : 0))
    const safeHours = Math.max(0, Math.min(23, Number.isFinite(delayHours) ? delayHours : 0))
    const safeMinutes = Math.max(0, Math.min(59, Number.isFinite(delayMinutesPart) ? delayMinutesPart : 0))
    return Math.max(0, Math.min(safeDays * 24 * 60 + safeHours * 60 + safeMinutes, 30 * 24 * 60))
  }

  const getDelayLabel = () => {
    const total = getDelayMinutes()
    if (total === 0) return '立即可以看到'

    const days = Math.floor(total / (24 * 60))
    const hours = Math.floor((total % (24 * 60)) / 60)
    const minutes = total % 60
    const parts: string[] = []
    if (days > 0) parts.push(`${days} 天`)
    if (hours > 0) parts.push(`${hours} 小時`)
    if (minutes > 0) parts.push(`${minutes} 分鐘`)
    return `${parts.join(' ')}後解鎖`
  }

  const openDraftAssetDb = () => new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('瀏覽器不支援 IndexedDB'))
      return
    }

    const request = window.indexedDB.open(DRAFT_ASSET_DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(DRAFT_ASSET_STORE_NAME)) {
        db.createObjectStore(DRAFT_ASSET_STORE_NAME, { keyPath: 'draftId' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('開啟草稿附件資料庫失敗'))
  })

  const saveDraftAssets = async (draftId: string, mediaFiles: File[], draftAudioFile: File | null) => {
    const db = await openDraftAssetDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DRAFT_ASSET_STORE_NAME, 'readwrite')
      const store = tx.objectStore(DRAFT_ASSET_STORE_NAME)
      const payload: DraftAssetRecord = {
        draftId,
        mediaFiles,
        audioFile: draftAudioFile,
        updatedAt: new Date().toISOString()
      }
      store.put(payload)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error || new Error('保存草稿附件失敗'))
      tx.onabort = () => reject(tx.error || new Error('保存草稿附件被中止'))
    })
    db.close()
  }

  const getDraftAssets = async (draftId: string): Promise<DraftAssetRecord | null> => {
    const db = await openDraftAssetDb()
    const result = await new Promise<DraftAssetRecord | null>((resolve, reject) => {
      const tx = db.transaction(DRAFT_ASSET_STORE_NAME, 'readonly')
      const store = tx.objectStore(DRAFT_ASSET_STORE_NAME)
      const request = store.get(draftId)
      request.onsuccess = () => resolve((request.result as DraftAssetRecord | undefined) || null)
      request.onerror = () => reject(request.error || new Error('讀取草稿附件失敗'))
    })
    db.close()
    return result
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) {
      Array.from(files).forEach(file => {
        const previewUrl = URL.createObjectURL(file)
        const mediaType: 'image' | 'video' = file.type.startsWith('video/') ? 'video' : 'image'
        setMediaPreviews(prev => [...prev, {
          url: previewUrl,
          type: mediaType,
          name: file.name,
          file
        }])
      })
      e.target.value = ''
    }
  }

  const removeImage = (index: number) => {
    setMediaPreviews(prev => {
      const target = prev[index]
      if (target) {
        URL.revokeObjectURL(target.url)
      }
      return prev.filter((_, i) => i !== index)
    })
  }

  const moveMediaByDrag = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) {
      return
    }

    setMediaPreviews((prev) => {
      if (fromIndex >= prev.length || toIndex >= prev.length) {
        return prev
      }

      const next = [...prev]
      const [dragged] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, dragged)
      return next
    })
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

  const drawStampTemplate = (
    ctx: CanvasRenderingContext2D,
    template: 'classic' | 'star' | 'heart' | 'wave',
    width: number,
    height: number
  ) => {
    ctx.save()
    ctx.strokeStyle = '#f59e0b'
    ctx.fillStyle = '#f59e0b'
    ctx.globalAlpha = 0.35

    if (template === 'classic') {
      for (let x = 14; x < width; x += 20) {
        for (let y = 14; y < height; y += 20) {
          ctx.beginPath()
          ctx.arc(x, y, 1.5, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }

    if (template === 'star') {
      for (let x = 20; x < width; x += 42) {
        for (let y = 20; y < height; y += 42) {
          ctx.beginPath()
          ctx.moveTo(x, y - 6)
          ctx.lineTo(x + 2, y - 2)
          ctx.lineTo(x + 6, y - 1)
          ctx.lineTo(x + 3, y + 2)
          ctx.lineTo(x + 4, y + 6)
          ctx.lineTo(x, y + 4)
          ctx.lineTo(x - 4, y + 6)
          ctx.lineTo(x - 3, y + 2)
          ctx.lineTo(x - 6, y - 1)
          ctx.lineTo(x - 2, y - 2)
          ctx.closePath()
          ctx.fill()
        }
      }
    }

    if (template === 'heart') {
      for (let x = 18; x < width; x += 36) {
        for (let y = 20; y < height; y += 36) {
          ctx.beginPath()
          ctx.moveTo(x, y + 4)
          ctx.bezierCurveTo(x - 6, y - 2, x - 12, y + 3, x, y + 12)
          ctx.bezierCurveTo(x + 12, y + 3, x + 6, y - 2, x, y + 4)
          ctx.fill()
        }
      }
    }

    if (template === 'wave') {
      ctx.lineWidth = 1.5
      for (let y = 24; y < height; y += 26) {
        ctx.beginPath()
        for (let x = 8; x <= width - 8; x += 2) {
          const curveY = y + Math.sin((x / width) * Math.PI * 4) * 3
          if (x === 8) ctx.moveTo(x, curveY)
          else ctx.lineTo(x, curveY)
        }
        ctx.stroke()
      }
    }

    ctx.restore()
  }

  useEffect(() => {
    const rawDraft = localStorage.getItem(DRAFT_STORAGE_KEY)
    if (!rawDraft) {
      return
    }

    try {
      const draft = JSON.parse(rawDraft)
      if (draft.formData) {
        setFormData({
          senderName: draft.formData.senderName || '',
          recipientName: draft.formData.recipientName || '',
          letterContent: draft.formData.letterContent || ''
        })
      }
      if (Number.isFinite(draft.delayDays)) {
        setDelayDays(Math.max(0, Math.min(30, draft.delayDays)))
      }
      if (Number.isFinite(draft.delayHours)) {
        setDelayHours(Math.max(0, Math.min(23, draft.delayHours)))
      }
      if (Number.isFinite(draft.delayMinutesPart)) {
        setDelayMinutesPart(Math.max(0, Math.min(59, draft.delayMinutesPart)))
      }
      if (typeof draft.editPassword === 'string') {
        setEditPassword(draft.editPassword)
      }

      if (!Number.isFinite(draft.delayDays) && Number.isFinite(draft.delayValue)) {
        const legacyDelayValue = Math.max(0, Number.parseInt(String(draft.delayValue), 10) || 0)
        const legacyDelayUnit = ['immediate', 'day', 'hour', 'minute'].includes(draft.delayUnit) ? draft.delayUnit : 'day'
        if (legacyDelayUnit === 'immediate') {
          setDelayDays(0)
          setDelayHours(0)
          setDelayMinutesPart(0)
        }
        if (legacyDelayUnit === 'day') {
          setDelayDays(Math.max(0, Math.min(30, legacyDelayValue)))
          setDelayHours(0)
          setDelayMinutesPart(0)
        }
        if (legacyDelayUnit === 'hour') {
          setDelayDays(0)
          setDelayHours(Math.max(0, Math.min(23, legacyDelayValue)))
          setDelayMinutesPart(0)
        }
        if (legacyDelayUnit === 'minute') {
          setDelayDays(0)
          setDelayHours(0)
          setDelayMinutesPart(Math.max(0, Math.min(59, legacyDelayValue)))
        }
      }
      if (typeof draft.stampDataUrl === 'string') {
        setStampDataUrl(draft.stampDataUrl)
      }
      if (['classic', 'star', 'heart', 'wave'].includes(draft.stampTemplate)) {
        setStampTemplate(draft.stampTemplate)
      }
      if (['classic', 'warm', 'mint', 'lavender'].includes(draft.paperTheme)) {
        setPaperTheme(draft.paperTheme)
      }
      setAmbienceMusic(draft.ambienceMusic === true)
    } catch (draftError) {
      console.error('Failed to parse draft:', draftError)
    }
  }, [])

  useEffect(() => {
    if (shareLink) {
      return
    }

    const draftPayload = {
      formData,
      delayDays,
      delayHours,
      delayMinutesPart,
      editPassword,
      stampDataUrl,
      stampTemplate,
      paperTheme,
      ambienceMusic
    }

    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftPayload))
  }, [
    formData,
    delayDays,
    delayHours,
    delayMinutesPart,
    editPassword,
    stampDataUrl,
    stampTemplate,
    paperTheme,
    ambienceMusic,
    shareLink
  ])

  useEffect(() => {
    if (!externalDraftToLoad) {
      return
    }

    const restoreDraft = async () => {
      const payload = externalDraftToLoad.payload
      setFormData({
        senderName: payload.formData.senderName || '',
        recipientName: payload.formData.recipientName || '',
        letterContent: payload.formData.letterContent || ''
      })
      setDelayDays(Math.max(0, Math.min(30, payload.delayDays || 0)))
      setDelayHours(Math.max(0, Math.min(23, payload.delayHours || 0)))
      setDelayMinutesPart(Math.max(0, Math.min(59, payload.delayMinutesPart || 0)))
      setEditPassword(payload.editPassword || '')
      setStampDataUrl(payload.stampDataUrl || null)
      setStampTemplate(payload.stampTemplate)
      setPaperTheme(payload.paperTheme)
      setAmbienceMusic(payload.ambienceMusic === true)
      setEditingDraftId(externalDraftToLoad.id)
      setError(null)

      mediaPreviews.forEach((item) => URL.revokeObjectURL(item.url))
      setMediaPreviews([])
      setAudioFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      if (audioInputRef.current) audioInputRef.current.value = ''

      try {
        const assetRecord = await getDraftAssets(externalDraftToLoad.id)
        if (assetRecord) {
          const restoredMedia = (assetRecord.mediaFiles || []).map((storedFile) => {
            const file = storedFile
            return {
              url: URL.createObjectURL(file),
              type: file.type.startsWith('video/') ? 'video' as const : 'image' as const,
              name: file.name,
              file
            }
          })
          setMediaPreviews(restoredMedia)

          if (assetRecord.audioFile) {
            setAudioFile(assetRecord.audioFile)
          }
        }
      } catch (assetError) {
        console.error('Restore draft assets failed:', assetError)
      }

      onExternalDraftLoaded()
    }

    restoreDraft()
  }, [externalDraftToLoad, mediaPreviews, onExternalDraftLoaded])

  const handleSaveToDraftBox = async () => {
    const titleInput = window.prompt('草稿名稱（留空則自動命名）', `${formData.senderName || '未命名'}→${formData.recipientName || '未命名'}`)
    if (titleInput === null) {
      return
    }

    const password = window.prompt('請設定草稿查看密碼（至少 4 個字）')
    if (password === null) {
      return
    }

    const safePassword = password.trim()
    if (safePassword.length < 4) {
      setError('草稿密碼至少需要 4 個字')
      return
    }

    const now = new Date().toISOString()
    const draftRecord: DraftRecord = {
      id: editingDraftId || (crypto.randomUUID ? crypto.randomUUID() : `draft_${Date.now()}`),
      title: titleInput.trim() || `${formData.senderName || '未命名'}→${formData.recipientName || '未命名'}`,
      password: safePassword,
      createdAt: now,
      updatedAt: now,
      payload: {
        formData,
        delayDays,
        delayHours,
        delayMinutesPart,
        editPassword,
        stampDataUrl,
        stampTemplate,
        paperTheme,
        ambienceMusic
      }
    }

    try {
      await saveDraftAssets(
        draftRecord.id,
        mediaPreviews.map((item) => item.file),
        audioFile
      )
      onSaveDraft(draftRecord)
      setEditingDraftId(draftRecord.id)
      setError(null)
      window.alert('草稿已保存到草稿箱（含附件）')
    } catch (saveError) {
      console.error('Save draft assets failed:', saveError)
      setError('草稿已保存文字，但附件保存失敗，請稍後再試')
    }
  }

  const initializeStampCanvas = (
    withExistingStamp = true,
    template: 'classic' | 'star' | 'heart' | 'wave' = stampTemplate
  ) => {
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
    drawStampTemplate(ctx, template, canvas.width, canvas.height)

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

  const handleChangeTemplate = (template: 'classic' | 'star' | 'heart' | 'wave') => {
    setStampTemplate(template)
    requestAnimationFrame(() => initializeStampCanvas(false, template))
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

  const resetComposer = () => {
    setFormData({
      senderName: '',
      recipientName: '',
      letterContent: ''
    })
    setDelayDays(5)
    setDelayHours(0)
    setDelayMinutesPart(0)
    setEditPassword('')
    setPaperTheme('classic')
    setAmbienceMusic(false)
    mediaPreviews.forEach((item) => URL.revokeObjectURL(item.url))
    setMediaPreviews([])
    setAudioFile(null)
    setStampDataUrl(null)
    setStampTemplate('classic')
    setShowStampEditor(false)
    setBrushColor('#1e3a8a')
    setBrushSize(6)
    setIsEraserMode(false)
    setEditingDraftId(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (audioInputRef.current) audioInputRef.current.value = ''
    localStorage.removeItem(DRAFT_STORAGE_KEY)
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
          text: `${formData.recipientName}，這封信${getDelayMinutes() === 0 ? '已可查看' : `將在 ${getDelayLabel()}。`}`,
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
    if (!formData.senderName.trim() || !formData.recipientName.trim()) {
      setError('請填入你的名字和筆友的名字')
      setIsLoading(false)
      return
    }

    if (getDelayMinutes() > 0 && editPassword.trim().length < 4) {
      setError('寄送中修改密碼至少需要 4 個字')
      setIsLoading(false)
      return
    }

    try {
      const formDataToSend = new FormData()
      formDataToSend.append('senderName', formData.senderName)
      formDataToSend.append('recipientName', formData.recipientName)
      formDataToSend.append('letterContent', formData.letterContent)
      formDataToSend.append('delayMinutes', getDelayMinutes().toString())
      formDataToSend.append('delayDays', delayDays.toString())
      formDataToSend.append('delayHours', delayHours.toString())
      formDataToSend.append('delayMinutesPart', delayMinutesPart.toString())
      formDataToSend.append('editPassword', editPassword)
      formDataToSend.append('paperTheme', paperTheme)
      formDataToSend.append('ambienceMusic', ambienceMusic ? 'true' : 'false')
      
      mediaPreviews.forEach((item) => {
        formDataToSend.append('images', item.file)
      })

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
      localStorage.removeItem(DRAFT_STORAGE_KEY)
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
            {getDelayMinutes() === 0 ? '信件馬上就能查看' : '在這之前，你的筆友看到的會是模糊的信件 😉'}
          </p>
        </div>

        <button
          onClick={() => {
            setShareLink(null)
            resetComposer()
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
        <div className="flex justify-end gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleSaveToDraftBox}
            className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition"
          >
            💾 保存到草稿箱
          </button>
          <button
            type="button"
            onClick={onOpenDraftBox}
            className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-gray-700 hover:bg-gray-800 text-white transition"
          >
            🗂 打開草稿箱
          </button>
          <button
            type="button"
            onClick={resetComposer}
            className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-gray-200 hover:bg-gray-300 text-gray-800 transition"
          >
            🗑 清除草稿
          </button>
        </div>

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
            🔐 寄送中修改密碼（解鎖前可改內容/時間）
          </label>
          <input
            type="password"
            value={editPassword}
            onChange={(e) => setEditPassword(e.target.value)}
            placeholder="至少 4 個字"
            className="w-full px-4 py-2 border-2 border-indigo-300 rounded-lg focus:outline-none focus:border-indigo-600 bg-indigo-50"
          />
          <p className="text-xs text-gray-600 mt-2">
            若延遲時間大於 0，需設定此密碼才能在寄送中修改。
          </p>
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
            className="w-full px-4 py-2 border-2 border-indigo-300 rounded-lg focus:outline-none focus:border-indigo-600 bg-indigo-50 resize-none"
          />
        </div>

        <div className="bg-purple-50 p-4 rounded-lg border-2 border-purple-200">
          <label className="block text-sm font-semibold text-gray-700 mb-2">🧾 信紙主題</label>
          <select
            value={paperTheme}
            onChange={(e) => setPaperTheme(e.target.value as 'classic' | 'warm' | 'mint' | 'lavender')}
            className="px-4 py-2 border-2 border-purple-300 rounded-lg bg-white focus:outline-none focus:border-purple-600"
          >
            {PAPER_THEME_OPTIONS.map((themeOption) => (
              <option key={themeOption.value} value={themeOption.value}>{themeOption.label}</option>
            ))}
          </select>
          <p className="text-xs text-gray-600 mt-2">收信頁會用這個主題樣式展示正文</p>
        </div>

        <div className="bg-emerald-50 p-4 rounded-lg border-2 border-emerald-200">
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <input
              type="checkbox"
              checked={ambienceMusic}
              onChange={(e) => setAmbienceMusic(e.target.checked)}
            />
            🎵 解鎖後播放背景音樂
          </label>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            🖼️ 上傳信紙圖片/影片（可上傳多個）
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={handleImageChange}
            className="w-full px-4 py-2 border-2 border-dashed border-indigo-300 rounded-lg cursor-pointer"
          />
          {mediaPreviews.length > 0 && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
              {mediaPreviews.map((preview, index) => (
                <motion.div
                  key={preview.url}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`relative group cursor-move ${draggingMediaIndex === index ? 'opacity-70' : ''}`}
                  draggable
                  onDragStart={() => setDraggingMediaIndex(index)}
                  onDragEnd={() => setDraggingMediaIndex(null)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    if (draggingMediaIndex === null) return
                    moveMediaByDrag(draggingMediaIndex, index)
                    setDraggingMediaIndex(null)
                  }}
                >
                  {preview.type === 'image' ? (
                    <img
                      src={preview.url}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg"
                    />
                  ) : (
                    <video
                      src={preview.url}
                      className="w-full h-32 object-cover rounded-lg bg-black"
                      muted
                      controls
                    />
                  )}
                  <p className="text-[10px] text-gray-600 mt-1 truncate" title={preview.name}>{preview.name}</p>
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
            {mediaPreviews.length > 0 && `已上傳 ${mediaPreviews.length} 個媒體檔案`}
          </p>
          {mediaPreviews.length > 1 && (
            <p className="text-xs text-gray-500 mt-1">可直接拖動縮圖調整顯示與發送順序</p>
          )}
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
            <div className="flex flex-wrap gap-2">
              {STAMP_TEMPLATE_OPTIONS.map((templateOption) => (
                <button
                  key={templateOption.value}
                  type="button"
                  onClick={() => handleChangeTemplate(templateOption.value)}
                  className={`px-3 py-1.5 text-sm rounded-lg font-semibold transition ${
                    stampTemplate === templateOption.value
                      ? 'bg-amber-600 text-white'
                      : 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                  }`}
                >
                  {templateOption.label}
                </button>
              ))}
            </div>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">天（0-30）</label>
              <input
                type="number"
                min={0}
                max={30}
                value={delayDays}
                onChange={(e) => {
                  const value = Number.parseInt(e.target.value || '0', 10)
                  setDelayDays(Math.max(0, Math.min(30, Number.isFinite(value) ? value : 0)))
                }}
                className="w-full px-4 py-2 border-2 border-indigo-300 rounded-lg bg-white focus:outline-none focus:border-indigo-600"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">小時（0-23）</label>
              <input
                type="number"
                min={0}
                max={23}
                value={delayHours}
                onChange={(e) => {
                  const value = Number.parseInt(e.target.value || '0', 10)
                  setDelayHours(Math.max(0, Math.min(23, Number.isFinite(value) ? value : 0)))
                }}
                className="w-full px-4 py-2 border-2 border-indigo-300 rounded-lg bg-white focus:outline-none focus:border-indigo-600"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">分鐘（0-59）</label>
              <input
                type="number"
                min={0}
                max={59}
                value={delayMinutesPart}
                onChange={(e) => {
                  const value = Number.parseInt(e.target.value || '0', 10)
                  setDelayMinutesPart(Math.max(0, Math.min(59, Number.isFinite(value) ? value : 0)))
                }}
                className="w-full px-4 py-2 border-2 border-indigo-300 rounded-lg bg-white focus:outline-none focus:border-indigo-600"
              />
            </div>
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
