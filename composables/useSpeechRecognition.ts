// TypeScript declarations for Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionResultList {
  length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  isFinal: boolean
  length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
  message?: string
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition
    webkitSpeechRecognition?: new () => SpeechRecognition
  }
}

export interface UseSpeechRecognitionOptions {
  onTranscript: (text: string, isFinal: boolean) => void
  onError?: (error: string) => void
  lang?: string
}

export interface UseSpeechRecognitionReturn {
  isListening: Ref<boolean>
  isSupported: boolean
  error: Ref<string | null>
  startListening: () => void
  stopListening: () => void
  resetError: () => void
}

const errorMessages: Record<string, string> = {
  'not-allowed': '請允許麥克風權限以使用語音輸入',
  'no-speech': '沒有偵測到語音，請再試一次',
  'audio-capture': '無法存取麥克風',
  network: '網路錯誤，請檢查連線',
  aborted: '語音辨識被取消',
  'not-supported': '您的瀏覽器不支援語音輸入功能',
  'language-not-supported': '不支援此語言的語音辨識',
}

export function useSpeechRecognition({
  onTranscript,
  onError,
  lang = 'zh-TW',
}: UseSpeechRecognitionOptions): UseSpeechRecognitionReturn {
  const isListening = ref(false)
  const error = ref<string | null>(null)
  const recognitionRef = ref<SpeechRecognition | null>(null)
  const isStoppingRef = ref(false)

  // Check browser support
  const isSupported =
    typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition)

  function startListening() {
    if (!isSupported) {
      const errorMsg = errorMessages['not-supported']
      error.value = errorMsg
      onError?.(errorMsg)
      return
    }

    // Stop any existing recognition
    if (recognitionRef.value) {
      recognitionRef.value.abort()
    }

    const SpeechRecognitionClass =
      window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognitionClass) return

    const recognition = new SpeechRecognitionClass()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = lang

    recognition.onstart = () => {
      isListening.value = true
      error.value = null
      isStoppingRef.value = false
    }

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      // Get the latest result
      const lastResultIndex = event.results.length - 1
      const result = event.results[lastResultIndex]
      const transcript = result[0].transcript
      const isFinal = result.isFinal

      onTranscript(transcript, isFinal)
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // Don't report error if we're intentionally stopping
      if (isStoppingRef.value && event.error === 'aborted') {
        return
      }

      const errorMsg = errorMessages[event.error] || `語音辨識錯誤: ${event.error}`
      error.value = errorMsg
      onError?.(errorMsg)
      isListening.value = false
    }

    recognition.onend = () => {
      isListening.value = false
      recognitionRef.value = null
    }

    recognitionRef.value = recognition

    try {
      recognition.start()
    } catch (err) {
      const errorMsg = '無法啟動語音辨識'
      error.value = errorMsg
      onError?.(errorMsg)
    }
  }

  function stopListening() {
    isStoppingRef.value = true
    if (recognitionRef.value) {
      recognitionRef.value.stop()
      recognitionRef.value = null
    }
    isListening.value = false
  }

  function resetError() {
    error.value = null
  }

  // Cleanup on unmount
  onUnmounted(() => {
    if (recognitionRef.value) {
      recognitionRef.value.abort()
    }
  })

  return {
    isListening,
    isSupported,
    error,
    startListening,
    stopListening,
    resetError,
  }
}
