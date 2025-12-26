<script setup lang="ts">
definePageMeta({
  layout: 'default',
})
// Note: auth is handled by auth.global.ts middleware

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
    // Use CMoney email as user identifier for data association
    const userId = authStore.authInfo.email || authStore.authInfo.sub
    await Promise.all([
      generationStore.loadDraft(userId),
      preferencesStore.loadPreferences(userId),
    ])
  }
})
</script>

<template>
  <div class="container mx-auto px-4 py-6 lg:py-8">
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
      <!-- Left Column: Inputs -->
      <div class="space-y-6">
        <!-- Step 1 & 2: Image and Voice side by side -->
        <div class="grid grid-cols-2 gap-4">
          <ImageUploader />
          <VoicePicker />
        </div>

        <!-- Step 3: Aspect Ratio -->
        <CreateAspectRatioSelector
          :model-value="generationStore.draft.aspectRatio"
          @update:model-value="generationStore.updateDraft({ aspectRatio: $event })"
        />

        <!-- Step 4: Transcript Input (includes PersonaPanel trigger + TopicSuggestions) -->
        <CreateTranscriptInput
          :persona-content="personaContent"
          @persona-update="handlePersonaUpdate"
        />

        <!-- Advanced Settings (collapsible) -->
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
