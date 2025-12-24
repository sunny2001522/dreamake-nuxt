interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  duration?: number
}

export const useToastStore = defineStore('toast', () => {
  const toasts = ref<Toast[]>([])

  function showToast(options: Omit<Toast, 'id'>) {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    const toast: Toast = {
      id,
      type: options.type,
      message: options.message,
      duration: options.duration ?? 3000,
    }

    toasts.value.push(toast)

    // Auto remove after duration
    if (toast.duration && toast.duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, toast.duration)
    }

    return id
  }

  function removeToast(id: string) {
    const index = toasts.value.findIndex((t) => t.id === id)
    if (index > -1) {
      toasts.value.splice(index, 1)
    }
  }

  function clearAll() {
    toasts.value = []
  }

  // Convenience methods
  function success(message: string, duration?: number) {
    return showToast({ type: 'success', message, duration })
  }

  function error(message: string, duration?: number) {
    return showToast({ type: 'error', message, duration })
  }

  function warning(message: string, duration?: number) {
    return showToast({ type: 'warning', message, duration })
  }

  function info(message: string, duration?: number) {
    return showToast({ type: 'info', message, duration })
  }

  return {
    toasts: readonly(toasts),
    showToast,
    removeToast,
    clearAll,
    success,
    error,
    warning,
    info,
  }
})
