<script setup lang="ts">
interface Props {
  modelValue: string
  type?: 'text' | 'email' | 'password' | 'url' | 'number'
  placeholder?: string
  disabled?: boolean
  error?: string
  label?: string
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  placeholder: '',
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  focus: []
  blur: []
}>()

const inputRef = ref<HTMLInputElement | null>(null)

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.value)
}

function focus() {
  inputRef.value?.focus()
}

defineExpose({ focus })
</script>

<template>
  <div class="w-full">
    <label v-if="label" class="block text-sm font-medium text-stone-700 mb-1.5">
      {{ label }}
    </label>
    <input
      ref="inputRef"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :class="[
        'input-base',
        error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : '',
      ]"
      @input="handleInput"
      @focus="emit('focus')"
      @blur="emit('blur')"
    />
    <p v-if="error" class="mt-1 text-sm text-red-500">
      {{ error }}
    </p>
  </div>
</template>
