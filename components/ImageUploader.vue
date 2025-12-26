<script setup lang="ts">
import type { SavedImage, AspectRatio } from '~/types'

const generationStore = useGenerationStore()
const authStore = useAuthStore()
const preferencesStore = usePreferencesStore()
const toastStore = useToastStore()
const { draft } = storeToRefs(generationStore)

// Modal state
const showModal = ref(false)
const modalTab = ref<'history' | 'upload' | 'camera'>('history')
const isDragging = ref(false)
const isLoadingUrl = ref(false)
const urlError = ref<string | null>(null)
const imageUrl = ref('')

// Saved images
const savedImages = ref<SavedImage[]>([])
const isLoadingImages = ref(false)
const deletingId = ref<string | null>(null)

// File input ref
const fileInputRef = ref<HTMLInputElement | null>(null)

// Camera refs and state
const videoRef = ref<HTMLVideoElement | null>(null)
const stream = ref<MediaStream | null>(null)
const cameraError = ref<string | null>(null)
const cameraLoading = ref(false)
const currentFacing = ref<'user' | 'environment'>('user')
const selectedRatio = ref<'portrait' | 'landscape'>('portrait')

// Load saved images on mount
onMounted(() => {
  if (authStore.user) {
    loadSavedImages()
  }
})

// Watch for auth changes
watch(() => authStore.user, (user) => {
  if (user) {
    loadSavedImages()
  } else {
    savedImages.value = []
  }
})

// Watch for preferences changes and apply default image
watch(
  () => preferencesStore.preferences?.image_id,
  async (imageId) => {
    // Only apply if we don't already have an avatar selected
    if (imageId && !draft.value.avatarPreview) {
      // Find the image in savedImages
      const matchedImage = savedImages.value.find(img => img.supabaseId === imageId)
      if (matchedImage) {
        applyDefaultImage(matchedImage)
        console.log('Applied default image from preferences:', matchedImage.name)
      }
    }
  }
)

// Also check after savedImages are loaded
watch(savedImages, (images) => {
  const imageId = preferencesStore.preferences?.image_id
  if (imageId && images.length > 0 && !draft.value.avatarPreview) {
    const matchedImage = images.find(img => img.supabaseId === imageId)
    if (matchedImage) {
      applyDefaultImage(matchedImage)
      console.log('Applied default image after loading:', matchedImage.name)
    }
  }
})

// Apply default image without closing modal
function applyDefaultImage(image: SavedImage) {
  const dataUrl = image.imageData.startsWith('data:') ? image.imageData : image.imageData
  generationStore.setAvatar(image.id ?? null, dataUrl)
}

async function loadSavedImages() {
  if (!authStore.user) return

  try {
    isLoadingImages.value = true
    const { getAllImages } = useImageStorage()
    const userId = authStore.authInfo.email || authStore.authInfo.sub

    const dbImages = await getAllImages(userId)

    savedImages.value = dbImages.map(img => ({
      id: parseInt(img.id) || undefined,
      supabaseId: img.id,
      name: img.name,
      imageData: img.image_url,
      imageMimeType: img.image_mime_type,
      thumbnailData: img.thumbnail_url || undefined,
      createdAt: new Date(img.created_at),
      lastUsedAt: new Date(img.last_used_at),
      useCount: img.use_count,
    }))
  } catch (err) {
    console.error('Failed to load saved images:', err)
  } finally {
    isLoadingImages.value = false
  }
}

function handleClick() {
  showModal.value = true
  modalTab.value = savedImages.value.length > 0 ? 'history' : 'upload'
}

function handleCloseModal() {
  stopCamera()
  showModal.value = false
}

async function processFile(file: File) {
  try {
    const previewUrl = URL.createObjectURL(file)
    generationStore.setAvatar(null, previewUrl)
    showModal.value = false
    toastStore.success('照片已上傳')
  } catch (err) {
    console.error('Error processing file:', err)
    toastStore.error('上傳失敗')
  }
}

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  processFile(file)
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}

function handleDragOver(event: DragEvent) {
  event.preventDefault()
  event.stopPropagation()
  isDragging.value = true
}

function handleDragLeave(event: DragEvent) {
  event.preventDefault()
  event.stopPropagation()
  isDragging.value = false
}

function handleDrop(event: DragEvent) {
  event.preventDefault()
  event.stopPropagation()
  isDragging.value = false
  const file = event.dataTransfer?.files?.[0]
  if (!file || !file.type.startsWith('image/')) return
  processFile(file)
}

async function handleUrlSubmit() {
  if (!imageUrl.value.trim()) return
  isLoadingUrl.value = true
  urlError.value = null

  try {
    new URL(imageUrl.value.trim())
    const response = await $fetch<Blob>(`/api/upload?url=${encodeURIComponent(imageUrl.value.trim())}`, {
      responseType: 'blob',
    })
    if (!response.type.startsWith('image/')) {
      throw new Error('網址不是有效的圖片')
    }
    const url = new URL(imageUrl.value.trim())
    const fileName = url.pathname.split('/').pop() || 'image.jpg'
    const file = new File([response], fileName, { type: response.type })
    await processFile(file)
    imageUrl.value = ''
  } catch (err) {
    if (err instanceof TypeError) {
      urlError.value = '請輸入有效的網址格式'
    } else if (err instanceof Error) {
      urlError.value = err.message
    } else {
      urlError.value = '載入圖片失敗'
    }
  } finally {
    isLoadingUrl.value = false
  }
}

async function handleSelectSavedImage(image: SavedImage) {
  const dataUrl = image.imageData.startsWith('data:') ? image.imageData : image.imageData
  generationStore.setAvatar(image.id ?? null, dataUrl)
  showModal.value = false

  // Save to preferences
  if (image.supabaseId && authStore.user) {
    const userId = authStore.authInfo.email || authStore.authInfo.sub
    const { updateImagePreference } = usePreferencesStorage()
    try {
      await updateImagePreference(userId, image.supabaseId)
      console.log('Image preference saved:', image.supabaseId)
    } catch (err) {
      console.error('Failed to save image preference:', err)
    }
  }
}

async function handleDeleteImage(event: Event, image: SavedImage) {
  event.stopPropagation()
  const deleteKey = image.supabaseId || String(image.id)
  deletingId.value = deleteKey
  try {
    savedImages.value = savedImages.value.filter(img =>
      (img.supabaseId || String(img.id)) !== deleteKey
    )
    toastStore.success('照片已刪除')
  } catch (err) {
    console.error('Failed to delete image:', err)
    toastStore.error('刪除失敗')
  } finally {
    deletingId.value = null
  }
}

// Camera functions
async function startCamera() {
  try {
    cameraLoading.value = true
    cameraError.value = null
    stream.value = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: currentFacing.value,
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    })
    if (videoRef.value) {
      videoRef.value.srcObject = stream.value
    }
  } catch (err) {
    console.error('Failed to start camera:', err)
    cameraError.value = '無法啟動相機'
  } finally {
    cameraLoading.value = false
  }
}

function stopCamera() {
  if (stream.value) {
    stream.value.getTracks().forEach(track => track.stop())
    stream.value = null
  }
}

async function switchCamera() {
  stopCamera()
  currentFacing.value = currentFacing.value === 'user' ? 'environment' : 'user'
  await startCamera()
}

async function handleCameraCapture() {
  if (!videoRef.value) return

  try {
    const video = videoRef.value
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const videoWidth = video.videoWidth
    const videoHeight = video.videoHeight

    // Calculate crop dimensions based on selected ratio
    let cropX = 0, cropY = 0, cropWidth = videoWidth, cropHeight = videoHeight

    if (selectedRatio.value === 'portrait') {
      // 9:16 portrait - crop from center
      cropHeight = videoHeight
      cropWidth = Math.floor(videoHeight * 9 / 16)
      cropX = Math.floor((videoWidth - cropWidth) / 2)
      cropY = 0
    } else {
      // 16:9 landscape - use full video
      cropWidth = videoWidth
      cropHeight = videoHeight
      cropX = 0
      cropY = 0
    }

    canvas.width = cropWidth
    canvas.height = cropHeight

    // Front camera: flip horizontally to match preview mirror
    if (currentFacing.value === 'user') {
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
      cropX = videoWidth - cropX - cropWidth
    }

    ctx.drawImage(video, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight)

    canvas.toBlob(async (blob) => {
      if (!blob) return
      const file = new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' })
      stopCamera()
      await processFile(file)
    }, 'image/jpeg', 0.92)
  } catch (err) {
    console.error('Failed to capture photo:', err)
    toastStore.error('拍照失敗')
  }
}

// Start camera when switching to camera tab
watch(modalTab, (tab) => {
  if (tab === 'camera' && showModal.value) {
    startCamera()
  } else {
    stopCamera()
  }
})

// Stop camera when modal closes
watch(showModal, (isOpen) => {
  if (!isOpen) {
    stopCamera()
  }
})

function handleClearAvatar() {
  generationStore.setAvatar(null)
}

const hasSavedImages = computed(() => savedImages.value.length > 0)
const isPortrait = computed(() => selectedRatio.value === 'portrait')

// Expose openModal for parent components to directly open the modal
defineExpose({
  openModal: handleClick
})
</script>

<template>
  <div class="card p-4">
    <div class="flex items-center justify-between mb-3">
      <label class="font-bold text-stone-800">1. 照片</label>
    </div>

    <!-- Hidden file input -->
    <input
      ref="fileInputRef"
      type="file"
      accept="image/*"
      class="hidden"
      @change="handleFileChange"
    />

    <!-- Preview or Upload Button -->
    <div
      v-if="draft.avatarPreview"
      class="relative aspect-square rounded-xl overflow-hidden group cursor-pointer bg-stone-800"
      @click="handleClick"
    >
      <img
        :src="draft.avatarPreview"
        alt="Avatar preview"
        class="w-full h-full object-cover"
      />
      <!-- Hover overlay -->
      <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <span class="px-3 py-2 bg-white/90 hover:bg-white rounded-lg text-sm font-medium text-stone-800">
          更換
        </span>
      </div>
    </div>
    <button
      v-else
      class="w-full aspect-square border-2 border-dashed border-stone-200 rounded-xl hover:border-purple-300 hover:bg-purple-50/50 transition-colors flex flex-col items-center justify-center cursor-pointer bg-stone-100"
      @click="handleClick"
    >
      <svg class="w-8 h-8 mb-2 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <p class="text-sm text-stone-500">選擇照片</p>
    </button>

    <!-- Modal -->
    <Teleport to="body">
      <div
        v-if="showModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
        @click="handleCloseModal"
      >
        <!-- Camera Modal (full screen style) -->
        <div
          v-if="modalTab === 'camera'"
          :class="[
            'flex flex-col bg-stone-900 rounded-2xl overflow-hidden border border-stone-700 shadow-2xl',
            isPortrait ? 'h-[85vh] aspect-[9/16]' : 'w-[85vw] aspect-video max-h-[85vh]'
          ]"
          @click.stop
        >
          <!-- Ratio Toggle -->
          <div class="px-4 py-2 bg-stone-800 border-b border-stone-700 shrink-0">
            <div class="flex rounded-lg bg-stone-900 p-1 max-w-md mx-auto">
              <button
                class="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all"
                :class="isPortrait
                  ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white'
                  : 'text-stone-400 hover:text-white'"
                @click="selectedRatio = 'portrait'"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                直式 9:16
              </button>
              <button
                class="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all"
                :class="!isPortrait
                  ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white'
                  : 'text-stone-400 hover:text-white'"
                @click="selectedRatio = 'landscape'"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                橫式 16:9
              </button>
            </div>
          </div>

          <!-- Video Preview -->
          <div class="flex-1 flex items-center justify-center bg-black overflow-hidden">
            <div
              :class="[
                'relative bg-black h-full',
                isPortrait ? 'aspect-[9/16]' : 'aspect-video'
              ]"
              style="max-width: 100%; max-height: 100%"
            >
              <video
                v-if="cameraError"
                class="hidden"
              />
              <video
                ref="videoRef"
                autoplay
                playsinline
                muted
                :class="[
                  'absolute inset-0 w-full h-full object-cover',
                  currentFacing === 'user' ? 'scale-x-[-1]' : ''
                ]"
              />
              <div v-if="cameraLoading" class="absolute inset-0 flex items-center justify-center">
                <svg class="animate-spin w-8 h-8 text-white" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
              <div v-if="cameraError" class="absolute inset-0 flex flex-col items-center justify-center text-red-400">
                <svg class="w-12 h-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p>{{ cameraError }}</p>
              </div>
            </div>
          </div>

          <!-- Camera Controls -->
          <div class="p-4 bg-stone-900 flex justify-center items-center gap-6 shrink-0">
            <!-- Switch camera button -->
            <button
              class="p-3 rounded-full bg-stone-700 hover:bg-stone-600 text-white transition-colors"
              @click="switchCamera"
            >
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>

            <!-- Capture button -->
            <button
              class="w-16 h-16 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white flex items-center justify-center transition-all shadow-lg"
              :disabled="cameraLoading || !stream"
              @click="handleCameraCapture"
            >
              <svg class="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>

            <!-- Close button (symmetric placeholder) -->
            <button
              class="p-3 rounded-full bg-stone-700 hover:bg-stone-600 text-white transition-colors"
              @click="handleCloseModal"
            >
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Regular Modal (History/Upload) -->
        <div
          v-else
          class="flex flex-col bg-white rounded-2xl overflow-hidden border border-stone-200 shadow-2xl w-[800px] max-w-[90vw] h-[80vh] max-h-[600px]"
          @click.stop
        >
          <!-- Header -->
          <div class="px-4 py-3 border-b border-stone-200 flex items-center justify-between">
            <h3 class="font-bold text-stone-800">選擇照片</h3>
            <button
              class="p-1.5 hover:bg-stone-100 rounded-lg transition-colors"
              @click="handleCloseModal"
            >
              <svg class="w-5 h-5 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Tab Toggle -->
          <div class="px-4 py-3 bg-stone-50 border-b border-stone-200">
            <div class="flex rounded-lg bg-stone-200 p-1">
              <button
                v-if="hasSavedImages"
                class="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all"
                :class="modalTab === 'history'
                  ? 'bg-white text-stone-800 shadow-sm'
                  : 'text-stone-500 hover:text-stone-800'"
                @click="modalTab = 'history'"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                歷史照片
              </button>
              <button
                class="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all"
                :class="modalTab === 'upload'
                  ? 'bg-white text-stone-800 shadow-sm'
                  : 'text-stone-500 hover:text-stone-800'"
                @click="modalTab = 'upload'"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                上傳檔案
              </button>
              <button
                class="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all"
                :class="modalTab === 'camera'
                  ? 'bg-white text-stone-800 shadow-sm'
                  : 'text-stone-500 hover:text-stone-800'"
                @click="modalTab = 'camera'"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                相機拍攝
              </button>
            </div>
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-auto p-4">
            <!-- History Tab -->
            <div v-if="modalTab === 'history'">
              <div v-if="isLoadingImages" class="flex items-center justify-center py-12">
                <svg class="animate-spin w-8 h-8 text-purple-500" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
              <div v-else-if="savedImages.length === 0" class="text-center py-12 text-stone-500">
                <svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p>尚無歷史照片</p>
              </div>
              <div v-else class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                <div
                  v-for="image in savedImages"
                  :key="image.supabaseId || image.id"
                  class="relative aspect-square rounded-lg overflow-hidden cursor-pointer group border-2 border-transparent hover:border-purple-500 transition-all"
                  @click="handleSelectSavedImage(image)"
                >
                  <img
                    :src="image.thumbnailData || image.imageData"
                    :alt="image.name"
                    class="w-full h-full object-cover"
                  />
                  <button
                    class="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    @click="handleDeleteImage($event, image)"
                  >
                    <svg v-if="deletingId === (image.supabaseId || String(image.id))" class="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <svg v-else class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <!-- Upload Tab -->
            <div v-else-if="modalTab === 'upload'" class="space-y-6">
              <!-- Drag & Drop Zone -->
              <div
                class="border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer"
                :class="isDragging ? 'border-purple-500 bg-purple-50' : 'border-stone-300 hover:border-purple-400'"
                @dragover="handleDragOver"
                @dragleave="handleDragLeave"
                @drop="handleDrop"
                @click="fileInputRef?.click()"
              >
                <svg class="w-12 h-12 mx-auto mb-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p class="font-medium text-stone-700 mb-1">拖曳檔案到這裡</p>
                <p class="text-sm text-stone-500">或點擊選擇檔案</p>
                <p class="text-xs text-stone-400 mt-2">支援 JPG、PNG</p>
              </div>

              <!-- URL Input -->
              <div>
                <label class="block text-sm font-medium text-stone-700 mb-2">從網址載入</label>
                <div class="flex gap-2">
                  <input
                    v-model="imageUrl"
                    type="url"
                    placeholder="輸入圖片網址..."
                    class="flex-1 px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                    @keyup.enter="handleUrlSubmit"
                  />
                  <button
                    class="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50"
                    :disabled="isLoadingUrl || !imageUrl.trim()"
                    @click="handleUrlSubmit"
                  >
                    <svg v-if="isLoadingUrl" class="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span v-else>載入</span>
                  </button>
                </div>
                <p v-if="urlError" class="mt-1 text-sm text-red-500">{{ urlError }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
