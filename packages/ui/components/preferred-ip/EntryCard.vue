<script setup lang="ts">
import type { PreferredIPEntryStatus } from '~/types'
import {
  IconChevronDown,
  IconChevronRight,
  IconWorld,
  IconWorldWWW,
  IconRefresh,
} from '@tabler/icons-vue'
import { formatTimeFromNow } from '~/utils'

const props = defineProps<{
  entry: PreferredIPEntryStatus
  retesting?: boolean
}>()

const emit = defineEmits<{
  retest: []
}>()

const { t, locale } = useI18n()

const rangesOpen = ref(false)
const isIPv4 = ref(true)
const family = computed(() => (isIPv4.value ? 'v4' : 'v6'))
const isBlocked = computed(() => props.entry.ipv6 === 'block' && !isIPv4.value)
const pool = computed(() =>
  isIPv4.value ? props.entry['v4-pool'] : props.entry['v6-pool'],
)
const testedAt = computed(() =>
  isIPv4.value ? props.entry['v4-tested-at'] : props.entry['v6-tested-at'],
)

const modeLabel = computed(() =>
  props.entry.ipv6 === 'block'
    ? t('preferredIPModeBlock')
    : t('preferredIPModeReplace'),
)

const poolReady = computed(
  () => pool.value !== undefined && pool.value.length > 0,
)
const showEmptyAnswerNote = computed(() => isBlocked.value && !poolReady.value)

const timeAgo = computed(() =>
  testedAt.value ? formatTimeFromNow(testedAt.value, locale.value) : undefined,
)
</script>

<template>
  <div
    class="animate-fade-slide-in flex flex-col gap-3 rounded-2xl border border-[color-mix(in_oklab,var(--color-base-content)_10%,transparent)] bg-base-200/50 p-4 shadow-sm backdrop-blur-sm transition-all duration-200 hover:border-[color-mix(in_oklab,var(--color-base-content)_20%,transparent)]"
  >
    <!-- Header row: name + meta badges + retest action -->
    <div class="flex flex-wrap items-center gap-2">
      <span
        class="flex min-w-0 items-center gap-2 rounded-lg bg-base-300/70 px-2.5 py-1 font-mono text-sm font-semibold text-base-content"
      >
        <span class="truncate">{{ entry.name }}</span>
      </span>

      <span
        v-if="entry.testing"
        class="flex items-center gap-1.5 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary"
      >
        <span class="loading loading-xs loading-ring text-primary" />
        {{ t('preferredIPTesting') }}
      </span>

      <span
        class="rounded-full px-2 py-0.5 text-xs font-medium"
        :class="
          entry.ipv6 === 'block'
            ? 'bg-warning/15 text-warning'
            : 'bg-success/15 text-success'
        "
        :title="t('preferredIPModeHint')"
      >
        {{ modeLabel }}
      </span>

      <span
        class="rounded-full bg-base-content/8 px-2 py-0.5 text-xs font-medium text-base-content/60"
        :title="t('preferredIPAnswerCountHint')"
      >
        {{ t('preferredIPAnswerCount', { count: entry['answer-count'] }) }}
      </span>

      <span
        class="rounded-full bg-base-content/8 px-2 py-0.5 text-xs font-medium text-base-content/60"
        :title="t('preferredIPTTLCapHint')"
      >
        {{ t('preferredIPTTLCap', { seconds: entry['ttl-cap'] }) }}
      </span>

      <span
        v-if="entry.persist"
        class="rounded-full bg-info/15 px-2 py-0.5 text-xs font-medium text-info"
        :title="t('preferredIPPersistHint')"
      >
        {{ t('preferredIPPersist') }}
      </span>

      <div class="ml-auto flex items-center gap-2">
        <Button
          class="flex h-8 items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/10 px-3 text-xs font-semibold text-primary transition-all duration-200 hover:bg-primary/20"
          :disabled="entry.testing || retesting"
          :title="t('preferredIPRetest')"
          @click="emit('retest')"
        >
          <IconRefresh :size="14" :class="{ 'animate-spin': retesting }" />
          {{ t('preferredIPRetest') }}
        </Button>
      </div>
    </div>

    <!-- Family toggle: v4/v6 -->
    <div class="flex items-center gap-2">
      <div
        class="flex gap-1 rounded-lg border border-base-content/8 bg-base-300/40 p-0.5"
      >
        <button
          class="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-all duration-200"
          :class="
            isIPv4
              ? 'bg-primary/20 text-primary'
              : 'text-base-content/60 hover:text-base-content'
          "
          @click="isIPv4 = true"
        >
          <IconWorld :size="14" />
          IPv4
        </button>
        <button
          class="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-all duration-200"
          :class="
            !isIPv4
              ? 'bg-primary/20 text-primary'
              : 'text-base-content/60 hover:text-base-content'
          "
          @click="isIPv4 = false"
        >
          <IconWorldWWW :size="14" />
          IPv6
        </button>
      </div>

      <span v-if="timeAgo" class="text-xs text-base-content/40">
        {{ t('preferredIPTestedAgo', { time: timeAgo }) }}
      </span>

      <div class="ml-auto flex items-center gap-1.5">
        <button
          class="flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-base-content/50 transition-all duration-200 hover:bg-base-content/5 hover:text-base-content"
          @click="rangesOpen = !rangesOpen"
        >
          <IconChevronDown v-if="rangesOpen" :size="14" />
          <IconChevronRight v-else :size="14" />
          {{ t('preferredIPRanges') }}
          <span class="opacity-60">({{ entry.ranges.length }})</span>
        </button>
      </div>
    </div>

    <!-- Range set (collapsible) -->
    <div
      v-if="rangesOpen"
      class="animate-fade-slide-in flex flex-wrap gap-1.5 rounded-xl border border-base-content/6 bg-base-300/30 p-2.5"
    >
      <span
        v-for="range in entry.ranges"
        :key="range"
        class="rounded-md bg-base-content/8 px-2 py-0.5 font-mono text-xs text-base-content/70"
      >
        {{ range }}
      </span>
    </div>

    <!-- Pool of the active family -->
    <div class="flex flex-col gap-2">
      <template v-if="poolReady">
        <div class="flex flex-wrap gap-1.5">
          <div
            v-for="(ip, index) in pool"
            :key="ip"
            class="flex items-center gap-1.5 rounded-lg border border-base-content/8 bg-base-300/40 py-1 pr-2 pl-1 font-mono text-xs"
          >
            <span
              class="flex h-5 min-w-5 items-center justify-center rounded-md bg-primary/15 px-1 text-[0.625rem] font-bold text-primary"
            >
              {{ index + 1 }}
            </span>
            <span class="text-base-content/80">{{ ip }}</span>
          </div>
        </div>
      </template>
      <template v-else>
        <div
          class="flex items-center gap-2 rounded-xl border border-dashed border-base-content/12 px-3 py-2 text-xs text-base-content/50"
        >
          <span class="flex h-1.5 w-1.5 rounded-full bg-base-content/30" />
          {{
            showEmptyAnswerNote
              ? t('preferredIPBlockedEmptyAnswer')
              : t('preferredIPPoolNotReady')
          }}
        </div>
      </template>
    </div>
  </div>
</template>
