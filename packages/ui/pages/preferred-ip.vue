<script setup lang="ts">
import { IconFlask, IconRefresh, IconTestPipe, IconX } from '@tabler/icons-vue'
import { toast } from 'vue-sonner'
import {
  showRetestToast,
  usePreferredIPCapability,
  usePreferredIPSpeedTestMutation,
  usePreferredIPStatusQuery,
  usePreferredIPVerifyMutation,
} from '~/composables/usePreferredIP'

const { t } = useI18n()
useHead({ title: computed(() => t('preferredIP')) })

// Capability gating (docs/adr/0001): reachable only when the kernel serves
// the fork-only endpoint. Direct URL hits get an explanatory empty state.
const { supported, ready, probing } = usePreferredIPCapability()

const {
  data: entries = ref([]),
  isLoading: isLoadingEntries,
  isFetching: isFetchingEntries,
  refetch: refetchEntries,
} = usePreferredIPStatusQuery()

const retestMutation = usePreferredIPSpeedTestMutation()
const busyEntries = ref(new Set<string>())

const retestAll = computed(() => retestMutation.isPending.value)
const allTesting = computed(
  () => entries.value.length > 0 && entries.value.every((e) => e.testing),
)

function onRetestEntry(entryName: string) {
  busyEntries.value = new Set(busyEntries.value).add(entryName)
  retestMutation.mutate(
    { name: entryName },
    {
      onSuccess: () => toast.success(t('preferredIPRetestStarted')),
      onError: (error) => showRetestToast(error, t),
      onSettled: () => {
        const next = new Set(busyEntries.value)
        next.delete(entryName)
        busyEntries.value = next
      },
    },
  )
}

function onRetestAll() {
  retestMutation.mutate(
    { name: undefined },
    {
      onSuccess: () => toast.success(t('preferredIPRetestAllStarted')),
      onError: (error) => showRetestToast(error, t),
    },
  )
}

async function onRefresh() {
  await refetchEntries()
}

// ---- Verify Rewrite section (per-endpoint remembered domain) ----
const endpointStore = useEndpointStore()
const verifyName = useLocalStorage<Record<string, string>>(
  'preferredIPVerifyName',
  {},
)
const currentVerifyName = computed(() => {
  const id = endpointStore.selectedEndpoint
  return (id && verifyName.value[id]) || ''
})
function rememberVerifyName(name: string) {
  const id = endpointStore.selectedEndpoint
  if (!id) return
  verifyName.value = { ...verifyName.value, [id]: name }
}
const verifyInput = ref(currentVerifyName.value)
watch(
  currentVerifyName,
  (name) => {
    if (name !== verifyInput.value) verifyInput.value = name
  },
  { immediate: true },
)

const verifyMutation = usePreferredIPVerifyMutation()
const verifyNameTrimmed = computed(() => verifyInput.value.trim())

function onVerify() {
  const name = verifyNameTrimmed.value
  if (!name) return
  rememberVerifyName(name)
  verifyMutation.mutate(name)
}

function onVerifyKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') onVerify()
}

function clearVerifyError() {
  verifyMutation.reset()
}
</script>

<template>
  <div class="flex h-full flex-col gap-3 overflow-y-auto">
    <!-- Probing the endpoint capability -->
    <div
      v-if="!ready || probing"
      class="flex flex-1 items-center justify-center"
    >
      <div class="flex flex-col items-center gap-4">
        <span class="loading loading-lg loading-ring text-primary" />
        <span class="text-sm opacity-60">{{ t('preferredIP') }}</span>
      </div>
    </div>

    <!-- Kernel does not serve the fork-only API (docs/adr/0001) -->
    <div
      v-else-if="!supported"
      class="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center"
    >
      <span
        class="flex h-14 w-14 items-center justify-center rounded-2xl bg-base-content/5 text-base-content/40"
      >
        <IconX :size="26" />
      </span>
      <div class="text-sm font-semibold text-base-content/80">
        {{ t('preferredIPUnsupportedTitle') }}
      </div>
      <p class="max-w-md text-xs leading-relaxed text-base-content/50">
        {{ t('preferredIPUnsupportedBody') }}
      </p>
    </div>

    <template v-else>
      <!-- Header -->
      <div
        class="animate-fade-slide-in flex shrink-0 flex-wrap items-center justify-between gap-2 px-1"
      >
        <div class="flex items-center gap-2">
          <h1 class="text-lg font-bold text-base-content">
            {{ t('preferredIP') }}
          </h1>
          <span
            v-if="entries.length"
            class="rounded-full bg-base-content/8 px-2 py-0.5 text-xs font-semibold text-base-content/60"
          >
            {{ entries.length }}
          </span>
        </div>

        <div class="flex items-center gap-2">
          <Button
            class="flex h-8 items-center gap-1.5 rounded-lg border border-base-content/10 bg-base-200/60 px-3 text-xs font-medium text-base-content/80 transition-all duration-200 hover:border-base-content/20"
            :disabled="isLoadingEntries || allTesting"
            :title="t('preferredIPRefresh')"
            @click="onRefresh"
          >
            <IconRefresh
              :size="14"
              :class="{ 'animate-spin': isFetchingEntries }"
            />
            {{ t('preferredIPRefresh') }}
          </Button>

          <Button
            class="flex h-8 items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/10 px-3 text-xs font-semibold text-primary transition-all duration-200 hover:bg-primary/20"
            :disabled="
              entries.length === 0 ||
              retestAll ||
              entries.some((e) => e.testing)
            "
            :title="t('preferredIPRetestAll')"
            @click="onRetestAll"
          >
            <IconTestPipe :size="14" :class="{ 'animate-spin': retestAll }" />
            {{ t('preferredIPRetestAll') }}
          </Button>
        </div>
      </div>

      <!-- Entry list -->
      <div
        v-if="isLoadingEntries && !entries.length"
        class="flex flex-1 items-center justify-center"
      >
        <div class="flex flex-col items-center gap-4">
          <span class="loading loading-lg loading-ring text-primary" />
          <span class="text-sm opacity-60">{{ t('preferredIP') }}</span>
        </div>
      </div>

      <div
        v-else-if="entries.length === 0"
        class="animate-fade-slide-in flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center"
      >
        <span
          class="flex h-14 w-14 items-center justify-center rounded-2xl bg-base-content/5 text-base-content/40"
        >
          <IconFlask :size="26" />
        </span>
        <p class="max-w-md text-sm leading-relaxed text-base-content/50">
          {{ t('preferredIPNoEntries') }}
        </p>
      </div>

      <div v-else class="flex flex-col gap-3">
        <PreferredIPEntryCard
          v-for="entry in entries"
          :key="entry.name"
          :entry="entry"
          :retesting="busyEntries.has(entry.name)"
          @retest="onRetestEntry(entry.name)"
        />
      </div>

      <!-- Verify Rewrite -->
      <div
        class="animate-fade-slide-in mt-1 flex shrink-0 flex-col gap-3 rounded-2xl border border-[color-mix(in_oklab,var(--color-base-content)_10%,transparent)] bg-base-200/50 p-4 shadow-sm backdrop-blur-sm"
      >
        <div class="flex flex-wrap items-center gap-3">
          <h2
            class="flex items-center gap-2 text-sm font-bold text-base-content"
          >
            <IconTestPipe :size="16" class="text-primary" />
            {{ t('preferredIPVerify') }}
          </h2>
          <div
            class="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-base-content/10 bg-base-300/40 px-3 py-1.5 transition-all duration-200 focus-within:border-primary/40 focus-within:shadow-[0_0_0_3px] focus-within:shadow-primary/10"
          >
            <input
              v-model="verifyInput"
              class="w-full min-w-0 bg-transparent font-mono text-sm outline-none placeholder:opacity-40"
              type="text"
              :placeholder="t('preferredIPVerifyPlaceholder')"
              spellcheck="false"
              autocomplete="off"
              @keydown="onVerifyKeydown"
            />
          </div>
          <Button
            class="flex h-8 items-center gap-1.5 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-content transition-all duration-200 hover:bg-primary/90"
            :disabled="!verifyNameTrimmed || verifyMutation.isPending.value"
            @click="onVerify"
          >
            <IconTestPipe
              :size="14"
              :class="{ 'animate-spin': verifyMutation.isPending.value }"
            />
            {{ t('preferredIPVerifyRun') }}
          </Button>
        </div>

        <p class="text-xs leading-relaxed text-base-content/40">
          {{ t('preferredIPVerifyHint') }}
        </p>

        <!-- Verify error -->
        <div
          v-if="verifyMutation.isError.value"
          class="flex items-center gap-2 rounded-xl border border-error/20 bg-error/10 px-3 py-2 text-xs text-error"
        >
          <IconX :size="14" class="shrink-0" />
          <span class="min-w-0 flex-1">
            {{ t('preferredIPVerifyFailed') }}
          </span>
          <button
            class="cursor-pointer text-error/70 transition-colors hover:text-error"
            @click="clearVerifyError"
          >
            {{ t('close') }}
          </button>
        </div>

        <!-- Verify verdicts -->
        <PreferredIPVerdicts
          v-if="verifyMutation.data.value"
          :result="verifyMutation.data.value"
        />
      </div>
    </template>
  </div>
</template>
