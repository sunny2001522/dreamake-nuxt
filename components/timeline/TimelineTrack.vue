<script setup lang="ts">
/**
 * 時間軸軌道組件
 * 渲染單一軌道上的分段區塊
 */
import { RefreshCw } from 'lucide-vue-next'
import type { TimelineTrackItem, GeneratedSegment, RegenerateType, TimelineTrackType } from '~/types'

const props = defineProps<{
  type: TimelineTrackType
  items: TimelineTrackItem[]
  zoom: number
  segments?: GeneratedSegment[]
}>()

const emit = defineEmits<{
  seek: [time: number]
  regenerate: [segmentIndex: number, type: RegenerateType]
}>()

// 軌道顏色
const trackColors: Record<TimelineTrackType, string> = {
  video: 'bg-purple-500/80 hover:bg-purple-500',
  audio: 'bg-pink-500/80 hover:bg-pink-500',
  subtitle: 'bg-blue-500/80 hover:bg-blue-500',
}

// 計算分段位置和寬度
function getSegmentStyle(item: TimelineTrackItem) {
  const left = item.startTime * props.zoom
  const width = Math.max((item.endTime - item.startTime) * props.zoom, 20)
  return {
    left: `${left}px`,
    width: `${width}px`,
  }
}

// 取得分段標籤
function getSegmentLabel(item: TimelineTrackItem): string {
  if (props.type === 'subtitle') {
    return item.content.slice(0, 10) + (item.content.length > 10 ? '...' : '')
  }
  return `段落 ${item.segmentIndex + 1}`
}

// 檢查分段是否正在重新生成
function isRegenerating(segmentIndex: number): boolean {
  const segment = props.segments?.find(s => s.index === segmentIndex)
  return segment?.status === 'tts' || segment?.status === 'whisper' || segment?.status === 'video'
}

// 點擊分段跳轉
function handleSegmentClick(item: TimelineTrackItem) {
  emit('seek', item.startTime)
}

// 重新生成
function handleRegenerate(item: TimelineTrackItem, e: MouseEvent) {
  e.stopPropagation()
  const type: RegenerateType = props.type === 'video' ? 'video' : 'audio'
  emit('regenerate', item.segmentIndex, type)
}

// 是否顯示重新生成按鈕
const showRegenerateButton = computed(() =>
  props.type === 'video' || props.type === 'audio'
)
</script>

<template>
  <div class="relative bg-stone-800/50">
    <!-- 分段區塊 -->
    <div
      v-for="item in items"
      :key="`${item.segmentId}-${item.startTime}`"
      class="absolute top-1 bottom-1 rounded cursor-pointer transition-all group flex items-center"
      :class="trackColors[type]"
      :style="getSegmentStyle(item)"
      @click="handleSegmentClick(item)"
    >
      <!-- 分段標籤 -->
      <span class="px-2 text-[10px] text-white truncate flex-1">
        {{ getSegmentLabel(item) }}
      </span>

      <!-- 重新生成按鈕 (hover 時顯示) -->
      <button
        v-if="showRegenerateButton"
        class="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded bg-white/20 opacity-0 group-hover:opacity-100 hover:bg-white/40 transition-all"
        :disabled="isRegenerating(item.segmentIndex)"
        :title="type === 'video' ? '重新生成影片' : '重新生成聲音'"
        @click="(e) => handleRegenerate(item, e)"
      >
        <RefreshCw
          class="w-3 h-3 text-white"
          :class="{ 'animate-spin': isRegenerating(item.segmentIndex) }"
        />
      </button>
    </div>

    <!-- 空狀態提示 -->
    <div
      v-if="items.length === 0"
      class="absolute inset-0 flex items-center justify-center"
    >
      <span class="text-[10px] text-stone-600">
        {{ type === 'video' ? '影片軌' : type === 'audio' ? '聲音軌' : '字幕軌' }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.group:hover .regenerate-btn {
  opacity: 1;
}
</style>
