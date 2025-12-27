<script setup lang="ts">
import {
  RefreshCw,
  Loader2,
  AlertTriangle,
  AlertCircle,
  XCircle,
  Mic,
  Server,
} from 'lucide-vue-next'
import type { UsageDashboardData } from '~/types/admin'

definePageMeta({
  layout: 'default',
  middleware: ['admin'],
})

const authStore = useAuthStore()
const toastStore = useToastStore()

// Fetch dashboard data
const { data: dashboardData, pending, refresh } = await useFetch<UsageDashboardData>('/api/admin/usage', {
  headers: {
    'x-user-email': authStore.authInfo.email || '',
  },
})

// Handle quota setting change
async function handleQuotaSettingChange(
  serviceId: string,
  setting: { plan_name?: string; total_quota?: number; billing_cycle_start?: string }
) {
  try {
    await $fetch('/api/admin/quota-settings', {
      method: 'POST',
      headers: {
        'x-user-email': authStore.authInfo.email || '',
      },
      body: {
        settings: { [serviceId]: setting },
      },
    })
    toastStore.success('設定已更新')
  } catch (error: any) {
    console.error('Failed to update quota settings:', error)
    toastStore.error('更新失敗')
  }
}

// Format timestamp
function formatTime(timestamp: string) {
  return new Date(timestamp).toLocaleString('zh-TW')
}
</script>

<template>
  <div class="min-h-screen bg-stone-50">
    <div class="container mx-auto px-4 py-8 max-w-7xl">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 class="text-2xl font-bold text-stone-800">API 用量監控</h1>
          <p class="text-stone-500 mt-1">
            管理 API 配額與使用量
          </p>
        </div>
        <button
          @click="refresh()"
          :disabled="pending"
          class="flex items-center gap-2 px-4 py-2 rounded-lg border border-stone-200 bg-white text-stone-600 hover:border-pink-400 hover:text-pink-500 transition-colors disabled:opacity-50"
        >
          <RefreshCw class="w-4 h-4" :class="pending ? 'animate-spin' : ''" />
          重新整理
        </button>
      </div>

      <!-- Loading state -->
      <div v-if="pending && !dashboardData" class="text-center py-12">
        <Loader2 class="w-12 h-12 animate-spin text-pink-500 mx-auto mb-4" />
        <p class="text-stone-500">載入中...</p>
      </div>

      <!-- Dashboard content -->
      <template v-else-if="dashboardData">
        <!-- Summary statistics -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div class="bg-white rounded-xl p-5 border border-stone-200">
            <div class="flex items-center gap-3">
              <Server class="w-5 h-5 text-stone-400" />
              <div>
                <div class="text-3xl font-bold text-stone-800">{{ dashboardData.summary.totalServices }}</div>
                <div class="text-stone-500 mt-1">服務數量</div>
              </div>
            </div>
          </div>
          <div class="bg-yellow-50 rounded-xl p-5 border border-yellow-200">
            <div class="flex items-center gap-3">
              <AlertTriangle class="w-5 h-5 text-yellow-500" />
              <div>
                <div class="text-3xl font-bold text-yellow-600">{{ dashboardData.summary.servicesWarning }}</div>
                <div class="text-yellow-600 mt-1">警告</div>
              </div>
            </div>
          </div>
          <div class="bg-red-50 rounded-xl p-5 border border-red-200">
            <div class="flex items-center gap-3">
              <AlertCircle class="w-5 h-5 text-red-500" />
              <div>
                <div class="text-3xl font-bold text-red-600">{{ dashboardData.summary.servicesCritical }}</div>
                <div class="text-red-600 mt-1">危急</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Critical alerts -->
        <div
          v-if="dashboardData.summary.servicesCritical > 0"
          class="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl"
        >
          <div class="flex items-center gap-2 mb-2">
            <AlertCircle class="w-5 h-5 text-red-600" />
            <h3 class="font-semibold text-red-800">危急警告</h3>
          </div>
          <ul class="list-disc list-inside text-sm text-red-700 space-y-1">
            <li
              v-for="service in dashboardData.services.filter(s => s.quotas.some(q => q.status === 'critical'))"
              :key="service.serviceId"
            >
              {{ service.serviceName }} 用量接近上限
            </li>
          </ul>
        </div>

        <!-- Service cards grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <AdminUsageCard
            v-for="service in dashboardData.services"
            :key="service.serviceId"
            :service="service"
            @quota-setting-change="handleQuotaSettingChange"
          />
        </div>

        <!-- Last refresh time -->
        <p class="text-sm text-stone-400 text-right mb-8">
          最後更新：{{ formatTime(dashboardData.timestamp) }}
        </p>

        <!-- Voice Management section -->
        <div class="mb-8">
          <div class="flex items-center gap-2 mb-4">
            <Mic class="w-5 h-5 text-stone-600" />
            <h2 class="text-xl font-bold text-stone-800">聲音管理</h2>
          </div>
          <AdminVoicesManagement />
        </div>
      </template>

      <!-- Error state -->
      <div v-else class="text-center py-12">
        <XCircle class="w-12 h-12 text-red-400 mx-auto mb-4" />
        <p class="text-stone-500">無法載入資料</p>
        <button
          @click="refresh()"
          class="mt-4 px-4 py-2 rounded-lg bg-pink-500 text-white hover:bg-pink-600 transition-colors"
        >
          重試
        </button>
      </div>
    </div>
  </div>
</template>
