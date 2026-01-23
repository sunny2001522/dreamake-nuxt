<script setup lang="ts">
/**
 * 時間軸主組件
 * 類似剪映的多軌時間軸 UI
 */
import { Play, Pause, RotateCcw, ZoomIn, ZoomOut } from 'lucide-vue-next'
import type { TimelineTracks, GeneratedSegment, RegenerateType } from '~/types'

const props = defineProps<{
  tracks: TimelineTracks
  duration: number
  currentTime: number
  isPlaying: boolean
  segments: GeneratedSegment[]
}>()

const emit = defineEmits<{
  seek: [time: number]
  play: []
  pause: []
  regenerate: [segmentIndex: number, type: RegenerateType]
}>()

// 縮放比例 (每秒對應的像素數)
const zoom = ref(50) // 預設 50px/秒
const minZoom = 20
const maxZoom = 200

// 容器參考
const containerRef = ref<HTMLElement | null>(null)
const tracksContainerRef = ref<HTMLElement | null>(null)

// 計算時間軸總寬度
const timelineWidth = computed(() => props.duration * zoom.value)

// 計算播放指針位置
const playheadPosition = computed(() => props.currentTime * zoom.value)

// 格式化時間顯示
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 10)
  return `${mins}:${secs.toString().padStart(2, '0')}.${ms}`
}

// 縮放控制
function zoomIn() {
  zoom.value = Math.min(maxZoom, zoom.value + 10)
}

function zoomOut() {
  zoom.value = Math.max(minZoom, zoom.value - 10)
}

// 滑鼠滾輪縮放
function handleWheel(e: WheelEvent) {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault()
    if (e.deltaY < 0) {
      zoomIn()
    } else {
      zoomOut()
    }
  }
}

// 點擊刻度尺或軌道區域跳轉
function handleRulerClick(e: MouseEvent) {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const x = e.clientX - rect.left + (tracksContainerRef.value?.scrollLeft || 0)
  const time = Math.max(0, Math.min(props.duration, x / zoom.value))
  emit('seek', time)
}

// 生成刻度標記
const rulerTicks = computed(() => {
  const ticks: Array<{ position: number; time: number; isMajor: boolean }> = []
  const step = zoom.value >= 100 ? 1 : zoom.value >= 50 ? 2 : 5 // 根據縮放調整步長

  for (let time = 0; time <= props.duration; time += step) {
    ticks.push({
      position: time * zoom.value,
      time,
      isMajor: time % (step * 2) === 0,
    })
  }

  return ticks
})

// 處理播放/暫停
function togglePlay() {
  if (props.isPlaying) {
    emit('pause')
  } else {
    emit('play')
  }
}

// 處理重新生成
function handleRegenerate(segmentIndex: number, type: RegenerateType) {
  emit('regenerate', segmentIndex, type)
}

// 滾動到播放指針位置
watch(() => props.currentTime, () => {
  if (tracksContainerRef.value) {
    const containerWidth = tracksContainerRef.value.clientWidth
    const scrollLeft = tracksContainerRef.value.scrollLeft
    const playheadX = playheadPosition.value

    // 如果播放指針超出可視範圍，自動滾動
    if (playheadX < scrollLeft || playheadX > scrollLeft + containerWidth - 50) {
      tracksContainerRef.value.scrollLeft = playheadX - containerWidth / 3
    }
  }
})
</script>

<template>
  <div
    ref="containerRef"
    class="timeline-container bg-stone-900 border-t border-stone-700 select-none"
    @wheel="handleWheel"
  >
    <!-- 控制列 -->
    <div class="timeline-controls flex items-center gap-3 px-3 py-2 bg-stone-800 border-b border-stone-700">
      <!-- 播放按鈕 -->
      <button
        class="p-1.5 rounded hover:bg-stone-700 transition-colors"
        @click="togglePlay"
      >
        <component
          :is="isPlaying ? Pause : (currentTime >= duration ? RotateCcw : Play)"
          class="w-5 h-5 text-white"
        />
      </button>

      <!-- 時間顯示 -->
      <span class="text-xs font-mono text-stone-300 min-w-[80px]">
        {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
      </span>

      <div class="flex-1" />

      <!-- 縮放控制 -->
      <div class="flex items-center gap-1">
        <button
          class="p-1 rounded hover:bg-stone-700 transition-colors"
          :disabled="zoom <= minZoom"
          @click="zoomOut"
        >
          <ZoomOut class="w-4 h-4 text-stone-400" />
        </button>
        <span class="text-xs text-stone-500 min-w-[40px] text-center">
          {{ zoom }}px/s
        </span>
        <button
          class="p-1 rounded hover:bg-stone-700 transition-colors"
          :disabled="zoom >= maxZoom"
          @click="zoomIn"
        >
          <ZoomIn class="w-4 h-4 text-stone-400" />
        </button>
      </div>
    </div>

    <!-- 軌道區域 -->
    <div class="relative">
      <!-- 軌道標籤區 -->
      <div class="absolute left-0 top-0 bottom-0 w-12 bg-stone-800 z-10 border-r border-stone-700">
        <!-- 刻度尺標籤佔位 -->
        <div class="h-6 border-b border-stone-700" />
        <!-- 影片軌標籤 -->
        <div class="h-10 flex items-center justify-center border-b border-stone-700">
          <span class="text-[10px] text-stone-400">影片</span>
        </div>
        <!-- 聲音軌標籤 -->
        <div class="h-10 flex items-center justify-center border-b border-stone-700">
          <span class="text-[10px] text-stone-400">聲音</span>
        </div>
        <!-- 字幕軌標籤 -->
        <div class="h-8 flex items-center justify-center">
          <span class="text-[10px] text-stone-400">字幕</span>
        </div>
      </div>

      <!-- 可滾動的軌道內容 -->
      <div
        ref="tracksContainerRef"
        class="ml-12 overflow-x-auto overflow-y-hidden"
      >
        <div
          class="relative"
          :style="{ width: `${Math.max(timelineWidth, 300)}px` }"
        >
          <!-- 刻度尺 -->
          <div
            class="h-6 relative bg-stone-850 border-b border-stone-700 cursor-pointer"
            @click="handleRulerClick"
          >
            <div
              v-for="tick in rulerTicks"
              :key="tick.time"
              class="absolute top-0"
              :style="{ left: `${tick.position}px` }"
            >
              <div
                class="w-px"
                :class="tick.isMajor ? 'h-4 bg-stone-500' : 'h-2 bg-stone-600 mt-2'"
              />
              <span
                v-if="tick.isMajor"
                class="absolute top-0 left-1 text-[9px] text-stone-500 font-mono"
              >
                {{ tick.time }}s
              </span>
            </div>
          </div>

          <!-- 影片軌 -->
          <TimelineTrack
            type="video"
            :items="tracks.video"
            :zoom="zoom"
            :segments="segments"
            class="h-10 border-b border-stone-700"
            @seek="(time) => emit('seek', time)"
            @regenerate="handleRegenerate"
          />

          <!-- 聲音軌 -->
          <TimelineTrack
            type="audio"
            :items="tracks.audio"
            :zoom="zoom"
            :segments="segments"
            class="h-10 border-b border-stone-700"
            @seek="(time) => emit('seek', time)"
            @regenerate="handleRegenerate"
          />

          <!-- 字幕軌 -->
          <TimelineTrack
            type="subtitle"
            :items="tracks.subtitle"
            :zoom="zoom"
            :segments="segments"
            class="h-8"
            @seek="(time) => emit('seek', time)"
          />

          <!-- 播放指針 -->
          <div
            class="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none"
            :style="{ left: `${playheadPosition}px` }"
          >
            <!-- 三角形頭部 -->
            <div
              class="absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-red-500"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.timeline-container {
  min-height: 120px;
}

.bg-stone-850 {
  background-color: rgb(32, 30, 28);
}
</style>
