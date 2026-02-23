export interface DraftPayload {
  formData: {
    senderName: string
    recipientName: string
    letterContent: string
  }
  delayDays: number
  delayHours: number
  delayMinutesPart: number
  editPassword: string
  stampDataUrl: string | null
  stampTemplate: 'classic' | 'star' | 'heart' | 'wave'
  paperTheme: 'classic' | 'warm' | 'mint' | 'lavender'
  ambienceMusic: boolean
}

export interface DraftRecord {
  id: string
  title: string
  password: string
  createdAt: string
  updatedAt: string
  payload: DraftPayload
}
