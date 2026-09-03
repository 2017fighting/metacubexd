import type { PreferredIPEntryStatus, PreferredIPVerifyResult } from '~/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { toast } from 'vue-sonner'
import { useRequest } from './useApi'
import { queryKeys, useEndpointScopedKey } from './useQueries'

// ===========================================================================
// Preferred IP — fork-only Clash API surface (docs/adr/0001).
//
// The page, its nav entries, and every query below are gated by a one-shot
// probe of GET /preferred-ip against the current endpoint. Official Mihomo
// kernels 404 it, so the whole surface degrades to hidden; a 200 (even with
// an empty entry list) means the endpoint serves the feature.
// ===========================================================================

// Module-level probe state shared by every consumer (Sidebar, MobileBottomNav,
// the page). Cached per endpoint id so switching back and forth is free.
const probedEndpoint = ref<string | null>(null)
const probing = ref(false)
const supported = ref(false)
const ready = ref(false)
const capabilityCache = new Map<string, boolean>()

async function runProbe(endpointId: string) {
  probing.value = true
  ready.value = false
  try {
    const request = useRequest()
    await request.get('preferred-ip').json()
    supported.value = true
    capabilityCache.set(endpointId, true)
  } catch {
    supported.value = false
    capabilityCache.set(endpointId, false)
  } finally {
    probing.value = false
    ready.value = true
  }
}

export function usePreferredIPCapability() {
  const endpointStore = useEndpointStore()

  watch(
    () => endpointStore.selectedEndpoint,
    (id: string) => {
      if (id === probedEndpoint.value) return
      probedEndpoint.value = id
      if (!id) {
        // No endpoint selected yet: unsupported until one is.
        supported.value = false
        ready.value = true
        return
      }
      const cached = capabilityCache.get(id)
      if (cached !== undefined) {
        supported.value = cached
        ready.value = true
        return
      }
      void runProbe(id)
    },
    { immediate: true },
  )

  return { supported, ready, probing }
}

// ============================== Status ==============================

// Polls only while an entry reports testing=true — that is the single window
// in which state visibly changes (round completion swaps the pools). Otherwise
// the query is fetch-on-mount + manual refetch.
//
// The interval is a Ref driven by a watch on the query data instead of
// refetchInterval's function form, so no function-typed option has to line up
// with the query-key generic (TS7 checker mismatch, see composable history).
export function usePreferredIPStatusQuery() {
  const { supported, ready } = usePreferredIPCapability()
  const pollWhileTesting = ref<number | false>(false)

  const query = useQuery({
    queryKey: useEndpointScopedKey(queryKeys.preferredIP),
    queryFn: async () => {
      const request = useRequest()
      const data = await request
        .get('preferred-ip')
        .json<PreferredIPEntryStatus[]>()
      return Array.isArray(data) ? data : []
    },
    enabled: computed(() => ready.value && supported.value),
    refetchInterval: pollWhileTesting,
    staleTime: 1000,
  })

  watch(
    () => query.data.value,
    (entries) => {
      pollWhileTesting.value =
        entries && entries.some((entry) => entry.testing) ? 2500 : false
    },
    { immediate: true },
  )

  return query
}

// =========================== Speed test =============================

// Retest one entry (name) or all (no name). 409/404 are surfaced to the
// caller through the mutation's onError; the toast copy lives in the page so
// it can tell "already queued" (actionable, do nothing) apart from failures.
export function usePreferredIPSpeedTestMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ name }: { name?: string }) => {
      const request = useRequest()
      // Empty name triggers every entry server-side; ky omits the body when
      // no `json` is passed (backend checks ContentLength > 0).
      await request.post(
        'preferred-ip/speedtest',
        name ? { json: { name } } : undefined,
      )
    },
    onSuccess: () => {
      // The round is async: invalidate once so the UI flips to the polling
      // window as soon as testing=true shows up server-side.
      queryClient.invalidateQueries({ queryKey: queryKeys.preferredIP })
    },
  })
}

// ========================= Verify Rewrite ============================

// One-shot check of the production rewrite decision for a domain; reports the
// v4 and v6 verdicts the DNS hooks would produce (docs/adr/0004).
export function usePreferredIPVerifyMutation() {
  return useMutation({
    mutationFn: async (name: string) => {
      const request = useRequest()
      return await request
        .get(`preferred-ip/verify?name=${encodeURIComponent(name)}`)
        .json<PreferredIPVerifyResult>()
    },
  })
}

// ========================= Toast helpers =============================

export function isRetestAlreadyQueued(error: unknown): boolean {
  // ky throws HTTPError for 4xx; the conflict status means "round already
  // queued/running" (ADR-0004), not a failure the user must act on.
  return (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    (error as { response: { status: number } }).response?.status === 409
  )
}

export function isEntryMissing(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    (error as { response: { status: number } }).response?.status === 404
  )
}

export function showRetestToast(error: unknown, t: (k: string) => string) {
  if (isRetestAlreadyQueued(error)) {
    toast.info(t('preferredIPAlreadyQueued'))
    return
  }
  if (isEntryMissing(error)) {
    toast.error(t('preferredIPEntryNotFound'))
    return
  }
  toast.error(t('preferredIPRetestFailed'))
}
