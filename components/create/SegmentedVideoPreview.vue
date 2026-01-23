<script setup lang="ts">
/**
 * 分段生成影片預覽組件
 * 整合雙 Video 串接播放 + 剪映風格時間軸
 */
import { Play, Pause, RotateCcw, Download, Loader2, VolumeX, RefreshCw } from 'lucide-vue-next'
import type { RegenerateType } from '~/types'

// Props
const props = withDefaults(defineProps<{
  showTimeline?: boolean
}>(), {
  showTimeline: true,
})

const segmentedStore = useSegmentedGenerationStore()
const generationStore = useGenerationStore()
const toastStore = useToastStore()

const {
  segments,
  completedSegments,
  totalDuration,
  globalCurrentTime,
  isPlaying,
  currentSubtitle,
  timelineTracks,
  overallStatus,
  progress,
  isGenerating,
  overallProgress,
} = storeToRefs(segmentedStore)

const { draft } = storeToRefs(generationStore)

// 雙 Video 元素
const videoARef = ref<HTMLVideoElement | null>(null)
const videoBRef = ref<HTMLVideoElement | null>(null)

// 串接播放器
const player = useSegmentedPlayer({
  onSegmentChange: (segment) => {
    console.log('Segment changed:', segment.index)
  },
  onTimeUpdate: (globalTime) => {
    segmentedStore.setGlobalTime(globalTime)
  },
  onEnded: () => {
    console.log('Playback ended')
  },
})

// 初始化播放器
onMounted(() => {
  if (videoARef.value && videoBRef.value) {
    player.initialize(videoARef.value, videoBRef.value)
  }
})

onUnmounted(() => {
  player.cleanup()
})

// 監聽 completedSegments 變化
watch(
  () => completedSegments.value.length,
  () => {
    // 當有新的完成段落時，如果播放器已初始化，重新載入
    if (player.isInitialized.value && completedSegments.value.length > 0) {
      player.reloadCurrentSegment()
    }
  }
)

// 容器參考
const previewContainerRef = ref<HTMLElement | null>(null)
const previewWidth = ref(0)

function updatePreviewWidth() {
  if (previewContainerRef.value) {
    previewWidth.value = previewContainerRef.value.getBoundingClientRect().width
  }
}

onMounted(() => {
  updatePreviewWidth()
  window.addEventListener('resize', updatePreviewWidth)
})

onUnmounted(() => {
  window.removeEventListener('resize', updatePreviewWidth)
})

// 字幕字體大小
const scaledSubtitleFontSize = computed(() => {
  if (previewWidth.value === 0) return 16
  const isMobile = window.innerWidth < 1024
  const divisor = isMobile ? 18 : 15
  const minSize = isMobile ? 16 : 20
  return Math.max(Math.round((previewWidth.value * 0.8) / divisor), minSize)
})

// 字體樣式
const fontClass = computed(() => {
  return draft.value.subtitleFont === 'ming' ? 'font-serif' : 'font-sans'
})

// 比例樣式
const aspectRatioClass = computed(() => {
  return draft.value.aspectRatio === 'portrait' ? 'aspect-[9/16]' : 'aspect-video'
})

// 格式化時間
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// 處理 seek
function handleSeek(time: number) {
  player.seekTo(time)
}

// 處理播放
function handlePlay() {
  player.play()
}

// 處理暫停
function handlePause() {
  player.pause()
}

// 處理重新生成
async function handleRegenerate(segmentIndex: number, type: RegenerateType) {
  try {
    toastStore.info(`重新生成段落 ${segmentIndex + 1}...`)
    await segmentedStore.regenerateSegment(segmentIndex, type)
    toastStore.success(`段落 ${segmentIndex + 1} 已開始重新生成`)
  } catch (error: any) {
    toastStore.error(error.message || '重新生成失敗')
  }
}

// 是否有可播放的內容
const hasPlayableContent = computed(() => completedSegments.value.length > 0)

// 暴露方法給父組件（讓時間軸可以控制播放）
defineExpose({
  seekTo: handleSeek,
  play: handlePlay,
  pause: handlePause,
})

// 監聽 store 的播放狀態變化（讓外部時間軸可以控制）
watch(
  () => segmentedStore.isPlaying,
  (shouldPlay) => {
    if (shouldPlay && !player.isPlaying.value) {
      player.play()
    } else if (!shouldPlay && player.isPlaying.value) {
      player.pause()
    }
  }
)

// 監聽 store 的 globalCurrentTime 變化（讓外部 seek 生效）
watch(
  () => segmentedStore.globalCurrentTime,
  (newTime) => {
    // 只有當差異較大時才 seek（避免循環更新）
    const currentPlayerTime = player.currentSegmentIndex.value >= 0
      ? (segmentedStore.completedSegments[player.currentSegmentIndex.value]?.globalStartTime || 0)
      : 0
    if (Math.abs(newTime - currentPlayerTime) > 0.5) {
      player.seekTo(newTime)
    }
  }
)

// 是否顯示進度提示
const showProgressHint = computed(() =>
  isGenerating.value || overallStatus.value === 'segmenting'
)
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- 影片預覽區 -->
    <div class="flex-1 relative flex items-center justify-center p-2">
      <div
        ref="previewContainerRef"
        :class="[
          'relative bg-stone-900 rounded-2xl overflow-hidden',
          aspectRatioClass,
          'max-h-full max-w-full',
          draft.aspectRatio === 'portrait' ? 'h-full w-auto' : 'w-full h-auto',
        ]"
      >
        <!-- 雙 Video 元素 -->
        <div class="absolute inset-0">
          <video
            ref="videoARef"
            class="absolute inset-0 w-full h-full object-cover"
            playsinline
          />
          <video
            ref="videoBRef"
            class="absolute inset-0 w-full h-full object-cover"
            playsinline
          />
        </div>

        <!-- 字幕疊加層 -->
        <div
          v-if="draft.subtitleEnabled && currentSubtitle"
          class="absolute inset-x-0 px-4 flex justify-center pointer-events-none z-10"
          :style="{ top: '66%', transform: 'translateY(-50%)' }"
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

        <!-- 空狀態 / 生成中 -->
        <div
          v-if="!hasPlayableContent"
          class="absolute inset-0 flex flex-col items-center justify-center bg-stone-900"
        >
          <template v-if="showProgressHint">
            <!-- 生成進度 -->
            <Loader2 class="w-10 h-10 text-purple-400 animate-spin mb-4" />
            <p class="text-white font-medium mb-2">
              {{ overallStatus === 'segmenting' ? '正在分段...' : '正在生成...' }}
            </p>
            <p class="text-stone-400 text-sm mb-4">
              {{ progress.completed }} / {{ progress.total }} 段完成
            </p>
            <div class="w-48 h-2 bg-stone-700 rounded-full overflow-hidden">
              <div
                class="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
                :style="{ width: `${overallProgress}%` }"
              />
            </div>
          </template>
          <template v-else>
            <!-- 等待開始 -->
            <div class="text-center text-stone-500">
              <svg class="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <p class="text-sm">等待生成...</p>
            </div>
          </template>
        </div>

        <!-- 載入中遮罩 -->
        <div
          v-if="player.isLoading.value"
          class="absolute inset-0 bg-black/50 flex items-center justify-center z-20"
        >
          <Loader2 class="w-8 h-8 text-white animate-spin" />
        </div>

        <!-- 漸層遮罩 (底部) -->
        <div
          v-if="hasPlayableContent"
          class="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/80 to-transparent pointer-events-none z-5"
        />

        <!-- 簡易播放控制 (影片上方) -->
        <div
          v-if="hasPlayableContent"
          class="absolute bottom-2 left-2 right-2 flex items-center justify-between z-10"
        >
          <div class="flex items-center gap-2">
            <button
              class="p-1.5 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
              @click="isPlaying ? handlePause() : handlePlay()"
            >
              <component
                :is="isPlaying ? Pause : (globalCurrentTime >= totalDuration ? RotateCcw : Play)"
                class="w-5 h-5 text-white"
              />
            </button>
            <span class="text-white text-xs font-mono">
              {{ formatTime(globalCurrentTime) }} / {{ formatTime(totalDuration) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 時間軸 (可透過 prop 控制顯示) -->
    <div v-if="props.showTimeline" class="flex-shrink-0">
      <Timeline
        :tracks="timelineTracks"
        :duration="totalDuration"
        :current-time="globalCurrentTime"
        :is-playing="isPlaying"
        :segments="segments"
        @seek="handleSeek"
        @play="handlePlay"
        @pause="handlePause"
        @regenerate="handleRegenerate"
      />
    </div>
  </div>
</template>
