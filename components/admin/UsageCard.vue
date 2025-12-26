<script setup lang="ts">
import {
  Mic,
  Volume2,
  Video,
  Zap,
  Sparkles,
  Ear,
  ChevronDown,
  Loader2,
  AlertCircle,
  ExternalLink,
} from 'lucide-vue-next'
import type { ServiceQuota, QuotaItem } from '~/types/admin'
import { TOPMEDIAI_CLONE_PLANS } from '~/types/admin'

interface Props {
  service: ServiceQuota
}

const props = defineProps<Props>()

const emit = defineEmits<{
  quotaSettingChange: [serviceId: string, setting: { plan_name?: string; total_quota?: number; billing_cycle_start?: string }]
}>()

const VIDNOZ_PLANS = [
  { name: 'Pro', minutes: 166 },
  { name: 'Scale', minutes: 1000 },
]

// Service icons mapping
const serviceIconComponents: Record<string, any> = {
  topmediai_clone: Mic,
  topmediai_tts: Volume2,
  vidnoz: Video,
  wavespeed: Zap,
  gemini: Sparkles,
  whisper: Ear,
}

// Get border color based on worst quota status
function getBorderColorClass(quotas: QuotaItem[]): string {
  const hasError = quotas.some((q) => q.status === 'error')
  const hasCritical = quotas.some((q) => q.status === 'critical')
  const hasWarning = quotas.some((q) => q.status === 'warning')

  if (hasError) return 'border-stone-300'
  if (hasCritical) return 'border-red-300'
  if (hasWarning) return 'border-amber-300'
  return 'border-stone-200 hover:border-pink-400'
}

// Format large numbers with commas
function formatNumber(num: number): string {
  if (num % 1 !== 0) {
    return num.toLocaleString('zh-TW', { maximumFractionDigits: 1 })
  }
  return num.toLocaleString('zh-TW')
}

// Calculate percentage
function getPercentage(used: number, total: number): number {
  if (total <= 0) return 0
  return (used / total) * 100
}

// Format date for display (MM/DD)
function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr)
  return `${date.getMonth() + 1}/${date.getDate()}`
}

// Calculate cycle end date (start + 30 days)
function getCycleEnd(startDate: string): string {
  if (!startDate) return ''
  const start = new Date(startDate)
  const end = new Date(start)
  end.setDate(end.getDate() + 30)
  return formatDateShort(end.toISOString())
}

// Computed border class
const borderClass = computed(() => getBorderColorClass(props.service.quotas))

// Get icon component
const iconComponent = computed(() => serviceIconComponents[props.service.serviceId] || Zap)

// Selected plan state
const getInitialPlan = () => {
  if (props.service.serviceId === 'topmediai_clone') {
    return props.service.quotas[0]?.planName || 'Startup'
  }
  if (props.service.serviceId === 'vidnoz') {
    const total = props.service.quotas[0]?.total
    if (total === 1000) return 'Scale'
    return 'Pro'
  }
  return 'Pro'
}
const selectedPlan = ref<string>(getInitialPlan())

// Billing cycle start date state
const quota = computed(() => props.service.quotas[0])
const cycleStart = ref<string>(quota.value?.billingCycleStart?.split('T')[0] || '')

// Handle plan change
function handlePlanChange(event: Event) {
  const planName = (event.target as HTMLSelectElement).value
  selectedPlan.value = planName

  let totalQuota: number | undefined

  if (props.service.serviceId === 'vidnoz') {
    const plan = VIDNOZ_PLANS.find(p => p.name === planName)
    totalQuota = plan?.minutes
  } else if (props.service.serviceId === 'topmediai_clone') {
    const plan = TOPMEDIAI_CLONE_PLANS.find(p => p.name === planName)
    totalQuota = plan?.maxClones
  }

  if (totalQuota !== undefined) {
    emit('quotaSettingChange', props.service.serviceId, { plan_name: planName, total_quota: totalQuota })
  }
}

// Handle cycle start change
function handleCycleStartChange(event: Event) {
  const newDate = (event.target as HTMLInputElement).value
  cycleStart.value = newDate
  emit('quotaSettingChange', props.service.serviceId, { billing_cycle_start: newDate })
}
</script>

<template>
  <div
    class="bg-white rounded-xl border-2 p-5 transition-all duration-200"
    :class="borderClass"
  >
    <!-- Header -->
    <div class="flex items-center gap-3 mb-4">
      <div class="p-2.5 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 text-white flex-shrink-0">
        <component :is="iconComponent" class="w-5 h-5" />
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <h3 class="font-semibold text-stone-800 truncate">
            {{ service.serviceName }}
          </h3>
          <!-- Vidnoz plan selector -->
          <div v-if="service.serviceId === 'vidnoz'" class="relative">
            <select
              :value="selectedPlan"
              @change="handlePlanChange"
              class="appearance-none text-xs bg-stone-100 border-0 rounded px-2 py-0.5 pr-5 text-stone-600 cursor-pointer focus:outline-none focus:ring-1 focus:ring-pink-400"
            >
              <option v-for="plan in VIDNOZ_PLANS" :key="plan.name" :value="plan.name">
                {{ plan.name }}
              </option>
            </select>
            <ChevronDown class="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-stone-400 pointer-events-none" />
          </div>
          <!-- TopMediai Clone plan selector -->
          <div v-if="service.serviceId === 'topmediai_clone'" class="relative">
            <select
              :value="selectedPlan"
              @change="handlePlanChange"
              class="appearance-none text-xs bg-stone-100 border-0 rounded px-2 py-0.5 pr-5 text-stone-600 cursor-pointer focus:outline-none focus:ring-1 focus:ring-pink-400"
            >
              <option v-for="plan in TOPMEDIAI_CLONE_PLANS" :key="plan.name" :value="plan.name">
                {{ plan.name }}
              </option>
            </select>
            <ChevronDown class="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-stone-400 pointer-events-none" />
          </div>
        </div>
        <p class="text-xs text-stone-500 truncate">{{ service.description }}</p>
        <!-- Billing cycle - only for monthly billing -->
        <div v-if="quota?.billingType === 'monthly'" class="flex items-center gap-1.5 mt-1">
          <input
            type="date"
            :value="cycleStart"
            @change="handleCycleStartChange"
            class="text-xs bg-stone-100 border-0 rounded px-1.5 py-0.5 text-stone-600 cursor-pointer focus:outline-none focus:ring-1 focus:ring-pink-400 w-[105px]"
          />
          <span class="text-xs text-stone-400">~</span>
          <span class="text-xs text-stone-500">
            {{ cycleStart ? getCycleEnd(cycleStart) : '--/--' }}
          </span>
        </div>
      </div>
    </div>

    <!-- Quotas -->
    <div class="space-y-4">
      <div v-for="q in service.quotas" :key="q.type">
        <!-- Label row -->
        <div class="flex items-center justify-between mb-1.5">
          <span class="text-sm text-stone-600">{{ q.label }}</span>
          <div class="flex items-center gap-2">
            <Loader2 v-if="q.status === 'loading'" class="w-3 h-3 animate-spin text-stone-400" />
            <AlertCircle v-if="q.status === 'error'" class="w-3 h-3 text-red-400" />
            <span
              v-if="q.source === 'api' && !q.errorMessage"
              class="text-[10px] text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded"
            >
              即時
            </span>
          </div>
        </div>

        <!-- Progress bar -->
        <AdminProgressBar
          :value="getPercentage(q.used, q.total)"
          :status="q.status"
          size="md"
        />

        <!-- Usage numbers -->
        <div class="flex items-center justify-between mt-1.5 text-xs">
          <span class="text-stone-500">
            <span class="text-stone-700">{{ formatNumber(q.used) }}</span>
            <span class="text-stone-400"> / {{ formatNumber(q.total) }} {{ q.unit }}</span>
          </span>
          <span class="text-stone-400">
            {{ q.billingType === 'monthly' ? '每月重置' : '累計制' }}
          </span>
        </div>

        <!-- Error message -->
        <p v-if="q.errorMessage" class="mt-1 text-xs text-red-500 truncate">
          {{ q.errorMessage }}
        </p>
      </div>
    </div>

    <!-- Upgrade link -->
    <a
      :href="service.upgradeUrl"
      target="_blank"
      rel="noopener noreferrer"
      class="mt-4 flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border border-stone-200 text-stone-600 hover:border-pink-400 hover:text-pink-500 transition-colors text-sm font-medium"
    >
      去升級
      <ExternalLink class="w-4 h-4" />
    </a>
  </div>
</template>
