import { useState } from 'react'
import LetterSetup from './LetterSetup'
import TrackingView from './TrackingView'

interface LetterData {
  senderName: string
  senderCity: string
  recipientName: string
  recipientCity: string
  scheduledTime: string
  estimatedDays: number
  letterContent: string
}

interface Props {
  isTracking: boolean
  letterData: LetterData
  onStart: (data: LetterData) => void
  onBack: () => void
}

export default function LetterTracker({
  isTracking,
  letterData,
  onStart,
  onBack
}: Props) {
  return (
    <>
      {!isTracking ? (
        <LetterSetup onStart={onStart} />
      ) : (
        <TrackingView letterData={letterData} onBack={onBack} />
      )}
    </>
  )
}
