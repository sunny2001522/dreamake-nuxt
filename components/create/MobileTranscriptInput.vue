<script setup lang="ts">
import { Mic, Sparkles } from "lucide-vue-next";
import SoundWaveIndicator from "~/components/common/SoundWaveIndicator.vue";

const generationStore = useGenerationStore();
const toastStore = useToastStore();
const { draft } = storeToRefs(generationStore);

const transcriptGeneration = useTranscriptGeneration();
const isGenerating = computed(() => transcriptGeneration.isGenerating.value);
const isGeneratingTitle = ref(false);


// Textarea auto-resize
const textareaRef = ref<HTMLTextAreaElement | null>(null);

// Interim text for real-time display
const titleInterimText = ref("");
const transcriptInterimText = ref("");

// Display text combining confirmed and interim results
const displayTitle = computed(() => draft.value.title + titleInterimText.value);
const displayTranscript = computed(
  () => draft.value.transcript + transcriptInterimText.value
);

// Speech recognition for title
const titleSpeech = useSpeechRecognition({
  onTranscript: (text, isFinal) => {
    if (isFinal) {
      generationStore.updateDraft({ title: draft.value.title + text });
      titleInterimText.value = "";
    } else {
      titleInterimText.value = text;
    }
  },
  onError: (error) => toastStore.error(error),
  lang: "zh-TW",
});

// Speech recognition for transcript
const transcriptSpeech = useSpeechRecognition({
  onTranscript: (text, isFinal) => {
    if (isFinal) {
      generationStore.updateDraft({
        transcript: draft.value.transcript + text,
      });
      transcriptInterimText.value = "";
    } else {
      transcriptInterimText.value = text;
    }
  },
  onError: (error) => toastStore.error(error),
  lang: "zh-TW",
});

function adjustTextareaHeight() {
  const textarea = textareaRef.value;
  if (!textarea) return;
  textarea.style.height = "auto";
  const maxHeight = 88; // 約四行高度 (22px * 4)
  textarea.style.height = Math.min(textarea.scrollHeight, maxHeight) + "px";
}

function handleInput(value: string) {
  generationStore.updateDraft({ transcript: value });
  nextTick(adjustTextareaHeight);
}

async function handleExpandTranscript() {
  const currentText = draft.value.transcript.trim();

  if (!currentText) {
    toastStore.warning("請先輸入文字內容");
    return;
  }

  try {
    toastStore.info("正在擴寫腳本...");
    const transcript = await transcriptGeneration.generateTranscript(currentText);
    generationStore.updateDraft({ transcript });
    toastStore.success("腳本擴寫完成！");
  } catch (err: any) {
    console.error("Failed to expand transcript:", err);
    toastStore.error("擴寫失敗", err.message || "請稍後再試");
  }
}

function handleTitleInput(value: string) {
  generationStore.updateDraft({ title: value });
}

function handleTitleMicClick() {
  if (titleSpeech.isListening.value) {
    titleSpeech.stopListening();
  } else {
    titleSpeech.startListening();
  }
}

function handleTranscriptMicClick() {
  if (transcriptSpeech.isListening.value) {
    transcriptSpeech.stopListening();
  } else {
    transcriptSpeech.startListening();
  }
}

async function handleGenerateTitle() {
  if (!draft.value.transcript.trim()) {
    toastStore.warning("請先輸入腳本內容");
    return;
  }

  try {
    isGeneratingTitle.value = true;
    const title = await transcriptGeneration.generateTitle(
      draft.value.transcript
    );
    generationStore.updateDraft({ title });
    toastStore.success("標題生成完成！");
  } catch (err: any) {
    console.error("Failed to generate title:", err);
    toastStore.error("標題生成失敗", err.message || "請稍後再試");
  } finally {
    isGeneratingTitle.value = false;
  }
}
</script>

<template>
  <div class="space-y-2">
    <!-- Section label -->

    <!-- Transcript textarea with mic and AI buttons -->
    <div class="relative">
      <textarea
        ref="textareaRef"
        :value="displayTranscript"
        rows="1"
        placeholder="輸入逐字稿..."
        class="w-full px-3 py-2 pr-16 bg-white border border-stone-200 rounded-lg text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:border-stone-500 focus:ring-2 focus:ring-stone-500/20 resize-none overflow-hidden"
        @input="handleInput(($event.target as HTMLTextAreaElement).value)"
      />
      <div class="absolute right-1.5 top-2 flex items-center gap-0.5">
        <button
          class="p-1.5 transition-colors"
          :class="
            transcriptSpeech.isListening.value
              ? 'text-red-500'
              : 'text-stone-400 hover:text-stone-600'
          "
          :title="transcriptSpeech.isListening.value ? '停止錄音' : '語音輸入'"
          @click="handleTranscriptMicClick"
        >
          <SoundWaveIndicator
            v-if="transcriptSpeech.isListening.value"
            :active="true"
            size="sm"
            color="red"
          />
          <Mic v-else class="w-4 h-4" />
        </button>
        <button
          class="p-1.5 transition-colors disabled:opacity-50"
          :class="isGenerating ? 'text-purple-500' : 'text-stone-400 hover:text-stone-700'"
          title="AI 擴寫"
          :disabled="!draft.transcript.trim() || isGenerating"
          @click="handleExpandTranscript"
        >
          <svg
            v-if="isGenerating"
            class="animate-spin w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
            />
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <Sparkles v-else class="w-4 h-4" />
        </button>
      </div>
    </div>
    <!-- Title input with mic and AI buttons -->
    <div class="relative">
      <input
        :value="displayTitle"
        type="text"
        placeholder="輸入標題..."
        class="w-full px-3 py-2 pr-16 bg-white border border-stone-200 rounded-lg text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:border-stone-500 focus:ring-2 focus:ring-stone-500/20"
        @input="handleTitleInput(($event.target as HTMLInputElement).value)"
      />
      <div
        class="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5"
      >
        <button
          class="p-1.5 transition-colors"
          :class="
            titleSpeech.isListening.value
              ? 'text-red-500'
              : 'text-stone-400 hover:text-stone-600'
          "
          :title="titleSpeech.isListening.value ? '停止錄音' : '語音輸入'"
          @click="handleTitleMicClick"
        >
          <SoundWaveIndicator
            v-if="titleSpeech.isListening.value"
            :active="true"
            size="sm"
            color="red"
          />
          <Mic v-else class="w-4 h-4" />
        </button>
        <button
          class="p-1.5 text-stone-400 hover:text-stone-700 transition-colors"
          title="AI 生成標題"
          :disabled="isGeneratingTitle"
          @click="handleGenerateTitle"
        >
          <svg
            v-if="isGeneratingTitle"
            class="animate-spin w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
            />
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <Sparkles v-else class="w-4 h-4" />
        </button>
      </div>
    </div>

  </div>
</template>
