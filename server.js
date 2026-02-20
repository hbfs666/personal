import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { v4 as uuidv4 } from 'uuid'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import { v2 as cloudinary } from 'cloudinary'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const distDir = path.join(__dirname, 'dist')

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

const getDelayMinutes = (letter) => {
  if (Number.isFinite(letter.delayMinutes)) {
    return letter.delayMinutes
  }
  return (letter.delayDays || 0) * 24 * 60
}

const mapDbLetter = (row) => ({
  id: row.id,
  senderName: row.sender_name,
  recipientName: row.recipient_name,
  recipientEmail: row.recipient_email,
  letterContent: row.letter_content,
  delayMinutes: row.delay_minutes,
  delayDays: Math.floor((row.delay_minutes || 0) / (24 * 60)),
  imageUrls: row.image_urls || [],
  audioUrl: row.audio_url || null,
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
  recipientEmail,
  letterContent,
  safeDelayMinutes,
  imageFiles,
  audioFile,
  scheduleTime,
  createdAt,
  filesAreInMemory
}) => {
  const letters = JSON.parse(fs.readFileSync(lettersFile, 'utf8'))

  const imageUrls = filesAreInMemory
    ? imageFiles.map(file => writeBufferFileToLocal(file))
    : imageFiles.map(file => `/uploads/${file.filename}`)

  const audioUrl = audioFile
    ? (filesAreInMemory ? writeBufferFileToLocal(audioFile) : `/uploads/${audioFile.filename}`)
    : null

  const newLetter = {
    id,
    senderName,
    recipientName,
    recipientEmail,
    letterContent,
    delayMinutes: safeDelayMinutes,
    delayDays: Math.floor(safeDelayMinutes / (24 * 60)),
    imageUrls,
    audioUrl,
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

    console.error('Cloud read failed in GET /api/letters, fallback to local:', error)

    const fallbackLetters = JSON.parse(fs.readFileSync(lettersFile, 'utf8'))
    return res.json(fallbackLetters)
  }

  const letters = JSON.parse(fs.readFileSync(lettersFile, 'utf8'))
  res.json(letters)
})

app.get('/api/letters/:id', async (req, res) => {
  let letter

  if (useCloudPersistence) {
    const { data, error } = await supabase
      .from('letters')
      .select('*')
      .eq('id', req.params.id)
      .single()

    if (!error && data) {
      letter = mapDbLetter(data)
    } else {
      console.error('Cloud read failed in GET /api/letters/:id, fallback to local:', error)
      const letters = JSON.parse(fs.readFileSync(lettersFile, 'utf8'))
      letter = letters.find(l => l.id === req.params.id)
    }
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

  res.json({
    ...letter,
    delayMinutes,
    isRevealed,
    timeLeft: Math.max(0, revealTime - now)
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
    { name: 'images', maxCount: 10 },
    { name: 'audio', maxCount: 1 }
  ])

  uploadFields(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ message: `上傳錯誤: ${err.message}` })
    }
    if (err) {
      return res.status(400).json({ message: `檔案錯誤: ${err.message}` })
    }

    try {
      const fileGroups = req.files || {}
      const imageFiles = fileGroups.images || []
      const audioFile = fileGroups.audio?.[0] || null
      const { recipientEmail, letterContent, delayMinutes, delayDays, recipientName, senderName } = req.body

      const parsedDelayMinutes = Number.parseInt(delayMinutes, 10)
      const fallbackDelayMinutes = Number.parseInt(delayDays, 10) * 24 * 60
      const normalizedDelayMinutes = Number.isFinite(parsedDelayMinutes)
        ? parsedDelayMinutes
        : (Number.isFinite(fallbackDelayMinutes) ? fallbackDelayMinutes : 0)
      const safeDelayMinutes = Math.max(0, Math.min(normalizedDelayMinutes, 30 * 24 * 60))

      if (!senderName || !letterContent) {
        return res.status(400).json({ message: '缺少必填欄位' })
      }

      const id = uuidv4()
      const scheduleTime = new Date().toISOString()
      const createdAt = new Date().toISOString()

      if (useCloudPersistence) {
        try {
          const imageUrls = await Promise.all(
            imageFiles.map(file => uploadToCloudinary(file, 'letters/images', 'image'))
          )

          let audioUrl = null
          if (audioFile) {
            audioUrl = await uploadToCloudinary(audioFile, 'letters/audio', 'video')
          }

          const insertPayload = {
            id,
            sender_name: senderName,
            recipient_name: recipientName,
            recipient_email: recipientEmail || null,
            letter_content: letterContent,
            delay_minutes: safeDelayMinutes,
            image_urls: imageUrls,
            audio_url: audioUrl,
            schedule_time: scheduleTime,
            created_at: createdAt
          }

          const { error } = await supabase.from('letters').insert(insertPayload)
          if (error) {
            throw new Error(`資料庫寫入失敗: ${error.message}`)
          }

          return res.json({
            id,
            senderName,
            recipientName,
            recipientEmail,
            letterContent,
            delayMinutes: safeDelayMinutes,
            delayDays: Math.floor(safeDelayMinutes / (24 * 60)),
            imageUrls,
            audioUrl,
            scheduleTime,
            createdAt
          })
        } catch (cloudError) {
          console.error('Cloud persistence failed, fallback to local:', cloudError)
          const localLetter = persistLocalLetter({
            id,
            senderName,
            recipientName,
            recipientEmail,
            letterContent,
            safeDelayMinutes,
            imageFiles,
            audioFile,
            scheduleTime,
            createdAt,
            filesAreInMemory: true
          })
          return res.json(localLetter)
        }
      }

      const localLetter = persistLocalLetter({
        id,
        senderName,
        recipientName,
        recipientEmail,
        letterContent,
        safeDelayMinutes,
        imageFiles,
        audioFile,
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
