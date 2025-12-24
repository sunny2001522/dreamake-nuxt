<script setup lang="ts">
definePageMeta({
  layout: 'default',
  middleware: 'auth',
})

const authStore = useAuthStore()
const generationStore = useGenerationStore()
const preferencesStore = usePreferencesStore()

// Persona content for topic suggestions
const personaContent = ref('')

function handlePersonaUpdate(content: string) {
  personaContent.value = content
}

// Load user data on mount
onMounted(async () => {
  if (authStore.user) {
    await Promise.all([
      generationStore.loadDraft(authStore.user.id),
      preferencesStore.loadPreferences(authStore.user.id),
    ])
  }
})
</script>

<template>
  <div class="container mx-auto px-4 py-6 lg:py-8">
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
      <!-- Left Column: Inputs -->
      <div class="space-y-6">
        <!-- Image Uploader -->
        <ImageUploader />

        <!-- Voice Picker -->
        <VoicePicker />

        <!-- Persona Panel -->
        <PersonaPanel @persona-update="handlePersonaUpdate" />

        <!-- Topic Suggestions (shows when persona is set) -->
        <CreateTopicSuggestions :persona-content="personaContent" />

        <!-- Transcript Input -->
        <CreateTranscriptInput />

        <!-- Aspect Ratio Selector -->
        <CreateAspectRatioSelector
          :model-value="generationStore.draft.aspectRatio"
          @update:model-value="generationStore.updateDraft({ aspectRatio: $event })"
        />

        <!-- Subtitle Settings -->
        <CreateSubtitleSettings />

        <!-- Generate Buttons -->
        <CreateGenerateButtons />
      </div>

      <!-- Right Column: Preview -->
      <div class="lg:sticky lg:top-24 lg:h-fit space-y-6">
        <!-- Video Preview -->
        <CreateVideoPreview />

        <!-- Generation Progress -->
        <CreateGenerationProgress />
      </div>
    </div>
  </div>
</template>
