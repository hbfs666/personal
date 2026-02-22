export interface DraftPayload {
  formData: {
    senderName: string
    recipientName: string
    letterContent: string
  }
  delayUnit: 'immediate' | 'day' | 'hour' | 'minute'
  delayValue: number
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
