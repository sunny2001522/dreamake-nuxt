<script setup lang="ts">
interface Props {
  variant?: "text" | "chip" | "card" | "avatar" | "custom";
  count?: number;
  width?: string;
  height?: string;
}

const props = withDefaults(defineProps<Props>(), {
  variant: "text",
  count: 1,
  width: "100%",
  height: "1rem",
});

const variantClasses: Record<string, string> = {
  text: "h-4 rounded",
  chip: "h-6 w-16 rounded-full",
  card: "h-20 rounded-xl",
  avatar: "h-12 w-12 rounded-full",
  custom: "rounded",
};
</script>

<template>
  <div class="animate-pulse flex flex-wrap gap-2">
    <div
      v-for="i in count"
      :key="i"
      class="bg-stone-200"
      :class="variantClasses[variant]"
      :style="
        variant === 'custom' ? { width: width, height: height } : undefined
      "
    />
  </div>
</template>
