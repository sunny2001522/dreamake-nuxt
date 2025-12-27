<script setup lang="ts">
definePageMeta({
  layout: 'default',
})

const authStore = useAuthStore()
</script>

<template>
  <div class="container mx-auto px-4 py-6 lg:py-8">
    <HistoryPage />
  </div>
</template>
