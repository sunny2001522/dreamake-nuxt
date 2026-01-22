<script setup lang="ts">
import type { SuggestedTopic, MediaPlatform, DbPersona } from "~/types";
import {
  Mic,
  Sparkles,
  Gem,
  Brain,
  Pen,
  Lightbulb,
  Check,
} from "lucide-vue-next";
import SoundWaveIndicator from "~/components/common/SoundWaveIndicator.vue";
import PlatformLogos from "~/components/icons/PlatformLogos.vue";

// Channel analysis Token cost
const ANALYSIS_TOKEN_COST = 1;

const generationStore = useGenerationStore();
const authStore = useAuthStore();
const preferencesStore = usePreferencesStore();
const toastStore = useToastStore();
const { draft } = storeToRefs(generationStore);

const pendingAnalysesStore = usePendingAnalysesStore();

// Props for persona content
const props = defineProps<{
  personaContent?: string;
}>();

// Saved personas list
const savedPersonas = ref<DbPersona[]>([]);
const isLoadingPersonas = ref(false);
const currentPersonaId = ref<string | null>(null);
const expandedPersonaId = ref<string | null>(null);

// Inline editing state
const editingPersonaId = ref<string | null>(null);
const editingField = ref<"name" | "content" | null>(null);
const editedName = ref("");
const editedContent = ref("");
const saveTimer = ref<ReturnType<typeof setTimeout> | null>(null);
const isSaving = ref(false);

// Pending analyses (for progress display)
const pendingAnalyses = computed(() => pendingAnalysesStore.analyses);

// Analysis progress animation
const analysisMessages = [
  "正在深入分析你的風格...",
  "學習中，請稍候 ☕",
  "AI 正在認真做筆記...",
  "快好了，再等一下下...",
  "正在萃取精華 ✨",
  "你的創作風格即將誕生...",
];

const analysisMessageIndex = ref(0);
const currentAnalysisMessage = computed(
  () => analysisMessages[analysisMessageIndex.value],
);
let analysisMessageTimer: ReturnType<typeof setInterval> | null = null;

// Stage simulation (since backend doesn't provide real stages)
const analysisStage = ref(0); // 0, 1, 2
let stageTimer: ReturnType<typeof setInterval> | null = null;

// Start animation when analysis begins
watch(
  () => pendingAnalyses.value.length,
  (count, oldCount) => {
    if (count > 0 && (oldCount === undefined || count > oldCount)) {
      startAnalysisAnimation();
    } else if (count === 0) {
      stopAnalysisAnimation();
    }
  },
  { immediate: true },
);

function startAnalysisAnimation() {
  analysisStage.value = 0;
  analysisMessageIndex.value = 0;

  // Rotate messages every 6 seconds
  if (analysisMessageTimer) clearInterval(analysisMessageTimer);
  analysisMessageTimer = setInterval(() => {
    analysisMessageIndex.value =
      (analysisMessageIndex.value + 1) % analysisMessages.length;
  }, 6000);

  // Progress through stages (simulated: ~2min per stage, total ~6min)
  if (stageTimer) clearInterval(stageTimer);
  stageTimer = setInterval(() => {
    if (analysisStage.value < 2) {
      analysisStage.value++;
    }
  }, 120000); // 2 minutes per stage
}

function stopAnalysisAnimation() {
  if (analysisMessageTimer) {
    clearInterval(analysisMessageTimer);
    analysisMessageTimer = null;
  }
  if (stageTimer) {
    clearInterval(stageTimer);
    stageTimer = null;
  }
  analysisStage.value = 0;
}

// Node styling (same pattern as VideoPreview)
function getAnalysisNodeClass(index: number) {
  const base =
    "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300";
  if (index < analysisStage.value) {
    return `${base} bg-gradient-to-r from-purple-500 to-pink-500 text-white`;
  }
  if (index === analysisStage.value) {
    return `${base} bg-gradient-to-r from-purple-500 to-pink-500 text-white animate-pulse ring-4 ring-purple-400/30`;
  }
  return `${base} bg-stone-300 text-stone-500`;
}

function getAnalysisLineClass(index: number) {
  const base = "w-6 h-1 rounded-full transition-all duration-300";
  if (index < analysisStage.value) {
    return `${base} bg-gradient-to-r from-purple-500 to-pink-500`;
  }
  return `${base} bg-stone-300`;
}

// Estimated time
const analysisEstimatedTime = computed(() => {
  const stagesLeft = 3 - analysisStage.value;
  const secondsLeft = stagesLeft * 120; // 2 min per stage
  if (secondsLeft <= 0) return "即將完成";
  const mins = Math.floor(secondsLeft / 60);
  return `約 ${mins} 分鐘`;
});

// Cleanup on unmount
onUnmounted(() => {
  stopAnalysisAnimation();
});

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
  () => transcriptGeneration.isLoadingTopics.value,
);
const hasPersona = computed(
  () => !!props.personaContent?.trim() || !!analysisResult.value,
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
    "feeds.fireside.fm",
    "feeds.soundon.fm",
    "anchor.fm",
    "open.firstory.me",
    "libsyn.com",
    "feeds.buzzsprout.com",
    "feeds.simplecast.com",
    "feed.podbean.com",
    "feeds.transistor.fm",
    "feeds.megaphone.fm",
    "feeds.acast.com",
  ];

  if (podcastHosts.some((h) => hostname.includes(h))) return true;
  if (
    pathname.endsWith("/rss") ||
    pathname.endsWith("/feed") ||
    pathname.endsWith(".xml")
  )
    return true;
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
  },
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
  { immediate: true },
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
            persona.name,
          );
        }
      } catch (err) {
        console.error("Failed to load saved persona:", err);
      }
    } else if (!personaId) {
      currentPersonaId.value = null;
    }
  },
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
      analysisResult.value || props.personaContent,
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
      draft.value.transcript,
      analysisResult.value || props.personaContent,
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
      topic.title,
    );
    generationStore.updateDraft({ transcript, title: topic.title });
    toastStore.success("腳本生成完成！");
  } catch (err: any) {
    console.error("Failed to generate transcript:", err);
    toastStore.error("生成失敗", err.message || "請稍後再試");
  }
}

async function handleAnalyzeMedia() {
  // 如果是純文字輸入，使用 saveTextPersona
  if (!urlValidation.value.isUrl) {
    const content = mediaUrl.value.trim();
    if (!content) {
      toastStore.warning("請輸入風格描述或頻道連結");
      return;
    }
    await saveTextPersona(content);
    return;
  }

  // URL 分析流程
  if (!urlValidation.value.isValid) {
    toastStore.warning(urlValidation.value.error || "請輸入有效的媒體網址");
    return;
  }

  try {
    isAnalyzing.value = true;
    analysisPlatform.value = urlValidation.value.platform;

    // 啟動分析任務（背景輪詢）
    await mediaAnalysis.startAnalysis([
      {
        url: mediaUrl.value.trim(),
        platform: urlValidation.value.platform!,
        type: "channel",
        isValid: true,
      },
    ]);

    // 分析已在背景進行，保持 Modal 開啟顯示進度動畫
    mediaUrl.value = "";
  } catch (err: any) {
    console.error("Media analysis failed:", err);
    toastStore.error("啟動分析失敗", err.message || "請稍後再試");
  } finally {
    isAnalyzing.value = false;
  }
}

// Cancel ongoing analysis
async function handleCancelAnalysis(jobId: string | undefined) {
  if (!jobId) return;
  await pendingAnalysesStore.cancelAnalysis(jobId);
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

async function saveTextPersona(content: string) {
  if (!authStore.user) {
    toastStore.warning("請先登入");
    return;
  }

  try {
    isAnalyzing.value = true;
    const { savePersona } = usePersonaStorage();
    const userId = authStore.authInfo.email || authStore.authInfo.sub;

    // 從內容第一行提取名稱
    const name = content.split("\n")[0].slice(0, 50) || "自訂風格";

    const persona = await savePersona(
      {
        name,
        content,
        source: "text",
        source_urls: [],
        platforms: ["text"],
        job_id: null,
        user_id: userId,
      },
      userId,
    );

    // 套用並更新 UI
    analysisResult.value = content;
    currentPersonaId.value = persona.id;
    emit("personaUpdate", content);

    // 更新偏好設定
    await preferencesStore.setPersonaPreference(userId, persona.id);

    // 重新載入 persona 列表
    await loadSavedPersonas();

    showPersonaModal.value = false;
    mediaUrl.value = "";
    toastStore.success("已儲存風格");
  } catch (err: any) {
    console.error("Failed to save text persona:", err);
    toastStore.error("儲存失敗", err.message || "請稍後再試");
  } finally {
    isAnalyzing.value = false;
  }
}

// Toggle expanded persona
function toggleExpandPersona(personaId: string, event: Event) {
  event.stopPropagation();
  expandedPersonaId.value =
    expandedPersonaId.value === personaId ? null : personaId;
}

// Get persona title (for display and editing)
function getPersonaTitle(persona: DbPersona): string {
  return parseAnalysisTitle(persona.content) || persona.name;
}

// Start inline editing
function startEditing(
  persona: DbPersona,
  field: "name" | "content",
  event: Event,
) {
  event.stopPropagation();
  editingPersonaId.value = persona.id;
  editingField.value = field;
  if (field === "name") {
    editedName.value = getPersonaTitle(persona);
  } else {
    editedContent.value = persona.content;
  }
}

// Debounced save (3 seconds after last input)
function debouncedSave(personaId: string, field: "name" | "content") {
  if (saveTimer.value) {
    clearTimeout(saveTimer.value);
  }
  saveTimer.value = setTimeout(() => {
    savePersonaEdit(personaId, field);
  }, 3000);
}

// Save persona edit
async function savePersonaEdit(personaId: string, field: "name" | "content") {
  isSaving.value = true;
  try {
    const { updatePersona } = usePersonaStorage();
    const persona = savedPersonas.value.find((p) => p.id === personaId);
    if (!persona) return;

    let newContent = persona.content;
    if (field === "name") {
      // Update the first line (title) in content
      const lines = persona.content.split("\n");
      if (lines[0]?.startsWith("#")) {
        lines[0] = `# ${editedName.value}`;
      } else {
        lines.unshift(`# ${editedName.value}`);
      }
      newContent = lines.join("\n");
    } else {
      newContent = editedContent.value;
    }

    await updatePersona(personaId, { content: newContent });
    await loadSavedPersonas();
    toastStore.success("風格已更新");
  } catch (err) {
    console.error("Failed to save persona edit:", err);
    toastStore.error("更新失敗");
  } finally {
    isSaving.value = false;
  }
}

// Finish editing (blur or enter)
async function finishEditing() {
  if (saveTimer.value) {
    clearTimeout(saveTimer.value);
    saveTimer.value = null;
  }
  // 無論 timer 狀態，只要正在編輯就儲存
  if (editingPersonaId.value && editingField.value) {
    await savePersonaEdit(editingPersonaId.value, editingField.value);
  }
  editingPersonaId.value = null;
  editingField.value = null;
}

// Get analysis name from URL
function getAnalysisName(analysis: {
  sourceUrls: string[];
  platforms: string[];
}): string {
  const url = analysis.sourceUrls[0];
  if (!url) return analysis.platforms[0] + " 頻道";
  const match = url.match(/@([^/?]+)/);
  return match ? match[1] : analysis.platforms[0] + " 頻道";
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
  () => draft.value.transcript + transcriptInterimText.value,
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
          定製腳本
        </button>
      </div>
    </div>

    <!-- Topic chips (compact) - Skeleton loading -->
    <div v-if="isLoadingTopics" class="flex gap-1.5 mb-2 py-1">
      <div
        v-for="i in 4"
        :key="i"
        class="animate-pulse h-6 bg-stone-200 rounded-full"
        :style="{ width: `${60 + i * 10}px` }"
      />
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
        @mousedown.self="showPersonaModal = false"
      >
        <div
          class="bg-white rounded-2xl overflow-hidden border border-stone-200 shadow-2xl w-125 max-w-[90vw]"
          @click.stop
        >
          <!-- Header -->
          <div
            class="px-4 py-3 border-b border-stone-200 flex items-center justify-between"
          >
            <h3 class="font-bold text-stone-800">讓 AI 學習你的人格與記憶</h3>
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
            <!-- Pending analyses progress - 3 stage animation -->
            <div v-if="pendingAnalyses.length > 0" class="space-y-4">
              <div
                class="bg-gradient-to-br from-purple-900 to-stone-900 rounded-2xl p-6 text-center"
              >
                <!-- 3-stage timeline -->
                <div class="flex items-center justify-center gap-1 mb-3">
                  <!-- Stage 1: 人格腦 -->
                  <div class="flex flex-col items-center gap-1.5">
                    <div :class="getAnalysisNodeClass(0)">
                      <Check v-if="analysisStage > 0" class="w-5 h-5" />
                      <Brain v-else class="w-5 h-5" />
                    </div>
                    <span class="text-white/60 text-xs">人格腦</span>
                  </div>

                  <!-- Line 1 -->
                  <div :class="getAnalysisLineClass(0)" class="mb-5" />

                  <!-- Stage 2: 記憶腦 -->
                  <div class="flex flex-col items-center gap-1.5">
                    <div :class="getAnalysisNodeClass(1)">
                      <Check v-if="analysisStage > 1" class="w-5 h-5" />
                      <Sparkles v-else class="w-5 h-5" />
                    </div>
                    <span class="text-white/60 text-xs">記憶腦</span>
                  </div>

                  <!-- Line 2 -->
                  <div :class="getAnalysisLineClass(1)" class="mb-5" />

                  <!-- Stage 3: 創作腦 -->
                  <div class="flex flex-col items-center gap-1.5">
                    <div :class="getAnalysisNodeClass(2)">
                      <Check v-if="analysisStage > 2" class="w-5 h-5" />
                      <Pen v-else class="w-5 h-5" />
                    </div>
                    <span class="text-white/60 text-xs">創作腦</span>
                  </div>
                </div>

                <!-- Encouraging message -->
                <p class="text-white text-lg font-medium mb-2">
                  {{ currentAnalysisMessage }}
                </p>

                <!-- Channel name being analyzed -->
                <p class="text-white/70 text-sm mb-3">
                  正在分析：{{ getAnalysisName(pendingAnalyses[0]) }}
                </p>

                <!-- Hint: can close -->
                <div
                  class="flex items-center justify-center gap-1.5 text-white/50 text-xs mb-4"
                >
                  <Lightbulb class="w-3.5 h-3.5" />
                  <span
                    >預估還需
                    {{ analysisEstimatedTime }}，可以先離開，萃取好會有 Toast
                    通知</span
                  >
                </div>

                <!-- Cancel button -->
                <button
                  class="px-4 py-2 text-sm text-white/70 hover:text-white border border-white/30 hover:border-white/50 rounded-lg transition-colors"
                  @click="handleCancelAnalysis(pendingAnalyses[0]?.jobId)"
                >
                  取消分析
                </button>
              </div>
            </div>

            <!-- 新增風格 section (moved above saved personas) -->
            <div>
              <label class="block text-sm font-medium text-stone-700 mb-2"
                >新增人格與記憶</label
              >
              <textarea
                v-model="mediaUrl"
                rows="2"
                placeholder="貼上社群連結或輸入設定，AI 會學習你的說話方式、用詞習慣，幫你寫出符合你風格的腳本"
                class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 border-stone-300 focus:border-purple-500 resize-none"
              />

              <!-- Supported platforms with logos -->
              <div class="mt-1">
                <div class="flex flex-wrap gap-2">
                  <div
                    class="flex items-center gap-1.5 px-2 py-1 rounded-full transition-opacity"
                    :class="
                      urlValidation.platform === 'youtube'
                        ? 'opacity-100 bg-red-50'
                        : 'opacity-40'
                    "
                  >
                    <PlatformLogos platform="youtube" :size="16" />
                    <span class="text-xs">YouTube</span>
                  </div>
                  <div
                    class="flex items-center gap-1.5 px-2 py-1 rounded-full transition-opacity"
                    :class="
                      urlValidation.platform === 'twitch'
                        ? 'opacity-100 bg-purple-50'
                        : 'opacity-40'
                    "
                  >
                    <PlatformLogos platform="twitch" :size="16" />
                    <span class="text-xs">Twitch</span>
                  </div>
                  <div
                    class="flex items-center gap-1.5 px-2 py-1 rounded-full transition-opacity"
                    :class="
                      urlValidation.platform === 'bilibili'
                        ? 'opacity-100 bg-blue-50'
                        : 'opacity-40'
                    "
                  >
                    <PlatformLogos platform="bilibili" :size="16" />
                    <span class="text-xs">Bilibili</span>
                  </div>
                  <div
                    class="flex items-center gap-1.5 px-2 py-1 rounded-full transition-opacity"
                    :class="
                      urlValidation.platform === 'tiktok'
                        ? 'opacity-100 bg-stone-100'
                        : 'opacity-40'
                    "
                  >
                    <PlatformLogos platform="tiktok" :size="16" />
                    <span class="text-xs">TikTok</span>
                  </div>
                  <div
                    class="flex items-center gap-1.5 px-2 py-1 rounded-full transition-opacity"
                    :class="
                      urlValidation.platform === 'podcast'
                        ? 'opacity-100 bg-purple-50'
                        : 'opacity-40'
                    "
                  >
                    <PlatformLogos platform="podcast" :size="16" />
                    <span class="text-xs">Podcast</span>
                  </div>
                </div>
              </div>
              <!-- 開始分析/新增人格設定 button directly below input -->
              <button
                class="w-full mt-3 px-4 py-2 text-sm bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                :disabled="!mediaUrl.trim()"
                @click="handleAnalyzeMedia"
              >
                <svg
                  v-if="urlValidation.isUrl"
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
                <span>{{ urlValidation.isUrl ? '開始分析' : '新增人格設定' }}</span>
                <span v-if="urlValidation.isUrl" class="flex items-center gap-0.5 text-white/80">
                  <Gem class="w-3 h-3" />{{ ANALYSIS_TOKEN_COST }}
                </span>
              </button>
            </div>

            <!-- Divider -->
            <div
              v-if="savedPersonas.length > 0"
              class="border-t border-stone-200 pt-4"
            />

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
              <div class="space-y-2">
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
                        <!-- Editable name -->
                        <div
                          v-if="
                            editingPersonaId === persona.id &&
                            editingField === 'name'
                          "
                          class="flex items-center gap-2"
                          @click.stop
                        >
                          <input
                            v-model="editedName"
                            type="text"
                            class="flex-1 text-sm font-medium text-stone-800 bg-transparent border-b-2 border-purple-500 outline-none py-0.5"
                            autofocus
                            @input="debouncedSave(persona.id, 'name')"
                            @blur="finishEditing"
                            @keydown.enter="finishEditing"
                          />
                          <span
                            v-if="isSaving"
                            class="text-xs text-purple-500 animate-pulse flex-shrink-0"
                            >儲存中...</span
                          >
                        </div>
                        <div
                          v-else
                          class="text-sm font-medium text-stone-800 truncate cursor-pointer hover:text-purple-600 transition-colors"
                          title="點擊編輯名稱"
                          @click="startEditing(persona, 'name', $event)"
                        >
                          {{ getPersonaTitle(persona) }}
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
                        <!-- Editable content -->
                        <div
                          v-if="
                            editingPersonaId === persona.id &&
                            editingField === 'content'
                          "
                          @click.stop
                        >
                          <textarea
                            v-model="editedContent"
                            class="w-full h-48 text-xs text-stone-600 whitespace-pre-wrap font-sans bg-stone-50 border-2 border-purple-500 rounded-lg p-2 outline-none resize-none"
                            autofocus
                            @input="debouncedSave(persona.id, 'content')"
                            @blur="finishEditing"
                          />
                          <div class="flex justify-end mt-1">
                            <span
                              v-if="isSaving"
                              class="text-xs text-purple-500 animate-pulse"
                              >儲存中...</span
                            >
                          </div>
                        </div>
                        <pre
                          v-else
                          class="text-xs text-stone-600 whitespace-pre-wrap font-sans max-h-48 overflow-y-auto cursor-pointer hover:bg-stone-50 rounded p-1 transition-colors"
                          title="點擊編輯內容"
                          @click="startEditing(persona, 'content', $event)"
                          >{{ persona.content }}</pre
                        >
                      </div>
                    </div>
                  </Transition>
                </div>
              </div>
            </div>

            <!-- Loading state - Skeleton cards -->
            <div v-else-if="isLoadingPersonas" class="space-y-2">
              <div
                v-for="i in 3"
                :key="i"
                class="animate-pulse rounded-xl border-2 border-stone-200 p-3"
              >
                <div class="flex items-center justify-between">
                  <div class="flex-1">
                    <div class="h-4 w-32 bg-stone-200 rounded mb-2" />
                    <div class="h-3 w-24 bg-stone-100 rounded" />
                  </div>
                  <div class="flex gap-1">
                    <div class="h-6 w-6 bg-stone-200 rounded-lg" />
                    <div class="h-6 w-6 bg-stone-200 rounded-lg" />
                  </div>
                </div>
              </div>
            </div>
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
