import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { v4 as uuidv4 } from 'uuid'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { v2 as cloudinary } from 'cloudinary'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const distDir = path.join(__dirname, 'dist')
app.set('trust proxy', true)

const COUNTRY_CODE_TO_NAME = {
  CN: 'China',
  US: 'United States',
  CA: 'Canada',
  JP: 'Japan',
  KR: 'South Korea',
  TW: 'Taiwan',
  HK: 'Hong Kong',
  MO: 'Macao',
  SG: 'Singapore',
  MY: 'Malaysia',
  TH: 'Thailand',
  VN: 'Vietnam',
  PH: 'Philippines',
  ID: 'Indonesia',
  IN: 'India',
  AU: 'Australia',
  NZ: 'New Zealand',
  GB: 'United Kingdom',
  FR: 'France',
  DE: 'Germany',
  ES: 'Spain',
  IT: 'Italy',
  NL: 'Netherlands',
  RU: 'Russia',
  BR: 'Brazil',
  MX: 'Mexico',
  AR: 'Argentina',
  ZA: 'South Africa',
  TR: 'Turkey',
  SA: 'Saudi Arabia',
  AE: 'United Arab Emirates'
}

const hasSupabase = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
const hasCloudinary = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
)
const useCloudPersistence = hasSupabase && hasCloudinary

const requiredEnvKeys = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET'
]
const missingEnvKeys = requiredEnvKeys.filter((key) => !process.env[key])

const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : __dirname
const publicDir = path.join(__dirname, 'public')
const uploadsDir = path.join(dataDir, 'uploads')
const lettersFile = path.join(dataDir, 'letters.json')

const supabase = hasSupabase
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null

if (hasCloudinary) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  })
}

app.use(cors())
app.use(express.json())
app.use(express.static(publicDir))
app.use('/uploads', express.static(uploadsDir))
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir))
}

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true })
}

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

if (!fs.existsSync(lettersFile)) {
  fs.writeFileSync(lettersFile, JSON.stringify([]))
}

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

const storage = useCloudPersistence
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (req, file, cb) => {
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true })
        }
        cb(null, uploadsDir)
      },
      filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`)
      }
    })

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }
})

const getCountryFromHeaders = (req) => {
  const headerCandidates = [
    req.headers['cf-ipcountry'],
    req.headers['x-vercel-ip-country'],
    req.headers['x-country-code'],
    req.headers['fly-country'],
    req.headers['x-appengine-country']
  ]

  const countryCode = headerCandidates
    .map(value => (Array.isArray(value) ? value[0] : value))
    .find(value => typeof value === 'string' && value.trim().length > 0)

  if (!countryCode) {
    return null
  }

  const normalized = countryCode.trim().toUpperCase()
  if (normalized === 'XX' || normalized === 'T1') {
    return null
  }

  return COUNTRY_CODE_TO_NAME[normalized] || normalized
}

const getClientIp = (req) => {
  if (typeof req.ip === 'string' && req.ip.length > 0) {
    return req.ip
  }

  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim()
  }

  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].trim()
  }

  return req.socket?.remoteAddress || ''
}

const detectCountryFromIp = async (ip) => {
  if (!ip) {
    return null
  }

  const normalizedIp = ip.replace(/^::ffff:/, '')
  if (normalizedIp === '127.0.0.1' || normalizedIp === '::1') {
    return 'Local'
  }

  try {
    const response = await fetch(`https://ipwho.is/${encodeURIComponent(normalizedIp)}`)
    if (!response.ok) {
      return null
    }

    const data = await response.json()
    if (data?.success && data?.country) {
      return data.country
    }
  } catch (error) {
    console.error('Country detection failed:', error.message)
  }

  return null
}

const detectSenderCountry = async (req) => {
  const fromHeaders = getCountryFromHeaders(req)
  if (fromHeaders) {
    return fromHeaders
  }

  return detectCountryFromIp(getClientIp(req))
}

const getDelayMinutes = (letter) => {
  if (Number.isFinite(letter.delayMinutes)) {
    return letter.delayMinutes
  }
  return (letter.delayDays || 0) * 24 * 60
}

const MAX_DELAY_MINUTES = 30 * 24 * 60

const parseClampedInt = (value, fallback = 0) => {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

const clampDelayParts = ({ days = 0, hours = 0, minutes = 0 }) => {
  const safeDays = Math.max(0, Math.min(parseClampedInt(days, 0), 30))
  const safeHours = Math.max(0, Math.min(parseClampedInt(hours, 0), 23))
  const safeMinutes = Math.max(0, Math.min(parseClampedInt(minutes, 0), 59))
  return { safeDays, safeHours, safeMinutes }
}

const getTotalDelayMinutesFromParts = ({ days = 0, hours = 0, minutes = 0 }) => {
  const { safeDays, safeHours, safeMinutes } = clampDelayParts({ days, hours, minutes })
  const total = safeDays * 24 * 60 + safeHours * 60 + safeMinutes
  return Math.max(0, Math.min(total, MAX_DELAY_MINUTES))
}

const deriveDelayMinutesFromBody = (body) => {
  const parsedDelayMinutes = parseClampedInt(body.delayMinutes, Number.NaN)
  if (Number.isFinite(parsedDelayMinutes)) {
    return Math.max(0, Math.min(parsedDelayMinutes, MAX_DELAY_MINUTES))
  }

  const hasCompositeParts = body.delayDays !== undefined || body.delayHours !== undefined || body.delayMinutesPart !== undefined
  if (hasCompositeParts) {
    return getTotalDelayMinutesFromParts({
      days: body.delayDays,
      hours: body.delayHours,
      minutes: body.delayMinutesPart
    })
  }

  const fallbackDelayMinutes = parseClampedInt(body.delayDays, 0) * 24 * 60
  return Math.max(0, Math.min(fallbackDelayMinutes, MAX_DELAY_MINUTES))
}

const hashPassword = (plainText) => {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(plainText, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

const verifyPassword = (plainText, storedHash) => {
  if (typeof storedHash !== 'string' || !storedHash.includes(':')) {
    return false
  }

  const [salt, originalHashHex] = storedHash.split(':')
  if (!salt || !originalHashHex) {
    return false
  }

  const derivedHashHex = crypto.scryptSync(plainText, salt, 64).toString('hex')
  const originalBuffer = Buffer.from(originalHashHex, 'hex')
  const derivedBuffer = Buffer.from(derivedHashHex, 'hex')

  if (originalBuffer.length !== derivedBuffer.length) {
    return false
  }

  return crypto.timingSafeEqual(originalBuffer, derivedBuffer)
}

const mapDbLetter = (row) => ({
  id: row.id,
  senderName: row.sender_name,
  recipientName: row.recipient_name,
  senderCountry: row.sender_country || null,
  recipientEmail: row.recipient_email,
  letterContent: row.letter_content,
  delayMinutes: row.delay_minutes,
  delayDays: Math.floor((row.delay_minutes || 0) / (24 * 60)),
  imageUrls: row.image_urls || [],
  videoUrls: row.video_urls || [],
  audioUrl: row.audio_url || null,
  stampData: row.stamp_data || null,
  paperTheme: row.paper_theme || 'classic',
  ambienceMusic: row.ambience_music === true,
  stickers: row.stickers || [],
  holidayTheme: row.holiday_theme || 'none',
  scheduleTime: row.schedule_time,
  createdAt: row.created_at
})

const uploadToCloudinary = async (file, folder, resourceType) => {
  const dataUri = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`
  const result = await cloudinary.uploader.upload(dataUri, {
    folder,
    resource_type: resourceType
  })
  return result.secure_url
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const uploadWithRetry = async (file, folder, resourceType, label, maxRetries = 2) => {
  let lastError = null

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await uploadToCloudinary(file, folder, resourceType)
    } catch (error) {
      lastError = error
      const canRetry = attempt < maxRetries
      if (!canRetry) {
        break
      }
      const backoff = 600 * (attempt + 1)
      console.warn(`Cloud upload retry ${attempt + 1}/${maxRetries} for ${label}`)
      await wait(backoff)
    }
  }

  throw new Error(`${label} 上傳失敗: ${lastError?.message || 'unknown error'}`)
}

const uploadFilesSequentially = async (files, folder, resourceType, labelPrefix) => {
  const urls = []
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index]
    const label = `${labelPrefix}${index + 1}（${file.originalname || 'unnamed'}）`
    const url = await uploadWithRetry(file, folder, resourceType, label)
    urls.push(url)
  }
  return urls
}

const insertLetterWithColumnFallback = async (payload) => {
  const mutablePayload = { ...payload }

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const { error } = await supabase.from('letters').insert(mutablePayload)
    if (!error) {
      return
    }

    const message = error.message || ''
    const missingColumnMatch = message.match(/Could not find the '([^']+)' column/i)
    const missingColumn = missingColumnMatch?.[1]

    if (missingColumn && Object.prototype.hasOwnProperty.call(mutablePayload, missingColumn)) {
      console.warn(`Supabase column missing, dropping field and retrying insert: ${missingColumn}`)
      delete mutablePayload[missingColumn]
      continue
    }

    throw new Error(`資料庫寫入失敗: ${message}`)
  }

  throw new Error('資料庫寫入失敗: 欄位相容性重試超過上限')
}

const writeBufferFileToLocal = (file) => {
  const ext = path.extname(file.originalname || '') || ''
  const safeExt = ext.slice(0, 10)
  const filename = `${Date.now()}-${uuidv4()}${safeExt}`
  const fullPath = path.join(uploadsDir, filename)
  fs.writeFileSync(fullPath, file.buffer)
  return `/uploads/${filename}`
}

const persistLocalLetter = ({
  id,
  senderName,
  recipientName,
  senderCountry,
  recipientEmail,
  letterContent,
  safeDelayMinutes,
  imageFiles,
  videoFiles,
  audioFile,
  stampData,
  paperTheme,
  ambienceMusic,
  editPasswordHash,
  stickers,
  holidayTheme,
  scheduleTime,
  createdAt,
  filesAreInMemory
}) => {
  const letters = JSON.parse(fs.readFileSync(lettersFile, 'utf8'))

  const imageUrls = filesAreInMemory
    ? imageFiles.map(file => writeBufferFileToLocal(file))
    : imageFiles.map(file => `/uploads/${file.filename}`)

  const videoUrls = filesAreInMemory
    ? videoFiles.map(file => writeBufferFileToLocal(file))
    : videoFiles.map(file => `/uploads/${file.filename}`)

  const audioUrl = audioFile
    ? (filesAreInMemory ? writeBufferFileToLocal(audioFile) : `/uploads/${audioFile.filename}`)
    : null

  const newLetter = {
    id,
    senderName,
    recipientName,
    senderCountry: senderCountry || null,
    recipientEmail,
    letterContent,
    delayMinutes: safeDelayMinutes,
    delayDays: Math.floor(safeDelayMinutes / (24 * 60)),
    imageUrls,
    videoUrls,
    audioUrl,
    stampData: stampData || null,
    paperTheme: paperTheme || 'classic',
    ambienceMusic: ambienceMusic === true,
    editPasswordHash: editPasswordHash || null,
    stickers: Array.isArray(stickers) ? stickers : [],
    holidayTheme: holidayTheme || 'none',
    scheduleTime,
    createdAt
  }

  letters.push(newLetter)
  fs.writeFileSync(lettersFile, JSON.stringify(letters, null, 2))
  return newLetter
}

app.get('/api/letters', async (req, res) => {
  if (useCloudPersistence) {
    const { data, error } = await supabase
      .from('letters')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
      return res.json(data.map(mapDbLetter))
    }

    console.error('Cloud read failed in GET /api/letters:', error)
    return res.status(503).json({ message: '雲端資料庫讀取失敗，請稍後再試' })
  }

  const letters = JSON.parse(fs.readFileSync(lettersFile, 'utf8'))
  const sanitized = letters.map(({ editPasswordHash, ...rest }) => rest)
  res.json(sanitized)
})

app.get('/api/letters/:id', async (req, res) => {
  let letter

  if (useCloudPersistence) {
    const { data, error } = await supabase
      .from('letters')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle()

    if (error) {
      console.error('Cloud read failed in GET /api/letters/:id:', error)
      return res.status(503).json({ message: '雲端資料庫讀取失敗，請稍後再試' })
    }

    if (!data) {
      return res.status(404).json({ error: 'Letter not found' })
    }

    letter = mapDbLetter(data)
  } else {
    const letters = JSON.parse(fs.readFileSync(lettersFile, 'utf8'))
    letter = letters.find(l => l.id === req.params.id)
  }

  if (!letter) {
    return res.status(404).json({ error: 'Letter not found' })
  }

  const now = new Date().getTime()
  const delayMinutes = getDelayMinutes(letter)
  const revealTime = new Date(letter.scheduleTime).getTime() + (delayMinutes * 60 * 1000)
  const isRevealed = now >= revealTime

  const { editPasswordHash, ...safeLetter } = letter

  res.json({
    ...safeLetter,
    delayMinutes,
    isRevealed,
    timeLeft: Math.max(0, revealTime - now)
  })
})

app.put('/api/letters/:id/edit', async (req, res) => {
  const { password, letterContent, delayDays, delayHours, delayMinutesPart } = req.body || {}
  const safePassword = typeof password === 'string' ? password.trim() : ''
  const safeLetterContent = typeof letterContent === 'string' ? letterContent : ''
  const safeDelayMinutes = getTotalDelayMinutesFromParts({
    days: delayDays,
    hours: delayHours,
    minutes: delayMinutesPart
  })

  if (!safePassword) {
    return res.status(400).json({ message: '缺少修改密碼' })
  }

  let currentLetter = null

  if (useCloudPersistence) {
    const { data, error } = await supabase
      .from('letters')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle()

    if (error) {
      console.error('Cloud read failed in PUT /api/letters/:id/edit:', error)
      return res.status(503).json({ message: '雲端資料庫讀取失敗，請稍後再試' })
    }

    if (!data) {
      return res.status(404).json({ message: '信件不存在' })
    }

    currentLetter = data
  } else {
    const letters = JSON.parse(fs.readFileSync(lettersFile, 'utf8'))
    currentLetter = letters.find((item) => item.id === req.params.id)
  }

  if (!currentLetter) {
    return res.status(404).json({ message: '信件不存在' })
  }

  const existingDelayMinutes = Number.isFinite(currentLetter.delay_minutes)
    ? currentLetter.delay_minutes
    : (Number.isFinite(currentLetter.delayMinutes) ? currentLetter.delayMinutes : 0)
  const revealTime = new Date(currentLetter.schedule_time || currentLetter.scheduleTime).getTime() + (existingDelayMinutes * 60 * 1000)
  if (Date.now() >= revealTime) {
    return res.status(400).json({ message: '信件已解鎖，無法再修改' })
  }

  const storedHash = currentLetter.edit_password_hash || currentLetter.editPasswordHash
  if (!storedHash) {
    return res.status(400).json({ message: '此信件未設定寄送中修改密碼' })
  }

  const passwordValid = verifyPassword(safePassword, storedHash)
  if (!passwordValid) {
    return res.status(401).json({ message: '修改密碼錯誤' })
  }

  if (useCloudPersistence) {
    const { error } = await supabase
      .from('letters')
      .update({
        letter_content: safeLetterContent,
        delay_minutes: safeDelayMinutes
      })
      .eq('id', req.params.id)

    if (error) {
      console.error('Cloud update failed in PUT /api/letters/:id/edit:', error)
      return res.status(503).json({ message: `雲端更新失敗：${error.message || '請稍後再試'}` })
    }

    return res.json({
      id: req.params.id,
      delayMinutes: safeDelayMinutes,
      delayDays: Math.floor(safeDelayMinutes / (24 * 60)),
      letterContent: safeLetterContent,
      message: '寄送中修改成功'
    })
  }

  const letters = JSON.parse(fs.readFileSync(lettersFile, 'utf8'))
  const index = letters.findIndex((item) => item.id === req.params.id)
  if (index < 0) {
    return res.status(404).json({ message: '信件不存在' })
  }

  letters[index] = {
    ...letters[index],
    letterContent: safeLetterContent,
    delayMinutes: safeDelayMinutes,
    delayDays: Math.floor(safeDelayMinutes / (24 * 60))
  }
  fs.writeFileSync(lettersFile, JSON.stringify(letters, null, 2))

  return res.json({
    id: req.params.id,
    delayMinutes: safeDelayMinutes,
    delayDays: Math.floor(safeDelayMinutes / (24 * 60)),
    letterContent: safeLetterContent,
    message: '寄送中修改成功'
  })
})

app.get('/api/health', async (req, res) => {
  const basePayload = {
    ok: true,
    mode: useCloudPersistence ? 'cloud' : 'local',
    cloudReady: useCloudPersistence,
    hasSupabase,
    hasCloudinary,
    missingEnvKeys
  }

  if (!useCloudPersistence) {
    return res.json({
      ...basePayload,
      reason: missingEnvKeys.length > 0 ? 'missing_required_env_keys' : 'cloud_clients_not_initialized'
    })
  }

  try {
    const [dbCheck, cloudinaryCheck] = await Promise.all([
      supabase.from('letters').select('id').limit(1),
      cloudinary.api.ping()
    ])

    if (dbCheck.error) {
      throw new Error(`Supabase check failed: ${dbCheck.error.message}`)
    }

    return res.json({
      ...basePayload,
      supabase: { ok: true },
      cloudinary: { ok: true, status: cloudinaryCheck?.status || 'ok' }
    })
  } catch (error) {
    return res.status(500).json({
      ...basePayload,
      ok: false,
      cloudReady: false,
      message: error.message
    })
  }
})

app.post('/api/letters', (req, res) => {
  const uploadFields = upload.fields([
    { name: 'images', maxCount: 30 },
    { name: 'image', maxCount: 30 },
    { name: 'videos', maxCount: 30 },
    { name: 'video', maxCount: 30 },
    { name: 'audio', maxCount: 1 }
  ])

  uploadFields(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ message: `上傳錯誤: 檔案欄位不支援或單次上傳數量超過限制（目前最多 30 個圖片/影片）` })
      }
      return res.status(400).json({ message: `上傳錯誤: ${err.message}` })
    }
    if (err) {
      return res.status(400).json({ message: `檔案錯誤: ${err.message}` })
    }

    try {
      const fileGroups = req.files || {}
      const mediaFiles = [
        ...(fileGroups.images || []),
        ...(fileGroups.image || []),
        ...(fileGroups.videos || []),
        ...(fileGroups.video || [])
      ]
      const imageFiles = mediaFiles.filter((file) => file.mimetype?.startsWith('image/'))
      const videoFiles = mediaFiles.filter((file) => file.mimetype?.startsWith('video/'))
      const audioFile = fileGroups.audio?.[0] || null
      const {
        recipientEmail,
        letterContent,
        delayMinutes,
        delayDays,
        recipientName,
        senderName,
        stampData,
        paperTheme,
        ambienceMusic,
        editPassword,
        stickers,
        holidayTheme
      } = req.body

      const safeDelayMinutes = deriveDelayMinutesFromBody(req.body)
      const safeLetterContent = typeof letterContent === 'string' ? letterContent : ''
      const safeSenderName = typeof senderName === 'string' ? senderName.trim() : ''
      const safeRecipientName = typeof recipientName === 'string' ? recipientName.trim() : ''
      const safeEditPassword = typeof editPassword === 'string' ? editPassword.trim() : ''
      const safeEditPasswordHash = safeEditPassword.length >= 4 ? hashPassword(safeEditPassword) : null
      const safeAmbienceMusic = ambienceMusic === 'true'
      const safeHolidayTheme = ['none', 'christmas', 'birthday', 'newyear'].includes(holidayTheme) ? holidayTheme : 'none'

      let safeStickers = []
      try {
        const parsed = JSON.parse(stickers || '[]')
        if (Array.isArray(parsed)) {
          safeStickers = parsed.filter((item) => ['star', 'flower', 'postmark'].includes(item))
        }
      } catch {
        safeStickers = []
      }

      if (!safeSenderName || !safeRecipientName) {
        return res.status(400).json({ message: '缺少必填欄位' })
      }

      if (safeDelayMinutes > 0 && !safeEditPasswordHash) {
        return res.status(400).json({ message: '請設定寄送中修改密碼（至少 4 個字）' })
      }

      const id = uuidv4()
      const scheduleTime = new Date().toISOString()
      const createdAt = new Date().toISOString()
      const senderCountry = await detectSenderCountry(req)

      if (useCloudPersistence) {
        try {
          const imageUrls = await uploadFilesSequentially(
            imageFiles,
            'letters/images',
            'image',
            '圖片'
          )

          const videoUrls = await uploadFilesSequentially(
            videoFiles,
            'letters/videos',
            'video',
            '影片'
          )

          let audioUrl = null
          if (audioFile) {
            audioUrl = await uploadWithRetry(
              audioFile,
              'letters/audio',
              'video',
              `音訊（${audioFile.originalname || 'unnamed'}）`
            )
          }

          const insertPayload = {
            id,
            sender_name: safeSenderName,
            sender_country: senderCountry,
            recipient_name: safeRecipientName,
            recipient_email: recipientEmail || null,
            letter_content: safeLetterContent,
            delay_minutes: safeDelayMinutes,
            image_urls: imageUrls,
            video_urls: videoUrls,
            audio_url: audioUrl,
            stamp_data: stampData || null,
            paper_theme: paperTheme || 'classic',
            ambience_music: safeAmbienceMusic,
            edit_password_hash: safeEditPasswordHash,
            stickers: safeStickers,
            holiday_theme: safeHolidayTheme,
            schedule_time: scheduleTime,
            created_at: createdAt
          }

          await insertLetterWithColumnFallback(insertPayload)

          return res.json({
            id,
            senderName: safeSenderName,
            recipientName: safeRecipientName,
            senderCountry,
            recipientEmail,
            letterContent: safeLetterContent,
            delayMinutes: safeDelayMinutes,
            delayDays: Math.floor(safeDelayMinutes / (24 * 60)),
            imageUrls,
            videoUrls,
            audioUrl,
            stampData: stampData || null,
            paperTheme: paperTheme || 'classic',
            ambienceMusic: safeAmbienceMusic,
            stickers: safeStickers,
            holidayTheme: safeHolidayTheme,
            scheduleTime,
            createdAt
          })
        } catch (cloudError) {
          console.error('Cloud persistence failed in POST /api/letters:', cloudError)
          return res.status(503).json({
            message: `雲端儲存失敗，信件未建立。${cloudError?.message || '請稍後再試。'}`
          })
        }
      }

      const localLetter = persistLocalLetter({
        id,
        senderName: safeSenderName,
        recipientName: safeRecipientName,
        senderCountry,
        recipientEmail,
        letterContent: safeLetterContent,
        safeDelayMinutes,
        imageFiles,
        videoFiles,
        audioFile,
        stampData,
        paperTheme,
        ambienceMusic: safeAmbienceMusic,
        editPasswordHash: safeEditPasswordHash,
        stickers: safeStickers,
        holidayTheme: safeHolidayTheme,
        scheduleTime,
        createdAt,
        filesAreInMemory: false
      })
      res.json(localLetter)
    } catch (error) {
      res.status(500).json({ message: `伺服器錯誤: ${error.message}` })
    }
  })
})

if (fs.existsSync(distDir)) {
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(distDir, 'index.html'))
  })
}

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  if (useCloudPersistence) {
    console.log('Using Supabase + Cloudinary persistence')
  } else {
    console.log('Using local file persistence')
  }
})
