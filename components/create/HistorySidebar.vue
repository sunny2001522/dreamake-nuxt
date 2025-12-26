<script setup lang="ts">
interface Props {
  modelValue: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})
</script>

<template>
  <CommonSlideDrawer
    v-model="isOpen"
    title="歷史紀錄"
    width="lg"
  >
    <HistoryPage />
  </CommonSlideDrawer>
</template>
