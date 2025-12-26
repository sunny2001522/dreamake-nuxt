<script setup lang="ts">
const generationStore = useGenerationStore()
const { draft, generatedResult } = storeToRefs(generationStore)

const aspectRatioClass = computed(() => {
  return draft.value.aspectRatio === 'portrait' ? 'aspect-[9/16]' : 'aspect-video'
})

// 標題拖曳
const titleDrag = useVerticalDrag({
  initialY: draft.value.titleY,
  minY: 5,
  maxY: 50,
})

// 字幕拖曳
const subtitleDrag = useVerticalDrag({
  initialY: draft.value.subtitleY,
  minY: 50,
  maxY: 95,
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
      return 'bg-black/70 px-3 py-1 rounded'
    case 'white':
      return 'bg-white/70 px-3 py-1 rounded text-black'
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
</script>

<template>
  <div class="relative w-full h-full flex items-center justify-center">
    <!-- Preview container -->
    <div
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
      <!-- Video Player -->
      <template v-if="generatedResult?.videoUrl">
        <video
          :src="generatedResult.videoUrl"
          controls
          class="w-full h-full object-contain"
        />
      </template>
      <!-- Avatar Preview -->
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
              'text-center whitespace-pre-line text-sm font-bold',
              fontClass,
              titleBackgroundClass,
              titleTextClass,
            ]"
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
              'text-center text-sm leading-relaxed text-white',
              fontClass,
              'drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)]',
            ]"
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
    </div>

    <!-- Ratio indicator (mobile only) -->
    <p class="lg:hidden text-center text-[10px] text-stone-400 mt-1">
      {{ draft.aspectRatio === 'portrait' ? '9:16' : '16:9' }}
    </p>
  </div>
</template>
