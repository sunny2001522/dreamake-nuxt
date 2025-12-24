<script setup lang="ts">
definePageMeta({
  layout: 'default',
})

const authStore = useAuthStore()
const router = useRouter()

function handleStartClick() {
  if (authStore.user) {
    navigateTo('/create')
  } else {
    navigateTo('/auth')
  }
}
</script>

<template>
  <div class="min-h-screen">
    <!-- Hero Section -->
    <LandingHeroSection @start="handleStartClick" />

    <!-- Feature Cards -->
    <LandingFeatureCards />

    <!-- Demo Section -->
    <LandingDemoSection />

    <!-- CTA Section -->
    <LandingCTASection @start="handleStartClick" />

    <!-- Footer -->
    <LandingFooter />
  </div>
</template>
