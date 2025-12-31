<script setup lang="ts">
import type { GenerationRecord } from "~/types";

definePageMeta({
  layout: "default",
});
// Note: auth is handled by auth.global.ts middleware

const authStore = useAuthStore();
const generationStore = useGenerationStore();
const preferencesStore = usePreferencesStore();
const subscriptionStore = useSubscriptionStore();
const toastStore = useToastStore();
const router = useRouter();

// Token 相關
const showUpgradeModal = ref(false);
const requiredTokens = ref(0);
const { tokenBalance } = storeToRefs(subscriptionStore);

const { draft, isGenerating } = storeToRefs(generationStore);

// 監聽照片、聲音、逐字稿變化，清空歷史預覽（不包含標題）
watch(
  () => ({
    avatar: draft.value.avatarPreview,
    voice: draft.value.voicePreview?.speakerId,
    transcript: draft.value.transcript,
  }),
  (newVal, oldVal) => {
    // 只有在有歷史預覽時才需要清空
    if (generationStore.generatedResult && oldVal) {
      if (
        newVal.avatar !== oldVal.avatar ||
        newVal.voice !== oldVal.voice ||
        newVal.transcript !== oldVal.transcript
      ) {
        generationStore.generatedResult = null;
      }
    }
  }
);

// 監聽歷史載入，滾動到預覽區域
// 注意：字幕生成已經在 stores/generation.ts 的 loadFromHistory 中直接處理
watch(
  () => generationStore.generatedResult,
  async (newResult, oldResult) => {
    // 只處理新載入的結果
    if (!newResult || newResult === oldResult) return;

    // 從歷史載入時滾動到預覽區域
    if (generationStore.isLoadingFromHistory) {
      await nextTick();
      previewRef.value?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }
);

// Persona content for topic suggestions
const personaContent = ref("");

// Mobile modals
const showSettingsModal = ref(false);

// Desktop history sidebar
const showHistorySidebar = ref(false);

// Preview area ref for scroll
const previewRef = ref<HTMLElement | null>(null);

// Ref to ImageUploader and VoicePicker for direct modal access
const imageUploaderRef = ref<{ openModal: () => void } | null>(null);
const voicePickerRef = ref<{ openModal: () => void } | null>(null);

function handleOpenImagePicker() {
  imageUploaderRef.value?.openModal();
}

function handleOpenVoicePicker() {
  voicePickerRef.value?.openModal();
}

function handlePersonaUpdate(content: string) {
  personaContent.value = content;
}

// Load user data on mount
onMounted(async () => {
  if (authStore.user) {
    // Use CMoney email as user identifier for data association
    const userId = authStore.authInfo.email || authStore.authInfo.sub;
    await Promise.all([
      generationStore.loadDraft(userId),
      preferencesStore.loadPreferences(userId),
    ]);

    // Load saved persona if exists
    const personaId = preferencesStore.preferences?.persona_id;
    if (personaId) {
      try {
        const { getPersonaById } = usePersonaStorage();
        const persona = await getPersonaById(personaId);
        if (persona) {
          personaContent.value = persona.content;
        }
      } catch (err) {
        console.error("Failed to load saved persona:", err);
      }
    }
  }
});

// Generation handlers for mobile toolbar
const videoGeneration = useVideoGeneration();

// Subtitle generation helper
// 優化：只傳 URL 給後端，讓後端直接下載音檔（避免前端下載再上傳的雙重傳輸）
async function generateSubtitles(audioUrl: string, transcript: string) {
  if (!draft.value.subtitleEnabled) return;

  const startTime = Date.now();
  console.log("[Subtitle] Start generating...", { audioUrl: audioUrl.substring(0, 50) });

  try {
    generationStore.setLoadingSubtitles(true);

    // 只傳 URL，讓後端下載音檔（減少 60-80% 傳輸時間）
    const response = await $fetch("/api/subtitle", {
      method: "POST",
      body: {
        audioUrl,
        transcript,
      },
    });

    const result = response as {
      segments: Array<{ text: string; startTime: number; endTime: number }>;
      hasTimestamps: boolean;
      source: string;
      timings?: Record<string, number>;
    };

    generationStore.setSubtitleSegments(result.segments, result.hasTimestamps);

    const totalTime = Date.now() - startTime;
    console.log(`[Subtitle] Completed in ${totalTime}ms`, {
      count: result.segments.length,
      hasTimestamps: result.hasTimestamps,
      source: result.source,
      serverTimings: result.timings,
    });
  } catch (err) {
    const totalTime = Date.now() - startTime;
    console.error(`[Subtitle] Failed after ${totalTime}ms:`, err);
    // Fallback: generate simple text segments
    const segments = simpleTextSegmentation(transcript);
    generationStore.setSubtitleSegments(segments, false);
  } finally {
    generationStore.setLoadingSubtitles(false);
  }
}

// Simple text segmentation fallback
function simpleTextSegmentation(transcript: string) {
  const cleanText = transcript
    .replace(/[，。！？、；：""''（）【】《》\s]+/g, "")
    .trim();
  if (!cleanText) return [];

  const segments: Array<{ text: string; startTime: number; endTime: number }> =
    [];
  const minChars = 6;
  const maxChars = 10;

  let i = 0;
  while (i < cleanText.length) {
    const remainingChars = cleanText.length - i;
    let segmentLength = Math.min(maxChars, remainingChars);

    if (remainingChars <= maxChars) {
      segmentLength = remainingChars;
    } else if (remainingChars - maxChars < minChars) {
      segmentLength = Math.ceil(remainingChars / 2);
    }

    segments.push({
      text: cleanText.slice(i, i + segmentLength),
      startTime: -1,
      endTime: -1,
    });
    i += segmentLength;
  }
  return segments;
}

async function handleGenerateVoice() {
  if (
    !draft.value.transcript.trim() ||
    !draft.value.avatarPreview ||
    !draft.value.voicePreview?.speakerId
  ) {
    toastStore.warning("請先填寫腳本、選擇頭像和語音");
    return;
  }

  if (!authStore.user) {
    toastStore.error("請先登入帳號以使用生成功能");
    const { $manager } = useNuxtApp();
    await authStore.login($manager as any, "/create");
    return;
  }

  // Token 檢查
  const userId = authStore.authInfo.sub;
  const estimatedMinutes = Math.ceil(draft.value.transcript.length / 200); // 約 200 字/分鐘
  const tokenCheck = await subscriptionStore.checkTokens(userId, 'voice_tts', estimatedMinutes);

  if (!tokenCheck.sufficient) {
    requiredTokens.value = tokenCheck.cost;
    showUpgradeModal.value = true;
    return;
  }

  try {
    generationStore.resetGeneration();
    generationStore.setStage("voice");
    generationStore.setError(null);

    const speakerId = draft.value.voicePreview!.speakerId!;
    const result = await videoGeneration.generateVoice(
      speakerId,
      draft.value.transcript
    );

    // 消耗 Token
    await subscriptionStore.consumeTokens(userId, 'voice_tts', {
      durationMinutes: estimatedMinutes,
      description: `語音合成: ${draft.value.transcript.substring(0, 20)}...`,
    });

    // Generate subtitles from audio
    if (draft.value.subtitleEnabled) {
      generationStore.setStage("subtitle");
      await generateSubtitles(result.audioUrl, draft.value.transcript);
    }

    const record: GenerationRecord = {
      id: Date.now().toString(),
      transcript: draft.value.transcript,
      aspectRatio: draft.value.aspectRatio,
      duration: 0,
      createdAt: new Date(),
      status: "completed",
      audioUrl: result.audioUrl,
      speakerId,
      title: draft.value.title || undefined,
      avatarPreview: draft.value.avatarPreview,
    };

    generationStore.setResult(record);
    generationStore.setStage("complete");
    toastStore.success("語音生成完成！");
  } catch (err: any) {
    console.error("Voice generation failed:", err);
    generationStore.setError(err.message || "語音生成失敗");
    generationStore.setStage("error");
    toastStore.error("語音生成失敗", err.message);
  }
}

async function handleGenerateVideo() {
  if (
    !draft.value.transcript.trim() ||
    !draft.value.avatarPreview ||
    !draft.value.voicePreview?.speakerId
  ) {
    toastStore.warning("請先填寫腳本、選擇頭像和語音");
    return;
  }

  if (!authStore.user) {
    toastStore.error("請先登入帳號以使用生成功能");
    const { $manager } = useNuxtApp();
    await authStore.login($manager as any, "/create");
    return;
  }

  // Token 檢查 - 影片生成（按預估時長計算）
  const userId = authStore.authInfo.sub;
  const estimatedMinutes = Math.ceil(draft.value.transcript.length / 200); // 約 200 字/分鐘
  const tokenCheck = await subscriptionStore.checkTokens(userId, 'video_generation', estimatedMinutes);

  if (!tokenCheck.sufficient) {
    requiredTokens.value = tokenCheck.cost;
    showUpgradeModal.value = true;
    return;
  }

  try {
    generationStore.resetGeneration();
    generationStore.setStage("voice");

    const speakerId = draft.value.voicePreview!.speakerId!;
    const avatarUrl = draft.value.avatarPreview;

    const result = await videoGeneration.startGeneration({
      transcript: draft.value.transcript,
      speakerId,
      avatarUrl,
      aspectRatio: draft.value.aspectRatio,
      videoModel: draft.value.videoModel,
      waveSpeedPrompt: draft.value.waveSpeedPrompt,
    });

    // Generate subtitles in parallel with video generation
    if (draft.value.subtitleEnabled) {
      generationStore.setStage("subtitle");
      await generateSubtitles(result.audioUrl, draft.value.transcript);
    }

    generationStore.setStage("video");
    const videoResult = await videoGeneration.pollUntilComplete(
      result.taskId,
      result.pollEndpoint
    );

    // Upload video to Supabase Storage for permanent URL
    const { uploadVideoToStorage } = useVideoStorage();
    const userId = authStore.authInfo.email || authStore.authInfo.sub;
    let permanentVideoUrl = videoResult.videoUrl;

    try {
      toastStore.info("正在保存影片...");
      permanentVideoUrl = await uploadVideoToStorage(
        videoResult.videoUrl,
        userId
      );
    } catch (uploadErr) {
      console.warn(
        "Failed to upload video to storage, using original URL:",
        uploadErr
      );
      // If upload fails, still use original URL (though it may expire)
    }

    const record: GenerationRecord = {
      id: Date.now().toString(),
      transcript: draft.value.transcript,
      aspectRatio: draft.value.aspectRatio,
      duration: 0,
      createdAt: new Date(),
      status: "completed",
      audioUrl: result.audioUrl,
      videoUrl: permanentVideoUrl,
      speakerId,
      title: draft.value.title || undefined,
      avatarPreview: avatarUrl,
    };

    generationStore.setResult(record);
    generationStore.setStage("complete");

    // 消耗 Token
    await subscriptionStore.consumeTokens(userId, 'video_generation', {
      durationMinutes: estimatedMinutes,
      description: `影片生成: ${draft.value.transcript.substring(0, 20)}...`,
    });

    toastStore.success("影片生成完成！");
  } catch (err: any) {
    console.error("Video generation failed:", err);
    generationStore.setError(err.message || "影片生成失敗");
    generationStore.setStage("error");
    toastStore.error("影片生成失敗", err.message);
  }
}
</script>

<template>
  <!-- Mobile Layout -->
  <div class="lg:hidden h-[calc(100vh-64px)] flex flex-col overflow-hidden">
    <div class="flex-1 flex flex-col min-h-0 px-4 py-2 gap-2 pb-20">
      <!-- Preview Area (Flexible) -->
      <div
        ref="previewRef"
        class="relative flex-1 min-h-0 flex items-center justify-center"
      >
        <CreateVideoPreview class="w-full h-full" />
        <!-- History button -->
        <NuxtLink
          to="/history"
          class="absolute top-2 right-2 flex items-center gap-1 px-3 py-1.5 bg-white/90 backdrop-blur rounded-full text-sm text-stone-600 shadow-sm"
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
        </NuxtLink>
      </div>

      <!-- Topic Suggestions -->
      <CreateMobileTopicSuggestions
        class="flex-shrink-0"
        :persona-content="personaContent"
        @persona-update="handlePersonaUpdate"
      />

      <!-- Transcript Input (Simplified) -->
      <CreateMobileTranscriptInput class="flex-shrink-0" />
    </div>

    <!-- Mobile Bottom Toolbar -->
    <CreateMobileToolbar
      @open-image-picker="handleOpenImagePicker"
      @open-voice-picker="handleOpenVoicePicker"
      @open-settings="showSettingsModal = true"
      @generate-voice="handleGenerateVoice"
      @generate-video="handleGenerateVideo"
    />

    <!-- Hidden VoicePicker for mobile (modal is teleported to body) -->
    <VoicePicker ref="voicePickerRef" class="hidden" />

    <!-- Settings Modal -->
    <Teleport to="body">
      <div
        v-if="showSettingsModal"
        class="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
        @click="showSettingsModal = false"
      >
        <div
          class="w-full max-h-[80vh] bg-white rounded-t-2xl overflow-hidden"
          @click.stop
        >
          <div class="flex items-center justify-between px-4 py-3 border-b">
            <h3 class="font-medium">設定</h3>
            <button @click="showSettingsModal = false" class="p-1">
              <svg
                class="w-5 h-5"
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
          <div class="p-4 overflow-y-auto max-h-[60vh] space-y-4">
            <CreateSubtitleSettings />
            <CreateVideoModelSelector />
          </div>
        </div>
      </div>
    </Teleport>
  </div>

  <!-- Desktop Layout -->
  <div class="hidden lg:block h-[calc(100vh-64px)] overflow-hidden">
    <div class="container mx-auto px-4 h-full">
      <div class="grid grid-cols-2 gap-6 py-3 h-full">
        <!-- Left Column: Inputs -->
        <div class="relative h-full overflow-y-auto space-y-3">
          <!-- Step 1 & 2: Image on left, Voice + Subtitle on right -->
          <div class="grid grid-cols-2 gap-3">
            <!-- 左邊：圖片上傳 -->
            <ImageUploader ref="imageUploaderRef" />

            <!-- 右邊：聲音 + 字幕設定垂直排列 -->
            <div class="flex flex-col gap-3">
              <VoicePicker />
              <CreateSubtitleSettings />
            </div>
          </div>

          <!-- Step 3: Transcript Input (includes PersonaPanel trigger + TopicSuggestions) -->
          <CreateTranscriptInput
            :persona-content="personaContent"
            @persona-update="handlePersonaUpdate"
          />

          <!-- Generate Buttons with inline settings -->
          <CreateGenerateButtons />

          <!-- Generating Overlay -->
          <div
            v-if="isGenerating"
            class="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center overflow-hidden rounded-lg"
          >
            <div class="ripple-container">
              <div class="ripple"></div>
              <div class="ripple"></div>
              <div class="ripple"></div>
            </div>
          </div>
        </div>

        <!-- Right Column: Preview -->
        <div class="h-full flex flex-col min-h-0">
          <!-- Video Preview -->
          <div class="relative flex-1 min-h-0 flex items-center justify-center">
            <CreateVideoPreview />
            <!-- Desktop History button -->
            <!-- <button
              @click="showHistorySidebar = true"
              class="absolute top-2 right-2 flex items-center gap-1.5 px-3 py-1.5 bg-white/90 backdrop-blur rounded-full text-sm text-stone-600 shadow-sm hover:bg-white hover:shadow-md transition-all"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>歷史</span>
            </button> -->
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Desktop History Sidebar -->
  <CreateHistorySidebar v-model="showHistorySidebar" />

  <!-- Token 不足升級 Modal -->
  <CommonUpgradeModal
    v-model="showUpgradeModal"
    :required-tokens="requiredTokens"
    :current-balance="tokenBalance"
  />
</template>

<style scoped>
.ripple-container {
  position: relative;
  width: 120px;
  height: 120px;
}

.ripple {
  position: absolute;
  inset: 0;
  border: 3px solid #a855f7;
  border-radius: 50%;
  opacity: 0;
  animation: ripple 2s cubic-bezier(0, 0.2, 0.8, 1) infinite;
}

.ripple:nth-child(2) {
  animation-delay: 0.5s;
}

.ripple:nth-child(3) {
  animation-delay: 1s;
}

@keyframes ripple {
  0% {
    transform: scale(0);
    opacity: 1;
  }
  100% {
    transform: scale(1);
    opacity: 0;
  }
}
</style>
