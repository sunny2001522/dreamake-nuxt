<script setup lang="ts">
import { ChevronDown } from "lucide-vue-next";
import type { SubtitleFont, SubtitleBackground } from "~/types";

const generationStore = useGenerationStore();
const { draft } = storeToRefs(generationStore);

const fonts: { value: SubtitleFont; label: string }[] = [
  { value: "gothic", label: "黑體" },
  { value: "ming", label: "明體" },
];

const backgrounds: { value: SubtitleBackground; label: string }[] = [
  { value: "none", label: "標題無背景" },
  { value: "black", label: "標題黑色背景" },
  { value: "white", label: "標題白色背景" },
];

const fontDropdownOpen = ref(false);
const backgroundDropdownOpen = ref(false);

function setSubtitleEnabled(enabled: boolean) {
  generationStore.updateDraft({ subtitleEnabled: enabled });
}

function setFont(font: SubtitleFont) {
  generationStore.updateDraft({ subtitleFont: font });
  fontDropdownOpen.value = false;
}

function setBackground(background: SubtitleBackground) {
  generationStore.updateDraft({ subtitleBackground: background });
  backgroundDropdownOpen.value = false;
}

function toggleFontDropdown() {
  fontDropdownOpen.value = !fontDropdownOpen.value;
  backgroundDropdownOpen.value = false;
}

function toggleBackgroundDropdown() {
  backgroundDropdownOpen.value = !backgroundDropdownOpen.value;
  fontDropdownOpen.value = false;
}

function closeDropdowns() {
  fontDropdownOpen.value = false;
  backgroundDropdownOpen.value = false;
}

const fontDropdownRef = ref<HTMLElement | null>(null);
const backgroundDropdownRef = ref<HTMLElement | null>(null);

function handleClickOutside(event: MouseEvent) {
  const target = event.target as Node;
  if (fontDropdownRef.value && !fontDropdownRef.value.contains(target)) {
    fontDropdownOpen.value = false;
  }
  if (
    backgroundDropdownRef.value &&
    !backgroundDropdownRef.value.contains(target)
  ) {
    backgroundDropdownOpen.value = false;
  }
}

onMounted(() => {
  document.addEventListener("click", handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside);
});

const currentFontLabel = computed(() => {
  return (
    fonts.find((f) => f.value === draft.value.subtitleFont)?.label || "黑體"
  );
});

const currentBackgroundLabel = computed(() => {
  return (
    backgrounds.find((b) => b.value === draft.value.subtitleBackground)
      ?.label || "標題無背景"
  );
});
</script>

<template>
  <div class="card p-4">
    <div class="flex items-center justify-between mb-3">
      <label class="text-sm font-medium text-stone-700">字幕設定</label>
      <button
        :class="[
          'relative w-12 h-6 rounded-full transition-colors',
          draft.subtitleEnabled ? 'bg-stone-600' : 'bg-stone-300',
        ]"
        @click="setSubtitleEnabled(!draft.subtitleEnabled)"
      >
        <span
          :class="[
            'absolute left-0 top-1 w-4 h-4 bg-white rounded-full transition-transform',
            draft.subtitleEnabled ? 'translate-x-7' : 'translate-x-1',
          ]"
        />
      </button>
    </div>

    <div
      class="flex flex-col sm:flex-row gap-2 transition-opacity"
      :class="draft.subtitleEnabled ? 'opacity-100' : 'opacity-0 pointer-events-none'"
    >
      <!-- Font Dropdown -->
      <div ref="fontDropdownRef" class="relative flex-1">
        <button
          type="button"
          class="w-full flex items-center justify-between bg-white border border-stone-200 text-stone-700 text-sm rounded-lg py-2 px-3 cursor-pointer hover:border-stone-300 transition-all"
          :class="
            fontDropdownOpen
              ? 'ring-2 ring-stone-400/50 border-transparent bg-stone-50'
              : ''
          "
          @click="toggleFontDropdown"
        >
          <span class="whitespace-nowrap truncate">{{ currentFontLabel }}</span>
          <ChevronDown
            class="w-4 h-4 text-stone-400 transition-transform"
            :class="fontDropdownOpen ? 'rotate-180' : ''"
          />
        </button>
        <Transition
          enter-active-class="transition duration-150 ease-out"
          enter-from-class="opacity-0 -translate-y-1"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition duration-100 ease-in"
          leave-from-class="opacity-100 translate-y-0"
          leave-to-class="opacity-0 -translate-y-1"
        >
          <div
            v-if="fontDropdownOpen"
            class="absolute z-10 mt-1 w-full bg-white border border-stone-200 rounded-lg shadow-lg overflow-hidden"
          >
            <button
              v-for="font in fonts"
              :key="font.value"
              type="button"
              class="w-full text-left px-3 py-2 text-sm hover:bg-stone-100 transition-colors"
              :class="
                draft.subtitleFont === font.value
                  ? 'bg-stone-100 text-stone-800 font-medium'
                  : 'text-stone-700'
              "
              @click="setFont(font.value)"
            >
              {{ font.label }}
            </button>
          </div>
        </Transition>
      </div>

      <!-- Background Dropdown - 只在有標題時顯示 -->
      <div v-if="draft.title" ref="backgroundDropdownRef" class="relative flex-1">
        <button
          type="button"
          class="w-full flex items-center justify-between bg-white border border-stone-200 text-stone-700 text-sm rounded-lg py-2 px-3 cursor-pointer hover:border-stone-300 transition-all"
          :class="
            backgroundDropdownOpen
              ? 'ring-2 ring-stone-400/50 border-transparent bg-stone-50'
              : ''
          "
          @click="toggleBackgroundDropdown"
        >
          <span class="whitespace-nowrap truncate">{{ currentBackgroundLabel }}</span>
          <ChevronDown
            class="w-4 h-4 text-stone-400 transition-transform"
            :class="backgroundDropdownOpen ? 'rotate-180' : ''"
          />
        </button>
        <Transition
          enter-active-class="transition duration-150 ease-out"
          enter-from-class="opacity-0 -translate-y-1"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition duration-100 ease-in"
          leave-from-class="opacity-100 translate-y-0"
          leave-to-class="opacity-0 -translate-y-1"
        >
          <div
            v-if="backgroundDropdownOpen"
            class="absolute z-10 mt-1 w-full bg-white border border-stone-200 rounded-lg shadow-lg overflow-hidden"
          >
            <button
              v-for="bg in backgrounds"
              :key="bg.value"
              type="button"
              class="w-full text-left px-3 py-2 text-sm hover:bg-stone-100 transition-colors"
              :class="
                draft.subtitleBackground === bg.value
                  ? 'bg-stone-100 text-stone-800 font-medium'
                  : 'text-stone-700'
              "
              @click="setBackground(bg.value)"
            >
              {{ bg.label }}
            </button>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>
