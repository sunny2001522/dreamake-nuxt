<script setup lang="ts">
const currentYear = new Date().getFullYear()
</script>

<template>
  <footer class="py-8 bg-stone-900 text-stone-400">
    <div class="container mx-auto px-4">
      <div class="flex flex-col md:flex-row items-center justify-between gap-4">
        <div class="flex items-center gap-2">
          <span class="text-lg font-bold text-white">DreaMake</span>
        </div>

        <p class="text-sm">
          © {{ currentYear }} DreaMake. All rights reserved.
        </p>
      </div>
    </div>
  </footer>
</template>
