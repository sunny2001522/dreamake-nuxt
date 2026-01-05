<script setup lang="ts">
// Default layout with header
</script>

<template>
  <div class="min-h-screen bg-stone-50">
    <LayoutHeader />
    <main>
      <slot />
    </main>
    <CommonToast />
    <PendingAnalysesBadge />
  </div>
</template>
