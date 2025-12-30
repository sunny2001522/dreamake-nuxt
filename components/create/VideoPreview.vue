<script setup lang="ts">
import { Play, Pause, RotateCcw, Download, Loader2, VolumeX, Mic, Type, Video, Check, Lightbulb } from 'lucide-vue-next'

const generationStore = useGenerationStore()
const { stage, isGenerating } = storeToRefs(generationStore)
const toastStore = useToastStore()
const { draft, generatedResult, subtitleSegments, hasTimestamps, isLoadingSubtitles, isLoadingFromHistory } = storeToRefs(generationStore)

// FFmpeg for subtitle burning
const ffmpeg = useFFmpeg()

const aspectRatioClass = computed(() => {
  return draft.value.aspectRatio === 'portrait' ? 'aspect-[9/16]' : 'aspect-video'
})

// 標題拖曳 - 無限制
const titleDrag = useVerticalDrag({
  initialY: draft.value.titleY,
})

// 字幕拖曳 - 無限制
const subtitleDrag = useVerticalDrag({
  initialY: draft.value.subtitleY,
})

// 同步拖曳位置到 store
watch(
  () => titleDrag.y.value,
  (newY) => {
    generationStore.updateDraft({ titleY: newY })
  }
)

watch(
  () => subtitleDrag.y.value,
  (newY) => {
    generationStore.updateDraft({ subtitleY: newY })
  }
)

// 字體樣式對應
const fontClass = computed(() => {
  return draft.value.subtitleFont === 'ming' ? 'font-serif' : 'font-sans'
})

// 標題背景樣式
const titleBackgroundClass = computed(() => {
  switch (draft.value.subtitleBackground) {
    case 'black':
      return 'bg-stone-800/50 px-3 py-1'
    case 'white':
      return 'bg-white/70 px-3 py-1 text-black'
    default:
      return ''
  }
})

// 標題文字樣式
const titleTextClass = computed(() => {
  if (draft.value.subtitleBackground === 'white') {
    return 'text-black'
  }
  return 'text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]'
})

// ============================================
// Dynamic Font Sizing (參考原專案)
// ============================================
const previewContainerRef = ref<HTMLElement | null>(null)
const previewWidth = ref(0)

function updatePreviewWidth() {
  if (previewContainerRef.value) {
    previewWidth.value = previewContainerRef.value.getBoundingClientRect().width
  }
}

// 字幕字體大小（15 字占 80% 寬度，桌面最小 20px，手機最小 16px）
const scaledSubtitleFontSize = computed(() => {
  if (previewWidth.value === 0) return 16
  const isMobile = window.innerWidth < 1024
  const divisor = isMobile ? 18 : 15
  const minSize = isMobile ? 16 : 20
  return Math.max(Math.round((previewWidth.value * 0.8) / divisor), minSize)
})

// 標題字體大小（12 字占 80% 寬度，桌面最小 24px，手機最小 14px）
const scaledTitleFontSize = computed(() => {
  if (previewWidth.value === 0) return 14
  const isMobile = window.innerWidth < 1024
  const divisor = isMobile ? 25 : 12
  const minSize = isMobile ? 14 : 24
  return Math.max(Math.round((previewWidth.value * 0.8) / divisor), minSize)
})

// ============================================
// Video/Audio Playback Control
// ============================================
const videoRef = ref<HTMLVideoElement | null>(null)
const audioRef = ref<HTMLAudioElement | null>(null)
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const isMounted = ref(false)

onMounted(() => {
  isMounted.value = true
  updatePreviewWidth()
  window.addEventListener('resize', updatePreviewWidth)
})

onUnmounted(() => {
  window.removeEventListener('resize', updatePreviewWidth)
})

// ============================================
// Auto-play when history item is selected
// ============================================
const isMuted = ref(false)

// Try to play, fallback to muted if blocked
async function tryAutoPlay(media: HTMLMediaElement) {
  try {
    await media.play()
  } catch (err) {
    // Autoplay blocked, try muted
    console.warn('Autoplay blocked, trying muted:', err)
    media.muted = true
    isMuted.value = true
    try {
      await media.play()
    } catch (mutedErr) {
      console.warn('Even muted autoplay failed:', mutedErr)
    }
  }
}

// Click to unmute
function handleUnmute() {
  const media = hasVideo.value ? videoRef.value : audioRef.value
  if (media && isMuted.value) {
    media.muted = false
    isMuted.value = false
  }
}

// Track if we should auto-play after loading
const shouldAutoPlayAfterLoad = ref(false)

// Track pending auto-play (waiting for Whisper to complete)
const pendingAutoPlay = ref<HTMLMediaElement | null>(null)

// 簡易文字分段（跳過 Whisper 時使用）
function simpleTextSegmentation(transcript: string) {
  if (!transcript.trim()) return []

  // 按標點符號分段
  const punctuationPattern = /[，。！？、；：,\.!?\n]+/g
  const segments = transcript
    .split(punctuationPattern)
    .map(s => s.replace(/[，。！？、；：,\.!?\-—\[\]【】「」『』：""''\s]+/g, '').trim())
    .filter(s => s.length > 0)

  return segments.map(text => ({
    text,
    startTime: -1,
    endTime: -1,
  }))
}

// 跳過 Whisper，使用快速字幕
function skipWhisperAndUseQuickSubtitles() {
  if (!generatedResult.value?.transcript) return

  const quickSegments = simpleTextSegmentation(generatedResult.value.transcript)
  generationStore.setSubtitleSegments(quickSegments, false)
  generationStore.setLoadingSubtitles(false)

  console.log('Skipped Whisper, using quick subtitles:', quickSegments.length)

  // 如果有待播放的媒體，立即播放
  if (pendingAutoPlay.value) {
    tryAutoPlay(pendingAutoPlay.value)
    pendingAutoPlay.value = null
  }
}

// 30 秒後顯示超時提示
const showTimeoutHint = ref(false)
let subtitleTimeoutId: ReturnType<typeof setTimeout> | null = null

// When subtitles finish loading (Whisper complete), trigger pending auto-play
watch(
  () => isLoadingSubtitles.value,
  async (loading) => {
    if (loading) {
      // 開始計時，30 秒後顯示超時提示
      showTimeoutHint.value = false
      subtitleTimeoutId = setTimeout(() => {
        showTimeoutHint.value = true
      }, 30000)
    } else {
      // 清除計時器
      if (subtitleTimeoutId) {
        clearTimeout(subtitleTimeoutId)
        subtitleTimeoutId = null
      }
      showTimeoutHint.value = false

      if (pendingAutoPlay.value) {
        console.log('Whisper complete, starting auto-play')
        await nextTick()
        await tryAutoPlay(pendingAutoPlay.value)
        pendingAutoPlay.value = null
      }
    }
  }
)

// Watch for new media - prepare for auto-play but don't play yet if loading from history
watch(
  () => generatedResult.value,
  async (newResult, oldResult) => {
    const newMediaUrl = newResult?.videoUrl || newResult?.audioUrl
    const oldMediaUrl = oldResult?.videoUrl || oldResult?.audioUrl

    if (newMediaUrl && newMediaUrl !== oldMediaUrl) {
      await nextTick()

      const media = newResult?.videoUrl ? videoRef.value : audioRef.value

      if (media) {
        // Reset state
        currentTime.value = 0
        isMuted.value = false
        media.muted = false

        // 如果正在從歷史載入，等待 loading 消失後再播放
        if (isLoadingFromHistory.value) {
          shouldAutoPlayAfterLoad.value = true
        } else {
          // 不是從歷史載入，直接播放
          const playWhenReady = async () => {
            await tryAutoPlay(media)
            media.removeEventListener('canplay', playWhenReady)
          }

          if (media.readyState >= 3) {
            await tryAutoPlay(media)
          } else {
            media.addEventListener('canplay', playWhenReady)
          }
        }
      }
    }
  }
)

// Get current subtitle segment based on playback progress
const currentSubtitle = computed(() => {
  if (subtitleSegments.value.length === 0 || duration.value === 0) return ''

  // If we have timestamps from audio analysis, use them for accurate sync
  if (hasTimestamps.value) {
    const segment = subtitleSegments.value.find(
      (seg) => currentTime.value >= seg.startTime && currentTime.value < seg.endTime
    )
    return segment?.text || ''
  }

  // Fallback: distribute segments by character count (longer text = more time)
  const totalChars = subtitleSegments.value.reduce((sum, seg) => sum + seg.text.length, 0)
  if (totalChars === 0) return ''

  let accumulatedChars = 0
  for (const segment of subtitleSegments.value) {
    const segmentStart = (accumulatedChars / totalChars) * duration.value
    const segmentEnd = ((accumulatedChars + segment.text.length) / totalChars) * duration.value

    if (currentTime.value >= segmentStart && currentTime.value < segmentEnd) {
      return segment.text
    }
    accumulatedChars += segment.text.length
  }

  // Return last segment if we're past all calculated times
  return subtitleSegments.value[subtitleSegments.value.length - 1]?.text || ''
})

// Determine if we should show video or audio-only playback
const hasVideo = computed(() => !!generatedResult.value?.videoUrl)
const hasAudio = computed(() => !!generatedResult.value?.audioUrl)
const hasMediaResult = computed(() => hasVideo.value || hasAudio.value)

// Toggle play/pause
function togglePlay() {
  const media = hasVideo.value ? videoRef.value : audioRef.value
  if (!media) return

  // Check if playback ended, restart from beginning
  if (currentTime.value >= duration.value && duration.value > 0) {
    media.currentTime = 0
    currentTime.value = 0
  }

  if (isPlaying.value) {
    media.pause()
  } else {
    media.play()
  }
}

// Handle seek bar change
function handleSeek(event: Event) {
  const target = event.target as HTMLInputElement
  const newTime = parseFloat(target.value)
  const media = hasVideo.value ? videoRef.value : audioRef.value
  if (media) {
    media.currentTime = newTime
    currentTime.value = newTime
  }
}

// Media event handlers
async function onLoadedMetadata(event: Event) {
  const media = event.target as HTMLMediaElement
  duration.value = media.duration

  // 媒體載入完成，清除歷史載入狀態
  if (isLoadingFromHistory.value) {
    generationStore.clearHistoryLoading()

    // 如果需要在 loading 消失後自動播放
    if (shouldAutoPlayAfterLoad.value) {
      shouldAutoPlayAfterLoad.value = false

      // 等待字幕載入完成（Whisper）後才播放
      // 這樣才能確保字幕時間戳準確
      if (isLoadingSubtitles.value) {
        console.log('Media ready, waiting for Whisper to complete before auto-play')
        pendingAutoPlay.value = media
      } else {
        // 字幕已經載入完成，直接播放
        await nextTick()
        await tryAutoPlay(media)
      }
    }
  }
}

function onTimeUpdate(event: Event) {
  const media = event.target as HTMLMediaElement
  currentTime.value = media.currentTime
}

function onPlay() {
  isPlaying.value = true
}

function onPause() {
  isPlaying.value = false
}

function onEnded() {
  isPlaying.value = false
}

// Format time display
function formatTime(seconds: number): string {
  return `${seconds.toFixed(1)}s`
}

// ============================================
// Download with Subtitle Burning
// ============================================
const isDownloading = ref(false)

async function handleDownload() {
  if (!generatedResult.value) return

  const mediaUrl = generatedResult.value.videoUrl || generatedResult.value.audioUrl
  if (!mediaUrl) return

  const isVideo = !!generatedResult.value.videoUrl
  const shouldBurnSubtitles = isVideo && draft.value.subtitleEnabled && subtitleSegments.value.length > 0

  if (shouldBurnSubtitles) {
    await downloadWithSubtitles(mediaUrl)
  } else {
    await directDownload(mediaUrl, isVideo)
  }
}

// Direct download without subtitle burning
// 使用伺服器端代理繞過 CORS 限制
async function directDownload(url: string, isVideo: boolean) {
  try {
    isDownloading.value = true

    // 使用 /api/proxy-download 代理下載，避免 R2 等外部存儲的 CORS 問題
    const response = await fetch('/api/proxy-download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })

    if (!response.ok) {
      throw new Error(`Proxy download failed: ${response.status}`)
    }

    const blob = await response.blob()
    const extension = isVideo ? 'mp4' : 'mp3'
    const filename = `dreammake-${Date.now()}.${extension}`

    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(a.href)

    toastStore.success('下載完成')
  } catch (err) {
    console.error('Download failed:', err)
    toastStore.error('下載失敗')
  } finally {
    isDownloading.value = false
  }
}

// Download with subtitle burning
async function downloadWithSubtitles(videoUrl: string) {
  try {
    isDownloading.value = true
    toastStore.info('燒錄字幕中...')

    // Get video dimensions based on aspect ratio
    const isPortrait = draft.value.aspectRatio === 'portrait'
    const videoWidth = isPortrait ? 1080 : 1920
    const videoHeight = isPortrait ? 1920 : 1080

    const blob = await ffmpeg.burnSubtitles({
      videoUrl,
      segments: subtitleSegments.value,
      font: draft.value.subtitleFont,
      titleBackground: draft.value.subtitleBackground,
      subtitleY: subtitleDrag.y.value,
      videoWidth,
      videoHeight,
      title: draft.value.subtitleEnabled && draft.value.title ? draft.value.title : undefined,
      titleY: titleDrag.y.value,
    })

    if (blob) {
      const filename = `dreammake-${Date.now()}.mp4`
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(a.href)

      toastStore.success('已下載帶字幕的影片')
    } else {
      throw new Error('字幕燒錄失敗')
    }
  } catch (err) {
    console.error('Subtitle burning failed:', err)
    toastStore.error('字幕燒錄失敗，嘗試下載無字幕版本...')

    // Fallback to direct download
    await directDownload(videoUrl, true)
  } finally {
    isDownloading.value = false
  }
}

// ============================================
// Generation Progress Overlay
// ============================================
const encouragingMessages = [
  'AI 正在努力搬磚中...',
  '去泡杯咖啡吧！',
  '好東西值得等待...',
  '正在施展魔法 ✨',
  '快好了，再等一下下...',
  '您的創意即將成真...',
  '深呼吸，放輕鬆...',
]

const currentMessageIndex = ref(0)
const currentMessage = computed(() => encouragingMessages[currentMessageIndex.value])

// 文字輪播計時器
let messageTimer: ReturnType<typeof setInterval> | null = null

watch(isGenerating, (generating) => {
  if (generating) {
    currentMessageIndex.value = 0
    messageTimer = setInterval(() => {
      currentMessageIndex.value = (currentMessageIndex.value + 1) % encouragingMessages.length
    }, 6000)
  } else {
    if (messageTimer) {
      clearInterval(messageTimer)
      messageTimer = null
    }
    currentMessageIndex.value = 0
  }
}, { immediate: true })

onUnmounted(() => {
  if (messageTimer) {
    clearInterval(messageTimer)
  }
})

// 階段索引計算
const progressStageIndex = computed(() => {
  const stageMap: Record<string, number> = { voice: 0, subtitle: 1, video: 2 }
  return stageMap[stage.value] ?? -1
})

// 節點樣式
function getNodeClass(index: number) {
  const base = 'w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300'
  if (index < progressStageIndex.value) {
    return `${base} bg-gradient-to-r from-purple-500 to-pink-500 text-white`
  }
  if (index === progressStageIndex.value) {
    return `${base} bg-gradient-to-r from-purple-500 to-pink-500 text-white animate-pulse ring-4 ring-purple-400/30`
  }
  return `${base} bg-white/20 text-white/50`
}

// 連接線樣式
function getLineClass(index: number) {
  const base = 'w-6 h-1 rounded-full transition-all duration-300'
  if (index < progressStageIndex.value) {
    return `${base} bg-gradient-to-r from-purple-500 to-pink-500`
  }
  return `${base} bg-white/20`
}

// 預估時間計算
const stageEstimates: Record<string, number> = { voice: 15, subtitle: 8, video: 120 }

const remainingSeconds = computed(() => {
  const stages = ['voice', 'subtitle', 'video']
  const idx = progressStageIndex.value
  if (idx < 0) return 0
  let total = 0
  for (let i = idx; i < stages.length; i++) {
    total += stageEstimates[stages[i]]
  }
  return total
})

const formattedRemainingTime = computed(() => {
  const secs = remainingSeconds.value
  if (secs <= 0) return '即將完成'
  if (secs < 60) return `${secs} 秒`
  const mins = Math.floor(secs / 60)
  const remainSecs = secs % 60
  return remainSecs > 0 ? `${mins} 分 ${remainSecs} 秒` : `${mins} 分鐘`
})
</script>

<template>
  <div class="relative w-full h-full flex items-center justify-center">
    <!-- Preview container -->
    <div
      ref="previewContainerRef"
      :class="[
        'relative bg-stone-900 rounded-2xl overflow-hidden flex items-center justify-center',
        aspectRatioClass,
        // Mobile: adapt to flex parent container
        'max-h-full max-w-full',
        draft.aspectRatio === 'portrait' ? 'h-full w-auto' : 'w-full h-auto',
        // Desktop: portrait fills height, landscape fills width only
        draft.aspectRatio === 'portrait' ? 'lg:h-full lg:max-h-none lg:max-w-[calc((100vh-120px)*9/16)]' : 'lg:w-full',
      ]"
    >
      <!-- Video Player (with result) -->
      <template v-if="generatedResult?.videoUrl">
        <video
          ref="videoRef"
          :src="generatedResult.videoUrl"
          class="w-full h-full object-cover"
          @loadedmetadata="onLoadedMetadata"
          @timeupdate="onTimeUpdate"
          @play="onPlay"
          @pause="onPause"
          @ended="onEnded"
        />

        <!-- Subtitle Overlay (on video) -->
        <div
          v-if="draft.subtitleEnabled && currentSubtitle && isMounted"
          class="absolute inset-x-0 px-4 flex justify-center pointer-events-none"
          :style="{ top: `${subtitleDrag.y.value}%`, transform: 'translateY(-50%)' }"
        >
          <span
            :class="[
              'text-center leading-relaxed text-white font-bold',
              fontClass,
              'drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)]',
            ]"
            :style="{ fontSize: `${scaledSubtitleFontSize}px` }"
          >
            {{ currentSubtitle }}
          </span>
        </div>

        <!-- Title Overlay (on video) -->
        <div
          v-if="draft.subtitleEnabled && draft.title"
          class="absolute inset-x-0 px-3 flex justify-center pointer-events-none z-10"
          :style="{ top: `${titleDrag.y.value}%`, transform: 'translateY(-50%)' }"
        >
          <p
            :class="[
              'text-center whitespace-pre-line font-bold',
              fontClass,
              titleBackgroundClass,
              titleTextClass,
            ]"
            :style="{ fontSize: `${scaledTitleFontSize}px` }"
          >
            {{ draft.title }}
          </p>
        </div>

        <!-- Gradient Overlay -->
        <div class="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />

        <!-- Video Controls -->
        <div class="absolute bottom-0 left-0 right-0 p-3 z-20 flex flex-col gap-1">
          <input
            type="range"
            min="0"
            :max="duration || 100"
            step="0.1"
            :value="currentTime"
            class="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-purple-500"
            @input="handleSeek"
          />
          <div class="flex items-center justify-between text-white mt-1">
            <div class="flex items-center gap-3">
              <button class="focus:outline-none" @click="togglePlay">
                <RotateCcw v-if="currentTime >= duration && duration > 0" class="w-6 h-6 text-white" />
                <Pause v-else-if="isPlaying" class="w-6 h-6 text-white fill-current" />
                <Play v-else class="w-6 h-6 text-white fill-current" />
              </button>
              <!-- Muted indicator -->
              <button
                v-if="isMuted"
                class="p-1 hover:bg-white/10 rounded-full"
                title="點擊取消靜音"
                @click="handleUnmute"
              >
                <VolumeX class="w-5 h-5 text-white" />
              </button>
              <span class="text-xs font-mono opacity-80">
                {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
              </span>
            </div>
            <button
              class="p-1.5 hover:bg-white/10 rounded-full disabled:opacity-50"
              :disabled="isDownloading || ffmpeg.isProcessing.value"
              @click="handleDownload"
            >
              <Loader2 v-if="isDownloading || ffmpeg.isProcessing.value" class="w-5 h-5 text-white animate-spin" />
              <Download v-else class="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      </template>

      <!-- Audio-only Player (with result, no video) -->
      <template v-else-if="generatedResult?.audioUrl && !generatedResult?.videoUrl">
        <audio
          ref="audioRef"
          :src="generatedResult.audioUrl"
          class="hidden"
          @loadedmetadata="onLoadedMetadata"
          @timeupdate="onTimeUpdate"
          @play="onPlay"
          @pause="onPause"
          @ended="onEnded"
        />

        <!-- Avatar as background -->
        <img
          v-if="draft.avatarPreview"
          :src="draft.avatarPreview"
          alt="Avatar preview"
          class="w-full h-full object-cover"
        />

        <!-- Audio indicator -->
        <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/50 rounded-full p-4">
          <span class="text-white text-sm font-medium">音檔</span>
        </div>

        <!-- Title Overlay -->
        <div
          v-if="draft.subtitleEnabled && draft.title"
          class="absolute inset-x-0 px-3 flex justify-center pointer-events-none z-10"
          :style="{ top: `${titleDrag.y.value}%`, transform: 'translateY(-50%)' }"
        >
          <p
            :class="[
              'text-center whitespace-pre-line font-bold',
              fontClass,
              titleBackgroundClass,
              titleTextClass,
            ]"
            :style="{ fontSize: `${scaledTitleFontSize}px` }"
          >
            {{ draft.title }}
          </p>
        </div>

        <!-- Subtitle Overlay (on audio playback) -->
        <div
          v-if="draft.subtitleEnabled && currentSubtitle && isMounted"
          class="absolute inset-x-0 px-4 flex justify-center pointer-events-none"
          :style="{ top: `${subtitleDrag.y.value}%`, transform: 'translateY(-50%)' }"
        >
          <span
            :class="[
              'text-center leading-relaxed text-white font-bold',
              fontClass,
              'drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)]',
            ]"
            :style="{ fontSize: `${scaledSubtitleFontSize}px` }"
          >
            {{ currentSubtitle }}
          </span>
        </div>

        <!-- Gradient Overlay -->
        <div class="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />

        <!-- Audio Controls -->
        <div class="absolute bottom-0 left-0 right-0 p-3 z-20 flex flex-col gap-1">
          <input
            type="range"
            min="0"
            :max="duration || 100"
            step="0.1"
            :value="currentTime"
            class="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-purple-500"
            @input="handleSeek"
          />
          <div class="flex items-center justify-between text-white mt-1">
            <div class="flex items-center gap-3">
              <button class="focus:outline-none" @click="togglePlay">
                <RotateCcw v-if="currentTime >= duration && duration > 0" class="w-6 h-6 text-white" />
                <Pause v-else-if="isPlaying" class="w-6 h-6 text-white fill-current" />
                <Play v-else class="w-6 h-6 text-white fill-current" />
              </button>
              <!-- Muted indicator -->
              <button
                v-if="isMuted"
                class="p-1 hover:bg-white/10 rounded-full"
                title="點擊取消靜音"
                @click="handleUnmute"
              >
                <VolumeX class="w-5 h-5 text-white" />
              </button>
              <span class="text-xs font-mono opacity-80">
                {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
              </span>
            </div>
            <button
              class="p-1.5 hover:bg-white/10 rounded-full disabled:opacity-50"
              :disabled="isDownloading"
              @click="handleDownload"
            >
              <Loader2 v-if="isDownloading" class="w-5 h-5 text-white animate-spin" />
              <Download v-else class="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      </template>

      <!-- Avatar Preview (no result yet) -->
      <template v-else-if="draft.avatarPreview">
        <img
          :src="draft.avatarPreview"
          alt="Avatar preview"
          class="w-full h-full object-cover"
        />

        <!-- Title Overlay - Draggable -->
        <div
          v-if="draft.subtitleEnabled && draft.title"
          :class="[
            'absolute inset-x-0 px-3 flex justify-center z-10 select-none transition-transform',
            titleDrag.isDragging.value
              ? 'cursor-grabbing ring-2 ring-white/50 ring-offset-2 ring-offset-transparent rounded-lg scale-[1.02]'
              : 'cursor-grab hover:ring-2 hover:ring-white/30 hover:ring-offset-1 hover:ring-offset-transparent rounded-lg',
          ]"
          :style="{
            top: `${titleDrag.y.value}%`,
            transform: 'translateY(-50%)',
            ...titleDrag.handlers.style,
          }"
          @pointerdown="titleDrag.handlers.onPointerDown"
          @pointermove="titleDrag.handlers.onPointerMove"
          @pointerup="titleDrag.handlers.onPointerUp"
          @pointercancel="titleDrag.handlers.onPointerCancel"
        >
          <p
            :class="[
              'text-center whitespace-pre-line font-bold',
              fontClass,
              titleBackgroundClass,
              titleTextClass,
            ]"
            :style="{ fontSize: `${scaledTitleFontSize}px` }"
          >
            {{ draft.title }}
          </p>
        </div>

        <!-- Subtitle Overlay - Draggable -->
        <div
          v-if="draft.subtitleEnabled"
          :class="[
            'absolute inset-x-0 px-4 flex justify-center select-none transition-transform',
            subtitleDrag.isDragging.value
              ? 'cursor-grabbing ring-2 ring-white/50 ring-offset-2 ring-offset-transparent rounded-lg scale-[1.02]'
              : 'cursor-grab hover:ring-2 hover:ring-white/30 hover:ring-offset-1 hover:ring-offset-transparent rounded-lg',
          ]"
          :style="{
            top: `${subtitleDrag.y.value}%`,
            transform: 'translateY(-50%)',
            ...subtitleDrag.handlers.style,
          }"
          @pointerdown="subtitleDrag.handlers.onPointerDown"
          @pointermove="subtitleDrag.handlers.onPointerMove"
          @pointerup="subtitleDrag.handlers.onPointerUp"
          @pointercancel="subtitleDrag.handlers.onPointerCancel"
        >
          <span
            :class="[
              'text-center leading-relaxed text-white font-bold',
              fontClass,
              'drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)]',
            ]"
            :style="{ fontSize: `${scaledSubtitleFontSize}px` }"
          >
            字幕預覽效果
          </span>
        </div>

      </template>

      <!-- Empty state -->
      <template v-else>
        <div class="text-center text-stone-500">
          <svg class="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <p class="text-sm">選擇頭像開始預覽</p>
        </div>
      </template>

      <!-- Loading from History Overlay -->
      <div
        v-if="isLoadingFromHistory"
        class="absolute inset-0 bg-black/60 flex items-center justify-center z-30"
      >
        <div class="flex flex-col items-center gap-3">
          <Loader2 class="w-8 h-8 text-white animate-spin" />
          <span class="text-white text-sm">載入中...</span>
        </div>
      </div>

      <!-- Loading Subtitles Overlay -->
      <div
        v-if="isLoadingSubtitles"
        class="absolute inset-0 bg-black/60 flex items-center justify-center z-30"
      >
        <div class="flex flex-col items-center gap-3">
          <Loader2 class="w-8 h-8 text-white animate-spin" />
          <span class="text-white text-sm">正在分析字幕時間點...</span>
          <span v-if="!showTimeoutHint" class="text-white/60 text-xs">預計需要 5-15 秒</span>
          <!-- 超時提示 -->
          <span v-if="showTimeoutHint" class="text-amber-400 text-xs">處理時間較長，建議跳過</span>
          <!-- 跳過按鈕 -->
          <button
            :class="[
              'mt-2 px-3 py-1 text-xs rounded-full transition-colors',
              showTimeoutHint
                ? 'bg-amber-500 text-black hover:bg-amber-400'
                : 'text-white/70 border border-white/30 hover:bg-white/10'
            ]"
            @click="skipWhisperAndUseQuickSubtitles"
          >
            跳過，使用快速字幕
          </button>
        </div>
      </div>

      <!-- FFmpeg Retry Status -->
      <div
        v-if="ffmpeg.retryStatus.value"
        class="absolute inset-0 bg-black/60 flex items-center justify-center z-30"
      >
        <div class="flex flex-col items-center gap-3">
          <Loader2 class="w-8 h-8 text-white animate-spin" />
          <span class="text-white text-sm">{{ ffmpeg.retryStatus.value }}</span>
        </div>
      </div>

      <!-- Generation Progress Overlay -->
      <div
        v-if="isGenerating"
        class="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center z-30 p-6"
      >
        <!-- 進度節點時間軸 -->
        <div class="flex items-center gap-1 mb-6">
          <!-- 語音節點 -->
          <div class="flex flex-col items-center gap-1.5">
            <div :class="getNodeClass(0)">
              <Check v-if="progressStageIndex > 0" class="w-5 h-5" />
              <Mic v-else class="w-5 h-5" />
            </div>
            <span class="text-white/60 text-xs">語音</span>
          </div>

          <!-- 連接線 1 -->
          <div :class="getLineClass(0)" class="mb-5" />

          <!-- 字幕節點 -->
          <div class="flex flex-col items-center gap-1.5">
            <div :class="getNodeClass(1)">
              <Check v-if="progressStageIndex > 1" class="w-5 h-5" />
              <Type v-else class="w-5 h-5" />
            </div>
            <span class="text-white/60 text-xs">字幕</span>
          </div>

          <!-- 連接線 2 -->
          <div :class="getLineClass(1)" class="mb-5" />

          <!-- 影片節點 -->
          <div class="flex flex-col items-center gap-1.5">
            <div :class="getNodeClass(2)">
              <Check v-if="progressStageIndex > 2" class="w-5 h-5" />
              <Video v-else class="w-5 h-5" />
            </div>
            <span class="text-white/60 text-xs">影片</span>
          </div>
        </div>

        <!-- 鼓勵文字 -->
        <p class="text-white text-lg font-medium mb-3">
          {{ currentMessage }}
        </p>

        <!-- 預估時間 -->
        <p class="text-white/70 text-sm mb-4">
          預估還需 {{ formattedRemainingTime }}
        </p>

        <!-- 提示 -->
        <p class="text-white/50 text-xs flex items-center gap-1.5">
          <Lightbulb class="w-3.5 h-3.5" />
          去做其他事吧，完成後會通知你
        </p>
      </div>
    </div>

  </div>
</template>
