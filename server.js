import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { v4 as uuidv4 } from 'uuid'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()

app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

// Ensure public directory exists
const publicDir = path.join(__dirname, 'public')
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true })
}

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = path.join(__dirname, 'public', 'uploads')
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
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
})

// Data file path
const lettersFile = path.join(__dirname, 'letters.json')

// Initialize letters file
if (!fs.existsSync(lettersFile)) {
  fs.writeFileSync(lettersFile, JSON.stringify([]))
}

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'public', 'uploads')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

// Get all letters
app.get('/api/letters', (req, res) => {
  const letters = JSON.parse(fs.readFileSync(lettersFile, 'utf8'))
  res.json(letters)
})

// Get letter by ID
app.get('/api/letters/:id', (req, res) => {
  const letters = JSON.parse(fs.readFileSync(lettersFile, 'utf8'))
  const letter = letters.find(l => l.id === req.params.id)
  
  if (!letter) {
    return res.status(404).json({ error: 'Letter not found' })
  }

  // Check if it's time to reveal
  const now = new Date().getTime()
  const delayMinutes = Number.isFinite(letter.delayMinutes)
    ? letter.delayMinutes
    : ((letter.delayDays || 0) * 24 * 60)
  const revealTime = new Date(letter.scheduleTime).getTime() + (delayMinutes * 60 * 1000)
  const isRevealed = now >= revealTime

  res.json({
    ...letter,
    delayMinutes,
    isRevealed,
    timeLeft: Math.max(0, revealTime - now)
  })
})

// Create a new letter
app.post('/api/letters', (req, res) => {
  // Use upload middleware with error handling
  upload.array('images', 10)(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      console.error('Multer error:', err)
      return res.status(400).json({ message: `上傳錯誤: ${err.message}` })
    } else if (err) {
      console.error('Upload error:', err)
      return res.status(400).json({ message: `檔案錯誤: ${err.message}` })
    }

    try {
      console.log('Request body:', req.body)
      console.log('Uploaded files:', req.files)
      
      const { recipientEmail, letterContent, delayMinutes, delayDays, recipientName, senderName } = req.body

      const parsedDelayMinutes = Number.parseInt(delayMinutes, 10)
      const fallbackDelayMinutes = Number.parseInt(delayDays, 10) * 24 * 60
      const normalizedDelayMinutes = Number.isFinite(parsedDelayMinutes)
        ? parsedDelayMinutes
        : (Number.isFinite(fallbackDelayMinutes) ? fallbackDelayMinutes : 0)
      const safeDelayMinutes = Math.max(0, Math.min(normalizedDelayMinutes, 30 * 24 * 60))
      
      console.log('Reading letters file from:', lettersFile)
      const lettersContent = fs.readFileSync(lettersFile, 'utf8')
      const letters = JSON.parse(lettersContent)
      
      const newLetter = {
        id: uuidv4(),
        senderName,
        recipientName,
        recipientEmail,
        letterContent,
        delayMinutes: safeDelayMinutes,
        delayDays: Math.floor(safeDelayMinutes / (24 * 60)),
        imageUrls: req.files ? req.files.map(file => `/uploads/${file.filename}`) : [],
        scheduleTime: new Date().toISOString(),
        createdAt: new Date().toISOString()
      }
      
      letters.push(newLetter)
      console.log('Writing to letters file...')
      fs.writeFileSync(lettersFile, JSON.stringify(letters, null, 2))
      console.log('Successfully saved letter:', newLetter.id)
      
      res.json(newLetter)
    } catch (error) {
      console.error('Error in POST /api/letters:', error)
      res.status(500).json({ message: `伺服器錯誤: ${error.message}` })
    }
  })
})

const PORT = 3001
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
