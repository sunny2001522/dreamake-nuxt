<script setup lang="ts">
interface Props {
  modelValue: boolean
  title?: string
  width?: 'sm' | 'md' | 'lg' | 'xl'
  position?: 'left' | 'right'
  closeOnBackdrop?: boolean
  keepAlive?: boolean // Keep content mounted when closed
}

const props = withDefaults(defineProps<Props>(), {
  width: 'lg',
  position: 'right',
  closeOnBackdrop: true,
  keepAlive: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const widthClasses = {
  sm: 'w-80',
  md: 'w-96',
  lg: 'w-[448px]',
  xl: 'w-[512px]',
}

// Track if drawer has been opened at least once (for keepAlive)
const hasBeenOpened = ref(false)

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      hasBeenOpened.value = true
    }
  },
  { immediate: true }
)

function close() {
  emit('update:modelValue', false)
}

function handleBackdropClick() {
  if (props.closeOnBackdrop) {
    close()
  }
}

// Handle escape key
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    close()
  }
}

// Lock body scroll when drawer is open
watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      document.body.style.overflow = 'hidden'
      document.addEventListener('keydown', handleKeydown)
    } else {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', handleKeydown)
    }
  }
)

onUnmounted(() => {
  document.body.style.overflow = ''
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Teleport to="body">
    <!-- KeepAlive mode: always render but hide with CSS -->
    <template v-if="keepAlive && hasBeenOpened">
      <div
        class="fixed inset-0 z-50 transition-all duration-300"
        :class="modelValue ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-black/40 backdrop-blur-sm"
          @click="handleBackdropClick"
        />

        <!-- Drawer Panel -->
        <div
          :class="[
            'absolute top-0 bottom-0 bg-white shadow-2xl flex flex-col max-w-full transition-transform duration-300',
            widthClasses[width],
            position === 'right' ? 'right-0' : 'left-0',
            modelValue
              ? 'translate-x-0'
              : position === 'right' ? 'translate-x-full' : '-translate-x-full',
          ]"
        >
          <!-- Header -->
          <div v-if="title || $slots.header" class="flex items-center justify-between px-4 py-3 border-b border-stone-200 flex-shrink-0">
            <slot name="header">
              <h3 class="text-lg font-semibold text-stone-800">{{ title }}</h3>
            </slot>
            <button
              class="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
              @click="close"
            >
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-hidden">
            <slot />
          </div>
        </div>
      </div>
    </template>

    <!-- Normal mode: use v-if with Transition -->
    <Transition v-else :name="position === 'right' ? 'drawer-right' : 'drawer-left'">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-50"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-black/40 backdrop-blur-sm"
          @click="handleBackdropClick"
        />

        <!-- Drawer Panel -->
        <div
          :class="[
            'absolute top-0 bottom-0 bg-white shadow-2xl flex flex-col max-w-full',
            widthClasses[width],
            position === 'right' ? 'right-0' : 'left-0',
          ]"
        >
          <!-- Header -->
          <div v-if="title || $slots.header" class="flex items-center justify-between px-4 py-3 border-b border-stone-200 flex-shrink-0">
            <slot name="header">
              <h3 class="text-lg font-semibold text-stone-800">{{ title }}</h3>
            </slot>
            <button
              class="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
              @click="close"
            >
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-hidden">
            <slot />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* Right drawer animation */
.drawer-right-enter-active,
.drawer-right-leave-active {
  transition: all 0.3s ease;
}

.drawer-right-enter-from,
.drawer-right-leave-to {
  opacity: 0;
}

.drawer-right-enter-from > div:last-child,
.drawer-right-leave-to > div:last-child {
  transform: translateX(100%);
}

/* Left drawer animation */
.drawer-left-enter-active,
.drawer-left-leave-active {
  transition: all 0.3s ease;
}

.drawer-left-enter-from,
.drawer-left-leave-to {
  opacity: 0;
}

.drawer-left-enter-from > div:last-child,
.drawer-left-leave-to > div:last-child {
  transform: translateX(-100%);
}
</style>
