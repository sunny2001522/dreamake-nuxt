import type { SuggestedTopic } from '~/types'

export function useTranscriptGeneration() {
  const isGenerating = ref(false)
  const error = ref<string | null>(null)
  const suggestedTopics = ref<SuggestedTopic[]>([])
  const isLoadingTopics = ref(false)

  async function generateTranscript(
    topic: string,
    personaAnalysis?: string
  ): Promise<string> {
    try {
      isGenerating.value = true
      error.value = null

      const response = await $fetch('/api/transcript/generate', {
        method: 'POST',
        body: {
          topic,
          persona_analysis: personaAnalysis,
        },
      })

      return (response as any).transcript
    } catch (err: any) {
      error.value = err.message || 'Failed to generate transcript'
      throw err
    } finally {
      isGenerating.value = false
    }
  }

  async function suggestTopics(personaContent: string): Promise<SuggestedTopic[]> {
    try {
      isLoadingTopics.value = true
      error.value = null

      const response = await $fetch('/api/transcript/suggest-topics', {
        method: 'POST',
        body: { persona_content: personaContent },
      })

      const topics = (response as any).topics || []
      suggestedTopics.value = topics
      return topics
    } catch (err: any) {
      error.value = err.message || 'Failed to suggest topics'
      throw err
    } finally {
      isLoadingTopics.value = false
    }
  }

  async function generateTitle(transcript: string, personaAnalysis?: string): Promise<string> {
    try {
      const response = await $fetch('/api/title', {
        method: 'POST',
        body: { transcript, persona_analysis: personaAnalysis },
      })

      return (response as any).title
    } catch (err: any) {
      error.value = err.message || 'Failed to generate title'
      throw err
    }
  }

  function reset() {
    isGenerating.value = false
    error.value = null
    suggestedTopics.value = []
    isLoadingTopics.value = false
  }

  return {
    // State
    isGenerating: readonly(isGenerating),
    error: readonly(error),
    suggestedTopics: readonly(suggestedTopics),
    isLoadingTopics: readonly(isLoadingTopics),

    // Methods
    generateTranscript,
    suggestTopics,
    generateTitle,
    reset,
  }
}
