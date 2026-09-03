<script setup lang="ts">
import type {
  PreferredIPFamilyVerdict,
  PreferredIPVerifyResult,
  PreferredIPVerdict,
} from '~/types'
import {
  IconArrowRight,
  IconBan,
  IconCircleCheck,
  IconQuestionMark,
  IconX,
  IconAlertTriangle,
} from '@tabler/icons-vue'

const props = defineProps<{
  result: PreferredIPVerifyResult
}>()

const { t } = useI18n()

const FAMILY_META = [
  { key: 'v4', labelKey: 'preferredIPFamilyV4' },
  { key: 'v6', labelKey: 'preferredIPFamilyV6' },
] as const

const verdictStyles: Record<
  PreferredIPVerdict | 'unknown',
  { pill: string; icon: unknown }
> = {
  rewritten: {
    pill: 'bg-success/15 text-success',
    icon: IconCircleCheck,
  },
  blocked: {
    pill: 'bg-warning/15 text-warning',
    icon: IconBan,
  },
  'passthrough-no-match': {
    pill: 'bg-info/15 text-info',
    icon: IconArrowRight,
  },
  'passthrough-pool-empty': {
    pill: 'bg-warning/15 text-warning',
    icon: IconAlertTriangle,
  },
  'resolve-error': {
    pill: 'bg-error/15 text-error',
    icon: IconX,
  },
  unknown: {
    pill: 'bg-base-content/8 text-base-content/60',
    icon: IconQuestionMark,
  },
}

function verdictLabel(verdict: PreferredIPVerdict | undefined): string {
  switch (verdict) {
    case 'rewritten':
      return t('preferredIPVerdictRewritten')
    case 'blocked':
      return t('preferredIPVerdictBlocked')
    case 'passthrough-no-match':
      return t('preferredIPVerdictNoMatch')
    case 'passthrough-pool-empty':
      return t('preferredIPVerdictPoolEmpty')
    case 'resolve-error':
      return t('preferredIPVerdictResolveError')
    default:
      return t('preferredIPVerdictUnknown')
  }
}

function verdictDetail(family: PreferredIPFamilyVerdict): string | undefined {
  switch (family.verdict) {
    case 'blocked':
      return t('preferredIPBlockedDetail')
    case 'passthrough-no-match':
      return t('preferredIPNoMatchDetail')
    case 'passthrough-pool-empty':
      return t('preferredIPPoolEmptyDetail')
    case 'resolve-error':
      return t('preferredIPResolveErrorDetail')
    default:
      return undefined
  }
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div
      v-for="family in FAMILY_META"
      :key="family.key"
      class="rounded-xl border border-base-content/6 bg-base-300/25 p-3"
    >
      <div class="flex flex-wrap items-center gap-2">
        <span
          class="text-xs font-semibold tracking-wide text-base-content/60 uppercase"
        >
          {{ t(family.labelKey) }}
        </span>

        <span
          class="flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
          :class="
            verdictStyles[props.result[family.key].verdict ?? 'unknown'].pill
          "
          :title="props.result[family.key].verdict"
        >
          <component
            :is="
              verdictStyles[props.result[family.key].verdict ?? 'unknown'].icon
            "
            :size="13"
          />
          {{ verdictLabel(props.result[family.key].verdict) }}
        </span>

        <span
          v-if="props.result[family.key].entry"
          class="ml-auto flex items-center gap-1 rounded-md bg-base-content/8 px-2 py-0.5 font-mono text-xs text-base-content/70"
          :title="t('preferredIPVerifyMatchedEntry')"
        >
          {{ props.result[family.key].entry }}
        </span>
      </div>

      <div
        v-if="props.result[family.key].verdict === 'rewritten'"
        class="mt-2.5 flex flex-wrap items-center gap-2"
      >
        <div class="flex min-w-0 flex-1 flex-wrap gap-1">
          <span
            v-for="ip in props.result[family.key].upstream"
            :key="ip"
            class="font-mono text-xs text-base-content/45 line-through decoration-base-content/20"
          >
            {{ ip }}
          </span>
          <span
            v-if="!props.result[family.key].upstream?.length"
            class="text-xs text-base-content/40"
          >
            —
          </span>
        </div>
        <IconArrowRight :size="14" class="shrink-0 text-success" />
        <div class="flex min-w-0 flex-1 flex-wrap gap-1.5">
          <span
            v-for="ip in props.result[family.key].rewritten"
            :key="ip"
            class="rounded-md border border-success/20 bg-success/10 px-1.5 py-0.5 font-mono text-xs text-success"
          >
            {{ ip }}
          </span>
        </div>
      </div>

      <p
        v-else-if="verdictDetail(props.result[family.key])"
        class="mt-1.5 text-xs leading-relaxed text-base-content/50"
      >
        {{ verdictDetail(props.result[family.key]) }}
      </p>
    </div>
  </div>
</template>
