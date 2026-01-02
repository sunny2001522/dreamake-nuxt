<script setup lang="ts">
import type { SuggestedTopic, MediaPlatform, DbPersona } from "~/types";
import { Mic, Sparkles, Gem } from "lucide-vue-next";
import SoundWaveIndicator from "~/components/common/SoundWaveIndicator.vue";
import PlatformLogos from "~/components/icons/PlatformLogos.vue";

// Channel analysis Token cost
const ANALYSIS_TOKEN_COST = 1;

const generationStore = useGenerationStore();
const authStore = useAuthStore();
const preferencesStore = usePreferencesStore();
const toastStore = useToastStore();
const { draft } = storeToRefs(generationStore);

// Props for persona content
const props = defineProps<{
  personaContent?: string;
}>();

// Saved personas list
const savedPersonas = ref<DbPersona[]>([]);
const isLoadingPersonas = ref(false);
const currentPersonaId = ref<string | null>(null);
const expandedPersonaId = ref<string | null>(null);

const emit = defineEmits<{
  personaUpdate: [content: string];
}>();

// Transcript generation composable
const transcriptGeneration = useTranscriptGeneration();
const mediaAnalysis = useMediaAnalysis();

const maxLength = 500;
const charCount = computed(() => draft.value.transcript.length);
const isOverLimit = computed(() => charCount.value > maxLength);

// AI generation state
const isGenerating = computed(() => transcriptGeneration.isGenerating.value);

// Persona modal
const showPersonaModal = ref(false);
const mediaUrl = ref("");
const isAnalyzing = ref(false);
const analysisResult = ref<string | null>(null);
const analysisPlatform = ref<MediaPlatform | null>(null);

// Topic suggestions
const topics = computed(() => transcriptGeneration.suggestedTopics.value);
const isLoadingTopics = computed(
  () => transcriptGeneration.isLoadingTopics.value
);
const hasPersona = computed(
  () => !!props.personaContent?.trim() || !!analysisResult.value
);

// Track selected topic
const selectedTopicId = ref<string | null>(null);

// Platform labels
const platformLabels: Record<MediaPlatform, string> = {
  youtube: "YouTube",
  twitch: "Twitch",
  bilibili: "Bilibili",
  tiktok: "TikTok",
  podcast: "Podcast RSS",
  other: "yt-dlp 支援平台",
};

// Podcast RSS URL detection helper
function isPodcastRssUrl(hostname: string, pathname: string): boolean {
  const podcastHosts = [
    'feeds.fireside.fm', 'feeds.soundon.fm', 'anchor.fm',
    'open.firstory.me', 'libsyn.com', 'feeds.buzzsprout.com',
    'feeds.simplecast.com', 'feed.podbean.com', 'feeds.transistor.fm',
    'feeds.megaphone.fm', 'feeds.acast.com'
  ];

  if (podcastHosts.some(h => hostname.includes(h))) return true;
  if (pathname.endsWith('/rss') || pathname.endsWith('/feed') || pathname.endsWith('.xml')) return true;
  return false;
}

// URL validation - supports both URLs and text input
const urlValidation = computed(() => {
  const input = mediaUrl.value.trim();
  if (!input) {
    return {
      isValid: false,
      platform: null as MediaPlatform | null,
      error: null,
      isUrl: false,
    };
  }

  // Check if it's a URL
  try {
    const url = new URL(input);
    const hostname = url.hostname.toLowerCase();
    const pathname = url.pathname.toLowerCase();

    // YouTube
    if (hostname.includes("youtube.com") || hostname.includes("youtu.be")) {
      return {
        isValid: true,
        platform: "youtube" as MediaPlatform,
        error: null,
        isUrl: true,
      };
    }
    // Twitch
    if (hostname.includes("twitch.tv")) {
      return {
        isValid: true,
        platform: "twitch" as MediaPlatform,
        error: null,
        isUrl: true,
      };
    }
    // Bilibili
    if (hostname.includes("bilibili.com")) {
      return {
        isValid: true,
        platform: "bilibili" as MediaPlatform,
        error: null,
        isUrl: true,
      };
    }
    // TikTok
    if (hostname.includes("tiktok.com")) {
      return {
        isValid: true,
        platform: "tiktok" as MediaPlatform,
        error: null,
        isUrl: true,
      };
    }
    // Podcast RSS Feed detection
    if (isPodcastRssUrl(hostname, pathname)) {
      return {
        isValid: true,
        platform: "podcast" as MediaPlatform,
        error: null,
        isUrl: true,
      };
    }
    // Other yt-dlp supported URLs
    return {
      isValid: true,
      platform: "other" as MediaPlatform,
      error: null,
      isUrl: true,
    };
  } catch {
    // Not a URL - treat as text input (channel name or description)
    return {
      isValid: true,
      platform: null as MediaPlatform | null,
      error: null,
      isUrl: false,
    };
  }
});

// Load saved personas on mount
onMounted(async () => {
  if (authStore.user) {
    await loadSavedPersonas();
  }
});

// Watch for auth changes
watch(
  () => authStore.user,
  async (user) => {
    if (user) {
      await loadSavedPersonas();
    } else {
      savedPersonas.value = [];
    }
  }
);

async function loadSavedPersonas() {
  if (!authStore.user) return;

  try {
    isLoadingPersonas.value = true;
    const { getAllPersonas } = usePersonaStorage();
    const userId = authStore.authInfo.email || authStore.authInfo.sub;
    savedPersonas.value = await getAllPersonas(userId);
  } catch (err) {
    console.error("Failed to load saved personas:", err);
  } finally {
    isLoadingPersonas.value = false;
  }
}

// Watch for persona content changes to load topics
watch(
  () => props.personaContent,
  async (content) => {
    if (content && content.trim()) {
      analysisResult.value = content;
      await loadTopics(content);
    }
  },
  { immediate: true }
);

// Watch for preferences changes and load saved persona
watch(
  () => preferencesStore.preferences?.persona_id,
  async (personaId) => {
    // Only apply if we don't already have a persona set
    if (personaId && !analysisResult.value) {
      try {
        const { getPersonaById } = usePersonaStorage();
        const persona = await getPersonaById(personaId);
        if (persona) {
          analysisResult.value = persona.content;
          currentPersonaId.value = persona.id;
          emit("personaUpdate", persona.content);
          console.log(
            "Applied default persona from preferences:",
            persona.name
          );
        }
      } catch (err) {
        console.error("Failed to load saved persona:", err);
      }
    } else if (!personaId) {
      currentPersonaId.value = null;
    }
  }
);

function handleInput(value: string) {
  generationStore.updateDraft({ transcript: value });
}

async function handleExpandTranscript() {
  const currentText = draft.value.transcript.trim();

  if (!currentText) {
    toastStore.warning("請先輸入文字內容");
    return;
  }

  try {
    toastStore.info("正在擴寫腳本...");
    const transcript = await transcriptGeneration.generateTranscript(
      currentText,
      analysisResult.value || props.personaContent
    );
    generationStore.updateDraft({ transcript });
    toastStore.success("腳本擴寫完成！");
  } catch (err: any) {
    console.error("Failed to expand transcript:", err);
    toastStore.error("擴寫失敗", err.message || "請稍後再試");
  }
}

async function handleGenerateTitle() {
  if (!draft.value.transcript.trim()) {
    toastStore.warning("請先輸入腳本內容");
    return;
  }

  try {
    const title = await transcriptGeneration.generateTitle(
      draft.value.transcript
    );
    generationStore.updateDraft({ title });
    toastStore.success("標題生成完成！");
  } catch (err: any) {
    console.error("Failed to generate title:", err);
    toastStore.error("標題生成失敗", err.message || "請稍後再試");
  }
}

async function loadTopics(content: string) {
  try {
    await transcriptGeneration.suggestTopics(content);
  } catch (err: any) {
    console.error("Failed to load topics:", err);
    toastStore.error("主題生成失敗", err.message || "請稍後再試");
  }
}

async function handleRefreshTopics() {
  const content = analysisResult.value || props.personaContent;
  if (!content?.trim()) {
    toastStore.warning("請先設定頻道風格");
    return;
  }
  await loadTopics(content);
}

async function handleSelectTopic(topic: SuggestedTopic) {
  selectedTopicId.value = topic.id;
  try {
    toastStore.info("正在生成腳本...");
    const transcript = await transcriptGeneration.generateTranscript(
      topic.title
    );
    generationStore.updateDraft({ transcript, title: topic.title });
    toastStore.success("腳本生成完成！");
  } catch (err: any) {
    console.error("Failed to generate transcript:", err);
    toastStore.error("生成失敗", err.message || "請稍後再試");
  }
}

async function handleAnalyzeMedia() {
  if (!urlValidation.value.isValid) {
    toastStore.warning(urlValidation.value.error || "請輸入有效的媒體網址");
    return;
  }

  try {
    isAnalyzing.value = true;
    analysisPlatform.value = urlValidation.value.platform;

    const result = await mediaAnalysis.startAnalysis([
      {
        url: mediaUrl.value.trim(),
        platform: urlValidation.value.platform!,
        type: "channel",
        isValid: true,
      },
    ]);

    if (result) {
      analysisResult.value = result;
      emit("personaUpdate", result);
      toastStore.success("分析完成！");
      showPersonaModal.value = false;

      // Save persona to Supabase
      if (authStore.user) {
        try {
          const { savePersona } = usePersonaStorage();
          const userId = authStore.authInfo.email || authStore.authInfo.sub;
          const platform = urlValidation.value.platform!;

          const savedPersona = await savePersona(
            {
              user_id: userId,
              name: `${platformLabels[platform]} 分析`,
              content: result,
              source: "media",
              source_urls: [mediaUrl.value.trim()],
              platforms: [platform],
              job_id: null,
            },
            userId
          );

          // Update user preference
          await preferencesStore.setPersonaPreference(userId, savedPersona.id);
          currentPersonaId.value = savedPersona.id;

          // Reload personas list
          await loadSavedPersonas();
          console.log("Saved persona to Supabase:", savedPersona.id);
        } catch (saveErr) {
          console.error("Failed to save persona:", saveErr);
          // Don't show error to user - analysis succeeded, just save failed
        }
      }

      mediaUrl.value = "";
    }
  } catch (err: any) {
    console.error("Media analysis failed:", err);
    toastStore.error("分析失敗", err.message || "請稍後再試");
  } finally {
    isAnalyzing.value = false;
  }
}

async function handleClearPersona() {
  analysisResult.value = null;
  analysisPlatform.value = null;
  emit("personaUpdate", "");

  // Clear persona preference in Supabase
  if (authStore.user) {
    try {
      const userId = authStore.authInfo.email || authStore.authInfo.sub;
      await preferencesStore.setPersonaPreference(userId, null);
    } catch (err) {
      console.error("Failed to clear persona preference:", err);
    }
  }
}

async function handleSelectPersona(persona: DbPersona) {
  try {
    // Apply persona
    analysisResult.value = persona.content;
    currentPersonaId.value = persona.id;
    emit("personaUpdate", persona.content);

    // Update preference
    if (authStore.user) {
      const userId = authStore.authInfo.email || authStore.authInfo.sub;
      await preferencesStore.setPersonaPreference(userId, persona.id);

      // Record usage
      const { recordPersonaUsage } = usePersonaStorage();
      await recordPersonaUsage(persona.id);
    }

    showPersonaModal.value = false;
    toastStore.success("已套用創作風格");
  } catch (err) {
    console.error("Failed to select persona:", err);
    toastStore.error("套用失敗");
  }
}

async function handleDeletePersona(personaId: string) {
  try {
    const { deletePersona } = usePersonaStorage();
    await deletePersona(personaId);

    // Remove from list
    savedPersonas.value = savedPersonas.value.filter((p) => p.id !== personaId);

    // Clear if current persona was deleted
    if (currentPersonaId.value === personaId) {
      currentPersonaId.value = null;
      analysisResult.value = null;
      emit("personaUpdate", "");

      if (authStore.user) {
        const userId = authStore.authInfo.email || authStore.authInfo.sub;
        await preferencesStore.setPersonaPreference(userId, null);
      }
    }

    toastStore.success("已刪除風格");
  } catch (err) {
    console.error("Failed to delete persona:", err);
    toastStore.error("刪除失敗");
  }
}

// Toggle expanded persona
function toggleExpandPersona(personaId: string, event: Event) {
  event.stopPropagation();
  expandedPersonaId.value =
    expandedPersonaId.value === personaId ? null : personaId;
}

// Parse title from analysis content
function parseAnalysisTitle(analysis: string): string | null {
  const lines = analysis.split("\n");
  const firstLine = lines[0]?.trim();
  if (!firstLine) return null;

  // Match pattern: "# ... - 標題名稱"
  const match = firstLine.match(/^#\s+.*?\s+-\s+(.+)$/);
  if (match) {
    return match[1].trim();
  }

  // Fallback: try to find any meaningful text after "-"
  const dashIndex = firstLine.indexOf(" - ");
  if (dashIndex !== -1) {
    return firstLine.substring(dashIndex + 3).trim();
  }

  return null;
}

function handleTitleInput(value: string) {
  generationStore.updateDraft({ title: value });
}

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
</script>

<template>
  <div class="card p-3">
    <!-- Header with topic suggestions inline -->
    <div class="flex items-center justify-between mb-2">
      <div class="flex items-center gap-2">
        <label class="text-sm font-medium text-stone-700">內容逐字稿</label>
        <span
          :class="['text-xs', isOverLimit ? 'text-red-500' : 'text-stone-400']"
        >
          {{ charCount }}/{{ maxLength }}
        </span>
      </div>
      <div class="flex items-center gap-2">
        <!-- Refresh button -->
        <button
          v-if="hasPersona"
          class="text-xs text-stone-400 hover:text-stone-600 flex items-center gap-1"
          :disabled="isLoadingTopics"
          @click="handleRefreshTopics"
        >
          <svg
            class="w-3.5 h-3.5"
            :class="{ 'animate-spin': isLoadingTopics }"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
        <!-- AI Suggestion button - prominent solid purple -->
        <button
          class="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
          @click="showPersonaModal = true"
        >
          <Sparkles class="w-4 h-4" />
          設定創作風格
        </button>
        
      </div>
    </div>

    <!-- Topic chips (compact) -->
    <div v-if="isLoadingTopics" class="flex items-center py-2">
      <svg
        class="animate-spin w-4 h-4 text-purple-500 mr-2"
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
      <span class="text-xs text-stone-500">生成中...</span>
    </div>

    <div
      v-else-if="topics.length > 0"
      class="flex gap-1.5 mb-2 overflow-x-auto scrollbar-hide"
    >
      <button
        v-for="topic in topics"
        :key="topic.id"
        class="flex-shrink-0 px-2 py-1 text-xs rounded-full transition-colors"
        :class="
          selectedTopicId === topic.id
            ? 'bg-purple-100 text-purple-700'
            : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
        "
        @click="handleSelectTopic(topic)"
      >
        {{ topic.title }}
      </button>
    </div>

    <!-- Section label -->

    <!-- Transcript textarea with mic and AI buttons -->
    <div class="relative">
      <textarea
        :value="displayTranscript"
        placeholder="輸入逐字稿..."
        class="w-full h-20 p-3 pr-24 text-sm text-stone-800 bg-stone-50 border border-stone-200 rounded-xl resize-none focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
        @input="handleInput(($event.target as HTMLTextAreaElement).value)"
      />
      <div class="absolute right-2 top-3 flex items-center gap-1">
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
          class="px-2 py-1 text-xs bg-purple-100 text-purple-600 hover:bg-purple-200 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50"
          title="AI 擴寫腳本"
          :disabled="!draft.transcript.trim() || isGenerating"
          @click="handleExpandTranscript"
        >
          <svg
            v-if="isGenerating"
            class="animate-spin w-3.5 h-3.5"
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
          <Sparkles v-else class="w-3.5 h-3.5" />
          擴寫
        </button>
      </div>
    </div>
    <!-- Title input with mic and AI buttons -->
    <div class="relative mb-2">
      <input
        :value="displayTitle"
        type="text"
        placeholder="輸入標題..."
        class="w-full px-3 py-2 pr-24 text-sm text-stone-800 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
        @input="handleTitleInput(($event.target as HTMLInputElement).value)"
      />
      <div
        class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1"
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
          class="px-2 py-1 text-xs bg-purple-100 text-purple-600 hover:bg-purple-200 rounded-lg transition-colors flex items-center gap-1"
          title="AI 生成標題"
          @click="handleGenerateTitle"
        >
          <Sparkles class="w-3.5 h-3.5" />
          生成
        </button>
      </div>
    </div>

    <!-- Persona Modal -->
    <Teleport to="body">
      <div
        v-if="showPersonaModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
        @click="showPersonaModal = false"
      >
        <div
          class="bg-white rounded-2xl overflow-hidden border border-stone-200 shadow-2xl w-[500px] max-w-[90vw]"
          @click.stop
        >
          <!-- Header -->
          <div
            class="px-4 py-3 border-b border-stone-200 flex items-center justify-between"
          >
            <h3 class="font-bold text-stone-800">讓 AI 學習你的風格</h3>
            <button
              class="p-1.5 hover:bg-stone-100 rounded-lg transition-colors"
              @click="showPersonaModal = false"
            >
              <svg
                class="w-5 h-5 text-stone-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <!-- Content -->
          <div class="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
            <!-- Saved personas list -->
            <div v-if="savedPersonas.length > 0" class="space-y-2">
              <label
                class="text-sm font-medium text-stone-600 flex items-center gap-2"
              >
                <svg
                  class="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                已儲存的風格 ({{ savedPersonas.length }})
              </label>
              <div class="space-y-2 max-h-64 overflow-y-auto">
                <div
                  v-for="persona in savedPersonas"
                  :key="persona.id"
                  class="rounded-xl border-2 cursor-pointer transition-all hover:bg-stone-50"
                  :class="
                    currentPersonaId === persona.id
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-stone-200'
                  "
                >
                  <div class="p-3" @click="handleSelectPersona(persona)">
                    <div class="flex items-center justify-between">
                      <div class="flex-1 min-w-0">
                        <div
                          class="text-sm font-medium text-stone-800 truncate"
                        >
                          {{
                            parseAnalysisTitle(persona.content) || persona.name
                          }}
                        </div>
                        <div class="text-xs text-stone-500 mt-0.5">
                          {{ persona.platforms.join(", ") }} · 已使用
                          {{ persona.use_count }} 次
                        </div>
                      </div>
                      <div class="flex items-center gap-1 ml-2">
                        <span
                          v-if="currentPersonaId === persona.id"
                          class="text-xs text-purple-600 font-medium"
                        >
                          使用中
                        </span>
                        <button
                          class="p-1.5 hover:bg-stone-200 rounded-lg transition-colors"
                          title="展開查看分析內容"
                          @click="toggleExpandPersona(persona.id, $event)"
                        >
                          <svg
                            class="w-4 h-4 text-stone-400 transition-transform duration-200"
                            :class="{
                              'rotate-180': expandedPersonaId === persona.id,
                            }"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </button>
                        <button
                          class="p-1.5 hover:bg-red-100 rounded-lg transition-colors"
                          @click.stop="handleDeletePersona(persona.id)"
                        >
                          <svg
                            class="w-4 h-4 text-stone-400 hover:text-red-500"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                  <!-- Expanded content -->
                  <Transition
                    enter-active-class="transition-all duration-200 ease-out"
                    enter-from-class="max-h-0 opacity-0"
                    enter-to-class="max-h-96 opacity-100"
                    leave-active-class="transition-all duration-200 ease-in"
                    leave-from-class="max-h-96 opacity-100"
                    leave-to-class="max-h-0 opacity-0"
                  >
                    <div
                      v-if="expandedPersonaId === persona.id"
                      class="px-3 pb-3 overflow-hidden"
                    >
                      <div class="pt-2 border-t border-stone-200">
                        <pre
                          class="text-xs text-stone-600 whitespace-pre-wrap font-sans max-h-48 overflow-y-auto"
                          >{{ persona.content }}</pre
                        >
                      </div>
                    </div>
                  </Transition>
                </div>
              </div>
            </div>

            <!-- Loading state -->
            <div
              v-else-if="isLoadingPersonas"
              class="flex items-center justify-center py-4"
            >
              <svg
                class="animate-spin w-5 h-5 text-purple-500"
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
            </div>

            <!-- Divider -->
            <div
              v-if="savedPersonas.length > 0"
              class="border-t border-stone-200 pt-4"
            >
              <label
                class="text-sm font-medium text-stone-600 flex items-center gap-2 mb-2"
              >
                <svg
                  class="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                新增風格
              </label>
            </div>

            <div>
              <label class="block text-sm font-medium text-stone-700 mb-2"
                >貼上頻道連結</label
              >
              <input
                v-model="mediaUrl"
                type="text"
                placeholder="貼上 YouTube/TikTok 連結，AI 會學習你的風格"
                class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 border-stone-300 focus:border-purple-500"
                @keyup.enter="handleAnalyzeMedia"
              />
              <p
                v-if="urlValidation.platform"
                class="mt-1 text-xs text-green-600"
              >
                已識別平台：{{ platformLabels[urlValidation.platform] }}
              </p>
              <p
                v-else-if="mediaUrl.trim() && !urlValidation.isUrl"
                class="mt-1 text-xs text-blue-600"
              >
                將作為文字描述進行分析
              </p>
            </div>

            <!-- Supported platforms with logos -->
            <div>
              <p class="text-xs text-stone-500 mb-2">支援的平台：</p>
              <div class="flex flex-wrap gap-2">
                <div
                  class="flex items-center gap-1.5 px-2 py-1 rounded-full transition-opacity"
                  :class="urlValidation.platform === 'youtube' ? 'opacity-100 bg-red-50' : 'opacity-40'"
                >
                  <PlatformLogos platform="youtube" :size="16" />
                  <span class="text-xs">YouTube</span>
                </div>
                <div
                  class="flex items-center gap-1.5 px-2 py-1 rounded-full transition-opacity"
                  :class="urlValidation.platform === 'twitch' ? 'opacity-100 bg-purple-50' : 'opacity-40'"
                >
                  <PlatformLogos platform="twitch" :size="16" />
                  <span class="text-xs">Twitch</span>
                </div>
                <div
                  class="flex items-center gap-1.5 px-2 py-1 rounded-full transition-opacity"
                  :class="urlValidation.platform === 'bilibili' ? 'opacity-100 bg-blue-50' : 'opacity-40'"
                >
                  <PlatformLogos platform="bilibili" :size="16" />
                  <span class="text-xs">Bilibili</span>
                </div>
                <div
                  class="flex items-center gap-1.5 px-2 py-1 rounded-full transition-opacity"
                  :class="urlValidation.platform === 'tiktok' ? 'opacity-100 bg-stone-100' : 'opacity-40'"
                >
                  <PlatformLogos platform="tiktok" :size="16" />
                  <span class="text-xs">TikTok</span>
                </div>
                <div
                  class="flex items-center gap-1.5 px-2 py-1 rounded-full transition-opacity"
                  :class="urlValidation.platform === 'podcast' ? 'opacity-100 bg-purple-50' : 'opacity-40'"
                >
                  <PlatformLogos platform="podcast" :size="16" />
                  <span class="text-xs">Podcast</span>
                </div>
                <div
                  class="flex items-center gap-1.5 px-2 py-1 rounded-full transition-opacity"
                  :class="urlValidation.platform === 'other' ? 'opacity-100 bg-stone-100' : 'opacity-40'"
                >
                  <PlatformLogos platform="other" :size="16" />
                  <span class="text-xs">yt-dlp</span>
                </div>
              </div>
            </div>

            <div class="p-3 bg-stone-50 rounded-xl">
              <p class="text-xs text-stone-500">
                AI 會學習你的說話方式、用詞習慣，幫你寫出符合你風格的腳本。
              </p>
            </div>
          </div>

          <!-- Footer -->
          <div
            class="px-4 py-3 border-t border-stone-200 flex justify-end gap-2"
          >
            <button
              class="px-4 py-2 text-sm text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
              @click="showPersonaModal = false"
            >
              取消
            </button>
            <button
              class="px-4 py-2 text-sm bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50 flex items-center gap-2"
              :disabled="!mediaUrl.trim() || isAnalyzing"
              @click="handleAnalyzeMedia"
            >
              <svg
                v-if="isAnalyzing"
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
              <svg
                v-else
                class="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
              {{ isAnalyzing ? "分析中..." : "開始分析" }}
              <span v-if="!isAnalyzing" class="flex items-center gap-0.5 text-white/80">
                <Gem class="w-3 h-3" />{{ ANALYSIS_TOKEN_COST }}
              </span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>

  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
