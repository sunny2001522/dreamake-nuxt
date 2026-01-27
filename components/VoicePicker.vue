<script setup lang="ts">
import type { SavedVoice, PendingAudioFile } from "~/types";
import {
  ensureCompatibleFormat,
  getMediaDuration,
} from "~/utils/audioConverter";
import {
  Gem,
  CirclePlus,
  Loader2,
  CheckCircle,
  XCircle,
  Trash2,
  CloudUpload,
} from "lucide-vue-next";

const generationStore = useGenerationStore();
const authStore = useAuthStore();
const preferencesStore = usePreferencesStore();
const toastStore = useToastStore();
const { draft } = storeToRefs(generationStore);

// Voice clone Token cost
const CLONE_TOKEN_COST = 10;

// Constants
const MIN_AUDIO_DURATION = 20;
const MAX_AUDIO_DURATION = 40;

// Modal state
const showModal = ref(false);
const isDragging = ref(false);

// Saved voices
const savedVoices = ref<SavedVoice[]>([]);
const isLoadingVoices = ref(false);
const deletingId = ref<string | null>(null);

// Recording state
const isRecording = ref(false);
const recordingDuration = ref(0);
const recordingTimer = ref<NodeJS.Timeout | null>(null);
const mediaRecorder = ref<MediaRecorder | null>(null);
const audioChunks = ref<Blob[]>([]);

// Upload state
const isProcessing = ref(false);
const uploadProgress = ref<string | null>(null);

// Multi-file upload state
const pendingFiles = ref<PendingAudioFile[]>([]);
const customVoiceName = ref("");
const MAX_PENDING_FILES = 5;

// File input ref
const fileInputRef = ref<HTMLInputElement | null>(null);

// Cloning state
const isCloning = ref(false);
const cloningVoiceName = ref<string | null>(null);

// Audio preview state
const previewingVoiceId = ref<string | null>(null);
const previewAudio = ref<HTMLAudioElement | null>(null);
const generatingPreviewId = ref<string | null>(null);
const previewCache = ref<Map<string, string>>(new Map());

// Load saved voices on mount
onMounted(() => {
  if (authStore.user) {
    loadSavedVoices();
  }
});

// Watch for auth changes
watch(
  () => authStore.user,
  (user) => {
    if (user) {
      loadSavedVoices();
    } else {
      savedVoices.value = [];
    }
  }
);

// Watch for preferences changes and apply default voice
watch(
  () => preferencesStore.preferences?.voice_id,
  async (voiceId) => {
    // Only apply if we don't already have a voice selected
    if (voiceId && !draft.value.voicePreview) {
      // Find the voice in savedVoices
      const matchedVoice = savedVoices.value.find(
        (v) => v.supabaseId === voiceId
      );
      if (matchedVoice) {
        applyDefaultVoice(matchedVoice);
        console.log(
          "Applied default voice from preferences:",
          matchedVoice.name
        );
      }
    }
  }
);

// Also check after savedVoices are loaded
watch(savedVoices, (voices) => {
  const voiceId = preferencesStore.preferences?.voice_id;
  if (voiceId && voices.length > 0 && !draft.value.voicePreview) {
    const matchedVoice = voices.find((v) => v.supabaseId === voiceId);
    if (matchedVoice) {
      applyDefaultVoice(matchedVoice);
      console.log("Applied default voice after loading:", matchedVoice.name);
    }
  }
});

// Apply default voice without closing modal
function applyDefaultVoice(voice: SavedVoice) {
  generationStore.setVoice(voice);
}

// Calculate voice clone Token cost
const cloneTokenCost = computed(() => CLONE_TOKEN_COST);

// Display text for clone cost
const cloneCostDisplay = computed(() => null);

// Filter voices with valid speakerId
const validVoices = computed(() =>
  savedVoices.value.filter((v) => v.speakerId)
);

// 解析 originalFileName 為音檔陣列
const parseSourceFiles = (originalFileName: string): string[] => {
  if (!originalFileName) return [];
  return originalFileName.split(", ").filter(Boolean);
};

// Multi-file upload computed properties
const readyFiles = computed(() =>
  pendingFiles.value.filter((f) => f.status === "ready")
);

const hasProcessingFiles = computed(() =>
  pendingFiles.value.some((f) => f.status === "processing")
);

const canClone = computed(
  () =>
    readyFiles.value.length > 0 && !isCloning.value && !hasProcessingFiles.value
);

const defaultVoiceName = computed(
  () => pendingFiles.value[0]?.name.replace(/\.[^.]+$/, "") || ""
);

const effectiveVoiceName = computed(
  () => customVoiceName.value.trim() || defaultVoiceName.value
);

async function loadSavedVoices() {
  if (!authStore.user) return;

  try {
    isLoadingVoices.value = true;
    const { getAllVoices } = useVoiceStorage();
    const userId = authStore.authInfo.email || authStore.authInfo.sub;

    const dbVoices = await getAllVoices(userId);

    savedVoices.value = dbVoices.map((voice) => ({
      id: parseInt(voice.id) || undefined,
      supabaseId: voice.id,
      name: voice.name,
      speakerId: voice.speaker_id,
      originalFileName: voice.original_file_name,
      audioUrl: voice.audio_url || undefined,
      audioMimeType: voice.audio_mime_type || undefined,
      createdAt: new Date(voice.created_at),
      lastUsedAt: new Date(voice.last_used_at),
      useCount: voice.use_count,
    }));
  } catch (err) {
    console.error("Failed to load saved voices:", err);
  } finally {
    isLoadingVoices.value = false;
  }
}

function handleClick() {
  openModal();
}

function openModal() {
  showModal.value = true;
}

defineExpose({ openModal });

function handleCloseModal() {
  stopRecording();
  showModal.value = false;
}

// Recording functions
async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";

    mediaRecorder.value = new MediaRecorder(stream, { mimeType });
    audioChunks.value = [];

    mediaRecorder.value.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.value.push(event.data);
      }
    };

    mediaRecorder.value.onstop = async () => {
      stream.getTracks().forEach((track) => track.stop());

      if (audioChunks.value.length > 0) {
        const audioBlob = new Blob(audioChunks.value, { type: mimeType });
        await processRecordedAudio(audioBlob);
      }
    };

    mediaRecorder.value.start(100);
    isRecording.value = true;
    recordingDuration.value = 0;

    // Start timer
    recordingTimer.value = setInterval(() => {
      recordingDuration.value++;

      // Auto-stop at max duration
      if (recordingDuration.value >= MAX_AUDIO_DURATION) {
        stopRecording();
      }
    }, 1000);
  } catch (err) {
    console.error("Failed to start recording:", err);
    toastStore.error("無法啟動麥克風");
  }
}

function stopRecording() {
  if (recordingTimer.value) {
    clearInterval(recordingTimer.value);
    recordingTimer.value = null;
  }

  if (mediaRecorder.value && isRecording.value) {
    mediaRecorder.value.stop();
    isRecording.value = false;
  }
}

async function processRecordedAudio(blob: Blob) {
  if (recordingDuration.value < MIN_AUDIO_DURATION) {
    toastStore.warning(`錄音太短，請至少錄製 ${MIN_AUDIO_DURATION} 秒`);
    return;
  }

  try {
    isProcessing.value = true;
    uploadProgress.value = "處理中...";

    // Create a file from the blob
    const fileName = `recording-${Date.now()}.webm`;
    const file = new File([blob], fileName, { type: blob.type });

    // Clone the voice
    await cloneVoice(file, `語音 ${new Date().toLocaleDateString("zh-TW")}`);
  } finally {
    isProcessing.value = false;
    uploadProgress.value = null;
  }
}

// Upload handling
function handleDragOver(event: DragEvent) {
  event.preventDefault();
  event.stopPropagation();
  isDragging.value = true;
}

function handleDragLeave(event: DragEvent) {
  event.preventDefault();
  event.stopPropagation();
  isDragging.value = false;
}

async function handleDrop(event: DragEvent) {
  event.preventDefault();
  event.stopPropagation();
  isDragging.value = false;

  const files = event.dataTransfer?.files;
  if (!files || files.length === 0) return;

  // Add multiple files
  for (const file of Array.from(files)) {
    await addPendingFile(file);
  }
}

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = input.files;
  if (!files || files.length === 0) return;

  // Add multiple files
  for (const file of Array.from(files)) {
    addPendingFile(file);
  }

  // Reset input
  if (fileInputRef.value) {
    fileInputRef.value.value = "";
  }
}

// Multi-file upload functions
async function addPendingFile(file: File) {
  // Check max files limit
  if (pendingFiles.value.length >= MAX_PENDING_FILES) {
    toastStore.warning(`最多只能上傳 ${MAX_PENDING_FILES} 個檔案`);
    return;
  }

  // Validate file type
  const validTypes = ["audio/", "video/"];
  if (!validTypes.some((type) => file.type.startsWith(type))) {
    toastStore.warning("請上傳音訊或影片檔案");
    return;
  }

  const id = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const isVideo = file.type.startsWith("video/");

  // Add file with processing status
  pendingFiles.value.push({
    id,
    file,
    name: file.name,
    duration: 0,
    status: "processing",
    wasTrimmed: false,
    isFromVideo: isVideo,
  });

  try {
    // Get original duration
    const originalDuration = await getMediaDuration(file);

    // Process file (convert to WAV, trim to 40s)
    const processedFile = await ensureCompatibleFormat(file);
    const finalDuration = Math.min(originalDuration, MAX_AUDIO_DURATION);

    // Update file state
    const idx = pendingFiles.value.findIndex((f) => f.id === id);
    if (idx !== -1) {
      pendingFiles.value[idx] = {
        ...pendingFiles.value[idx],
        processedFile,
        duration: finalDuration,
        originalDuration,
        wasTrimmed: originalDuration > MAX_AUDIO_DURATION,
        status: "ready",
      };
    }
  } catch (error: any) {
    const idx = pendingFiles.value.findIndex((f) => f.id === id);
    if (idx !== -1) {
      pendingFiles.value[idx].status = "error";
      pendingFiles.value[idx].error = error.message || "處理失敗";
    }
  }
}

function removePendingFile(id: string) {
  pendingFiles.value = pendingFiles.value.filter((f) => f.id !== id);
}

function clearPendingFiles() {
  pendingFiles.value = [];
  customVoiceName.value = "";
}

async function cloneVoice(file: File, name: string) {
  try {
    isCloning.value = true;
    cloningVoiceName.value = name;
    uploadProgress.value = "壓縮音檔中...";

    // Convert audio to compressed WAV format for API compatibility
    let processedFile: File;
    try {
      processedFile = await ensureCompatibleFormat(file);
      console.log("Audio processed:", {
        original: { name: file.name, size: file.size },
        processed: { name: processedFile.name, size: processedFile.size },
      });
    } catch (conversionError) {
      console.error("Audio conversion failed:", conversionError);
      toastStore.error("音檔轉換失敗", "請嘗試使用 MP3 或 WAV 格式的音檔");
      return;
    }

    uploadProgress.value = "克隆語音中...";

    const formData = new FormData();
    formData.append("audio", processedFile);
    formData.append("name", name);

    // Pass userId for Token billing
    const userId = authStore.authInfo.email || authStore.authInfo.sub;
    if (userId) {
      formData.append("userId", userId);
    }

    const response = await $fetch<{ speakerId: string }>("/api/voice/clone", {
      method: "POST",
      body: formData,
    });

    // Save to Supabase database
    uploadProgress.value = "儲存語音資料...";
    const { saveVoice } = useVoiceStorage();
    const dbVoice = await saveVoice(
      {
        name,
        speakerId: response.speakerId,
        originalFileName: file.name,
      },
      userId
    );

    // Create saved voice object from database response
    const voice: SavedVoice = {
      id: parseInt(dbVoice.id) || undefined,
      supabaseId: dbVoice.id,
      name: dbVoice.name,
      speakerId: dbVoice.speaker_id,
      originalFileName: dbVoice.original_file_name,
      createdAt: new Date(dbVoice.created_at),
      lastUsedAt: new Date(dbVoice.last_used_at),
      useCount: dbVoice.use_count,
    };

    // Add to saved voices
    savedVoices.value.unshift(voice);

    // Select the voice
    generationStore.setVoice(voice);

    // Save to preferences
    if (voice.supabaseId) {
      const { updateVoicePreference } = usePreferencesStorage();
      try {
        await updateVoicePreference(userId, voice.supabaseId);
        console.log("Voice preference saved after clone:", voice.supabaseId);
      } catch (err) {
        console.error("Failed to save voice preference:", err);
      }
    }

    toastStore.success("語音克隆完成！");
    showModal.value = false;

    // Refresh Token balance if consumed
    if (cloneTokenCost.value > 0) {
      const subscriptionStore = useSubscriptionStore();
      subscriptionStore.loadSubscription(userId);
    }
  } catch (err: any) {
    console.error("Voice cloning failed:", err);
    // Handle Token insufficient error
    if (err.statusCode === 402) {
      toastStore.error(
        "Token 餘額不足",
        err.message || "請升級方案以繼續克隆語音"
      );
    } else {
      toastStore.error("語音克隆失敗", err.message || "請稍後再試");
    }
  } finally {
    isCloning.value = false;
    cloningVoiceName.value = null;
    uploadProgress.value = null;
  }
}

// Batch clone from multiple files
async function cloneBatchVoice() {
  if (!canClone.value) return;

  try {
    isCloning.value = true;
    uploadProgress.value = "準備克隆...";

    const formData = new FormData();
    formData.append("name", effectiveVoiceName.value);

    // Append all processed files
    for (const pf of readyFiles.value) {
      formData.append("audio", pf.processedFile || pf.file);
    }

    // Pass userId for Token billing
    const userId = authStore.authInfo.email || authStore.authInfo.sub;
    if (userId) {
      formData.append("userId", userId);
    }

    uploadProgress.value = `上傳 ${readyFiles.value.length} 個檔案...`;

    const response = await $fetch<{ speakerId: string }>("/api/voice/clone", {
      method: "POST",
      body: formData,
    });

    // Save to Supabase database
    uploadProgress.value = "儲存語音資料...";
    const { saveVoice } = useVoiceStorage();
    const dbVoice = await saveVoice(
      {
        name: effectiveVoiceName.value,
        speakerId: response.speakerId,
        originalFileName: readyFiles.value.map((f) => f.name).join(", "),
      },
      userId
    );

    // Create saved voice object from database response
    const voice: SavedVoice = {
      id: parseInt(dbVoice.id) || undefined,
      supabaseId: dbVoice.id,
      name: dbVoice.name,
      speakerId: dbVoice.speaker_id,
      originalFileName: dbVoice.original_file_name,
      createdAt: new Date(dbVoice.created_at),
      lastUsedAt: new Date(dbVoice.last_used_at),
      useCount: dbVoice.use_count,
    };

    // Add to saved voices
    savedVoices.value.unshift(voice);

    // Select the voice
    generationStore.setVoice(voice);

    // Save to preferences
    if (voice.supabaseId) {
      const { updateVoicePreference } = usePreferencesStorage();
      try {
        await updateVoicePreference(userId, voice.supabaseId);
        console.log("Voice preference saved after clone:", voice.supabaseId);
      } catch (err) {
        console.error("Failed to save voice preference:", err);
      }
    }

    // Clear pending files
    clearPendingFiles();

    toastStore.success("語音克隆完成！");
    toastStore.info(`已扣除 ${CLONE_TOKEN_COST} Token`);
    showModal.value = false;

    // Refresh Token balance
    const subscriptionStore = useSubscriptionStore();
    if (userId) {
      subscriptionStore.loadSubscription(userId);
    }
  } catch (err: any) {
    console.error("Voice cloning failed:", err);
    if (err.statusCode === 402) {
      toastStore.error(
        "鑽石餘額不足",
        err.message || "請升級方案以繼續克隆語音"
      );
    } else {
      toastStore.error("語音克隆失敗", err.message || "請稍後再試");
    }
  } finally {
    isCloning.value = false;
    uploadProgress.value = null;
  }
}

async function handleSelectVoice(voice: SavedVoice) {
  generationStore.setVoice(voice);
  showModal.value = false;
  toastStore.success(`已選擇語音: ${voice.name}`);

  // Save to preferences
  if (voice.supabaseId && authStore.user) {
    const userId = authStore.authInfo.email || authStore.authInfo.sub;
    const { updateVoicePreference } = usePreferencesStorage();
    try {
      await updateVoicePreference(userId, voice.supabaseId);
      console.log("Voice preference saved:", voice.supabaseId);
    } catch (err) {
      console.error("Failed to save voice preference:", err);
    }
  }
}

async function handleDeleteVoice(event: Event, voice: SavedVoice) {
  event.stopPropagation();
  const deleteKey = voice.supabaseId || String(voice.id);
  deletingId.value = deleteKey;

  try {
    // TODO: Delete from Supabase
    // await $fetch(`/api/voice/${deleteKey}`, { method: 'DELETE' })

    savedVoices.value = savedVoices.value.filter(
      (v) => (v.supabaseId || String(v.id)) !== deleteKey
    );

    // Clear selection if deleted voice was selected
    if (draft.value.voicePreview?.speakerId === voice.speakerId) {
      generationStore.setVoice(null);
    }

    toastStore.success("語音已刪除");
  } catch (err) {
    console.error("Failed to delete voice:", err);
    toastStore.error("刪除失敗");
  } finally {
    deletingId.value = null;
  }
}

function handleClearVoice() {
  generationStore.setVoice(null);
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

const hasSavedVoices = computed(() => savedVoices.value.length > 0);
const recordingProgress = computed(
  () => (recordingDuration.value / MAX_AUDIO_DURATION) * 100
);

// Selected voice preview computed properties
const selectedVoiceId = computed(() => draft.value.voicePreview?.speakerId);
const isGeneratingSelectedPreview = computed(
  () =>
    selectedVoiceId.value &&
    generatingPreviewId.value === selectedVoiceId.value
);
const isPlayingSelectedPreview = computed(
  () =>
    selectedVoiceId.value && previewingVoiceId.value === selectedVoiceId.value
);

// Audio preview functions
async function generateVoicePreview(voice: SavedVoice): Promise<string | null> {
  const voiceId = voice.supabaseId || String(voice.id);

  // 檢查快取
  if (previewCache.value.has(voiceId)) {
    return previewCache.value.get(voiceId)!;
  }

  // 調用 TTS API 生成「歡迎追蹤我」
  const response = await $fetch("/api/voice/tts", {
    method: "POST",
    body: {
      speakerId: voice.speakerId,
      transcript: "歡迎追蹤我",
    },
  });

  if (response.success && response.audioUrl) {
    previewCache.value.set(voiceId, response.audioUrl);
    return response.audioUrl;
  }

  return null;
}

async function handlePreviewVoice(event: Event, voice: SavedVoice) {
  event.stopPropagation();

  const voiceId = voice.supabaseId || String(voice.id);

  // 如果正在生成，忽略
  if (generatingPreviewId.value === voiceId) return;

  // 如果正在播放此語音，停止它
  if (previewingVoiceId.value === voiceId) {
    stopPreview();
    return;
  }

  // 停止當前預覽
  stopPreview();

  // 顯示載入狀態
  generatingPreviewId.value = voiceId;

  try {
    // 生成或獲取快取的預覽音頻
    const audioUrl = await generateVoicePreview(voice);

    if (!audioUrl) {
      toastStore.error("生成預覽失敗");
      return;
    }

    // 播放預覽
    previewingVoiceId.value = voiceId;
    previewAudio.value = new Audio(audioUrl);
    previewAudio.value.play();

    previewAudio.value.onended = () => {
      previewingVoiceId.value = null;
      previewAudio.value = null;
    };

    previewAudio.value.onerror = () => {
      previewingVoiceId.value = null;
      previewAudio.value = null;
    };
  } catch (error) {
    console.error("Preview generation failed:", error);
    toastStore.error("生成預覽失敗");
  } finally {
    generatingPreviewId.value = null;
  }
}

function stopPreview() {
  if (previewAudio.value) {
    previewAudio.value.pause();
    previewAudio.value = null;
  }
  previewingVoiceId.value = null;
}

// Preview selected voice (for the selected voice preview section)
async function handlePreviewSelectedVoice(event: Event) {
  event.stopPropagation();

  const voicePreview = draft.value.voicePreview;
  if (!voicePreview?.speakerId) return;

  const voiceId = voicePreview.speakerId;

  // 如果正在生成，忽略
  if (generatingPreviewId.value === voiceId) return;

  // 如果正在播放此語音，停止它
  if (previewingVoiceId.value === voiceId) {
    stopPreview();
    return;
  }

  // 停止當前預覽
  stopPreview();

  // 顯示載入狀態
  generatingPreviewId.value = voiceId;

  try {
    // 檢查快取
    let audioUrl = previewCache.value.get(voiceId);

    if (!audioUrl) {
      // 調用 TTS API 生成預覽
      const response = await $fetch("/api/voice/tts", {
        method: "POST",
        body: {
          speakerId: voicePreview.speakerId,
          transcript: "歡迎追蹤我",
        },
      });

      if (response.success && response.audioUrl) {
        previewCache.value.set(voiceId, response.audioUrl);
        audioUrl = response.audioUrl;
      }
    }

    if (!audioUrl) {
      toastStore.error("生成預覽失敗");
      return;
    }

    // 播放預覽
    previewingVoiceId.value = voiceId;
    previewAudio.value = new Audio(audioUrl);
    previewAudio.value.play();

    previewAudio.value.onended = () => {
      previewingVoiceId.value = null;
      previewAudio.value = null;
    };

    previewAudio.value.onerror = () => {
      previewingVoiceId.value = null;
      previewAudio.value = null;
    };
  } catch (error) {
    console.error("Preview generation failed:", error);
    toastStore.error("生成預覽失敗");
  } finally {
    generatingPreviewId.value = null;
  }
}

// Clean up on unmount
onUnmounted(() => {
  stopPreview();
});
</script>

<template>
  <div class="card p-4 h-full flex flex-col">
    <div class="flex items-center justify-between mb-3">
      <div>
        <label class="text-sm font-medium text-stone-700">聲音</label>
        <span class="text-xs text-stone-400 ml-2">上傳聲音讓 AI 學習模仿</span>
      </div>
      <button
        class="px-2 py-1 text-xs text-stone-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
        @click="handleClick"
        title="更換語音"
      >
        更換
      </button>
    </div>

    <!-- Hidden file input (supports multiple files) -->
    <input
      ref="fileInputRef"
      type="file"
      accept="audio/*,video/*"
      multiple
      class="hidden"
      @change="handleFileChange"
    />

    <!-- Selected Voice Preview -->
    <div
      v-if="draft.voicePreview"
      class="flex items-center gap-3 p-3 bg-stone-100 rounded-xl"
    >
      <!-- 播放按鈕 -->
      <button
        class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
        :class="[
          isGeneratingSelectedPreview
            ? 'bg-stone-500 cursor-wait'
            : isPlayingSelectedPreview
            ? 'bg-stone-800 hover:bg-stone-900'
            : 'bg-stone-700 hover:bg-stone-800',
        ]"
        :disabled="isGeneratingSelectedPreview"
        @click="handlePreviewSelectedVoice($event)"
      >
        <!-- Loading spinner -->
        <Loader2
          v-if="isGeneratingSelectedPreview"
          class="animate-spin w-4 h-4 text-white"
        />
        <!-- 音波動畫 -->
        <div
          v-else-if="isPlayingSelectedPreview"
          class="flex items-center justify-center gap-0.5 w-4 h-4"
        >
          <div
            v-for="i in 4"
            :key="i"
            class="w-0.5 bg-white rounded-full animate-audio-wave"
            :style="{
              height: `${8 + Math.sin((i - 1) * 0.8) * 4}px`,
              animationDelay: `${(i - 1) * 100}ms`,
            }"
          />
        </div>
        <!-- Play icon -->
        <svg
          v-else
          class="w-4 h-4 text-white ml-0.5"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M8 5v14l11-7z" />
        </svg>
      </button>

      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-stone-800 truncate">
          {{ draft.voicePreview.name }}
        </p>
        <p class="text-xs text-stone-500">已選擇</p>
      </div>
    </div>

    <!-- Empty State Button -->
    <button
      v-else
      class="w-full p-6 border-2 border-dashed border-stone-300 rounded-xl hover:border-purple-400 hover:bg-purple-50/50 transition-all text-center"
      @click="handleClick"
    >
      <CirclePlus class="w-10 h-10 mx-auto mb-2 text-stone-400" />
      <p class="text-sm font-medium text-stone-500">新增聲音樣本</p>
    </button>

    <!-- Modal -->
    <Teleport to="body">
      <div
        v-if="showModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
        @click="handleCloseModal"
      >
        <div
          class="flex flex-col bg-white rounded-2xl overflow-hidden border border-stone-200 shadow-2xl w-[800px] max-w-[90vw] h-[80vh] max-h-[600px]"
          @click.stop
        >
          <!-- Header -->
          <div
            class="px-4 py-3 border-b border-stone-200 flex items-center justify-between"
          >
            <h3 class="font-bold text-stone-800">選擇語音</h3>
            <button
              class="p-1.5 hover:bg-stone-100 rounded-lg transition-colors"
              @click="handleCloseModal"
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
          <div class="flex-1 overflow-auto p-4 space-y-6">
            <!-- 克隆中狀態 -->
            <div
              v-if="isCloning"
              class="flex flex-col items-center justify-center py-12"
            >
              <Loader2 class="animate-spin w-12 h-12 text-stone-600 mb-4" />
              <p class="text-stone-600 font-medium">
                {{ uploadProgress || "克隆中..." }}
              </p>
            </div>

            <template v-else>
              <!-- 新增克隆聲音區塊 -->
              <div>
                <h4 class="text-sm font-medium text-stone-700 mb-3">
                  新增克隆聲音
                </h4>

                <!-- 拖曳框 + 麥克風並排 (7:3) -->
                <div class="flex gap-3">
                  <!-- 拖曳上傳區 (70%) -->
                  <div
                    v-if="pendingFiles.length < MAX_PENDING_FILES"
                    class="flex-[7] border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer"
                    :class="
                      isDragging
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-stone-300 hover:border-stone-400'
                    "
                    @dragover="handleDragOver"
                    @dragleave="handleDragLeave"
                    @drop="handleDrop"
                    @click="fileInputRef?.click()"
                  >
                    <CloudUpload class="w-8 h-8 mx-auto text-stone-400 mb-2" />
                    <p class="text-sm text-stone-600">拖曳檔案或點擊選擇</p>
                    <p class="text-xs text-stone-400 mt-1">
                      MP3、WAV、M4A、MP4
                    </p>
                  </div>

                  <!-- 麥克風錄音按鈕 (30%) -->
                  <div
                    class="flex-[3] flex flex-col items-center justify-center"
                  >
                    <!-- 錄音中狀態 -->
                    <div v-if="isRecording" class="text-center">
                      <div
                        class="w-16 h-16 rounded-full bg-red-100 animate-pulse flex items-center justify-center mb-2"
                      >
                        <div
                          class="w-12 h-12 rounded-full bg-red-200 flex items-center justify-center"
                        >
                          <svg
                            class="w-6 h-6 text-red-500"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                            />
                          </svg>
                        </div>
                      </div>
                      <p class="text-lg font-bold text-stone-800 font-mono">
                        {{ formatDuration(recordingDuration) }}
                      </p>
                      <button
                        class="mt-2 px-4 py-2 bg-red-500 text-white rounded-full text-sm font-medium hover:bg-red-600 transition-colors flex items-center gap-2"
                        @click="stopRecording()"
                      >
                        <svg
                          class="w-4 h-4"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <rect x="6" y="6" width="12" height="12" rx="2" />
                        </svg>
                        停止
                      </button>
                    </div>

                    <!-- 處理中狀態 -->
                    <div v-else-if="isProcessing" class="text-center">
                      <Loader2
                        class="animate-spin w-8 h-8 text-stone-600 mx-auto mb-2"
                      />
                      <p class="text-xs text-stone-500">{{ uploadProgress }}</p>
                    </div>

                    <!-- 預設麥克風按鈕 -->
                    <button
                      v-else
                      class="w-16 h-16 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center transition-colors"
                      @click="startRecording()"
                    >
                      <svg
                        class="w-8 h-8 text-stone-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                        />
                      </svg>
                    </button>
                    <p
                      v-if="!isRecording && !isProcessing"
                      class="text-xs text-stone-400 mt-2"
                    >
                      錄音
                    </p>
                  </div>
                </div>
              </div>

              <!-- 待克隆檔案列表 -->
              <div v-if="pendingFiles.length > 0" class="space-y-2">
                <div class="flex justify-between text-sm text-stone-500">
                  <span
                    >待克隆檔案 ({{ pendingFiles.length }}/{{
                      MAX_PENDING_FILES
                    }})</span
                  >
                </div>

                <div
                  v-for="file in pendingFiles"
                  :key="file.id"
                  class="flex items-center gap-3 p-3 bg-stone-50 rounded-xl group"
                >
                  <!-- 狀態圖示 -->
                  <div
                    class="w-6 h-6 flex items-center justify-center flex-shrink-0"
                  >
                    <Loader2
                      v-if="file.status === 'processing'"
                      class="w-4 h-4 animate-spin text-stone-400"
                    />
                    <CheckCircle
                      v-else-if="file.status === 'ready'"
                      class="w-4 h-4 text-green-500"
                    />
                    <XCircle v-else class="w-4 h-4 text-red-500" />
                  </div>

                  <!-- 檔案資訊 -->
                  <div class="flex-1 min-w-0">
                    <p class="text-sm truncate">{{ file.name }}</p>
                    <p class="text-xs text-stone-500">
                      <span v-if="file.status === 'processing'">處理中...</span>
                      <span v-else-if="file.status === 'ready'">
                        {{ Math.round(file.duration) }}秒
                        <span v-if="file.wasTrimmed" class="text-amber-600">
                          · 已裁剪</span
                        >
                        <span v-if="file.isFromVideo" class="text-blue-600">
                          · 影片音軌</span
                        >
                      </span>
                      <span v-else class="text-red-500">{{ file.error }}</span>
                    </p>
                  </div>

                  <!-- 刪除按鈕 -->
                  <button
                    @click="removePendingFile(file.id)"
                    class="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 class="w-4 h-4" />
                  </button>
                </div>
              </div>

              <!-- 語音名稱輸入 -->
              <div v-if="pendingFiles.length > 0">
                <input
                  v-model="customVoiceName"
                  type="text"
                  :placeholder="defaultVoiceName || '語音名稱（選填）'"
                  class="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                />
              </div>

              <!-- 克隆按鈕 -->
              <button
                v-if="pendingFiles.length > 0"
                :disabled="!canClone"
                @click="cloneBatchVoice"
                class="w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all"
                :class="
                  canClone
                    ? 'bg-stone-800 text-white hover:bg-stone-700'
                    : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                "
              >
                <template v-if="hasProcessingFiles">
                  <Loader2 class="w-4 h-4 animate-spin" />
                  處理中...
                </template>
                <template v-else>
                  <span>克隆語音 </span>
                  <Gem class="w-4 h-4" />
                  <span v-if="cloneCostDisplay">{{ cloneCostDisplay }}</span>
                  <span v-else>{{ cloneTokenCost }}</span>
                </template>
              </button>

              <!-- 分隔線 -->
              <div class="border-t border-stone-200" />

              <!-- 歷史聲音區塊 -->
              <div>
                <h4 class="text-sm font-medium text-stone-700 mb-3">
                  歷史聲音
                </h4>

                <!-- Skeleton loading list -->
                <div v-if="isLoadingVoices" class="space-y-2">
                  <div
                    v-for="i in 3"
                    :key="i"
                    class="animate-pulse flex items-center gap-3 p-3 bg-stone-50 rounded-xl"
                  >
                    <div class="w-10 h-10 bg-stone-200 rounded-full" />
                    <div class="flex-1">
                      <div class="h-4 w-24 bg-stone-200 rounded mb-2" />
                      <div class="h-3 w-16 bg-stone-100 rounded" />
                    </div>
                  </div>
                </div>

                <div
                  v-else-if="validVoices.length === 0"
                  class="text-center py-8 text-stone-400"
                >
                  <svg
                    class="w-10 h-10 mx-auto mb-2 opacity-50"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                    />
                  </svg>
                  <p class="text-sm">尚無歷史語音</p>
                </div>

                <div v-else class="space-y-2">
                  <div
                    v-for="voice in validVoices"
                    :key="voice.supabaseId || voice.id"
                    class="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all group"
                    :class="
                      draft.voicePreview?.speakerId === voice.speakerId
                        ? 'bg-stone-200 border-2 border-stone-600'
                        : 'bg-stone-50 hover:bg-stone-100 border-2 border-transparent'
                    "
                    @click="handleSelectVoice(voice)"
                  >
                    <!-- Preview play button -->
                    <button
                      class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
                      :class="[
                        generatingPreviewId ===
                        (voice.supabaseId || String(voice.id))
                          ? 'bg-stone-500 cursor-wait'
                          : previewingVoiceId ===
                            (voice.supabaseId || String(voice.id))
                          ? 'bg-stone-800 hover:bg-stone-900'
                          : 'bg-stone-700 hover:bg-stone-800',
                      ]"
                      :disabled="
                        generatingPreviewId ===
                        (voice.supabaseId || String(voice.id))
                      "
                      @click.stop="handlePreviewVoice($event, voice)"
                    >
                      <!-- Loading spinner -->
                      <Loader2
                        v-if="
                          generatingPreviewId ===
                          (voice.supabaseId || String(voice.id))
                        "
                        class="animate-spin w-4 h-4 text-white"
                      />
                      <!-- 音波動畫 -->
                      <div
                        v-else-if="
                          previewingVoiceId ===
                          (voice.supabaseId || String(voice.id))
                        "
                        class="flex items-center justify-center gap-0.5 w-4 h-4"
                      >
                        <div
                          v-for="i in 4"
                          :key="i"
                          class="w-0.5 bg-white rounded-full animate-audio-wave"
                          :style="{
                            height: `${8 + Math.sin((i - 1) * 0.8) * 4}px`,
                            animationDelay: `${(i - 1) * 100}ms`,
                          }"
                        />
                      </div>
                      <!-- Play icon -->
                      <svg
                        v-else
                        class="w-4 h-4 text-white ml-0.5"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </button>

                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-stone-800 truncate">
                        {{ voice.name }}
                      </p>
                      <!-- 音檔來源標籤 -->
                      <div class="flex flex-wrap gap-1 mt-1">
                        <span
                          v-for="(file, index) in parseSourceFiles(voice.originalFileName)"
                          :key="index"
                          class="text-[10px] text-stone-600 bg-stone-200 px-2 py-0.5 rounded-full truncate max-w-[120px]"
                          :title="file"
                        >
                          {{ file }}
                        </span>
                      </div>
                    </div>

                    <button
                      class="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                      @click.stop="handleDeleteVoice($event, voice)"
                    >
                      <Loader2
                        v-if="
                          deletingId === (voice.supabaseId || String(voice.id))
                        "
                        class="animate-spin w-4 h-4"
                      />
                      <Trash2 v-else class="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
@keyframes audio-wave {
  0%,
  100% {
    transform: scaleY(0.5);
  }
  50% {
    transform: scaleY(1);
  }
}

.animate-audio-wave {
  animation: audio-wave 0.4s ease-in-out infinite;
}
</style>
