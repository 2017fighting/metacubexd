import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Hoisted so the vi.mock factory (which runs before the module body) can
// reference them.
const { toast } = vi.hoisted(() => ({
  toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() },
}))

const mockGet = vi.fn()
const mockJson = vi.fn()
mockGet.mockReturnValue({ json: mockJson })

vi.mock('../useApi', () => ({
  useRequest: () => ({ get: mockGet }),
}))

vi.mock('vue-sonner', () => ({ toast }))

// useI18n() returns the key via test/setup.ts.

// The capability composable reads the endpoint store through Nuxt's global
// auto-import. A getter keeps each test's endpoint id reactive-free but
// current — watch's immediate run observes the value set before setup.
let mockEndpointId = ''
vi.stubGlobal('useEndpointStore', () => ({
  get selectedEndpoint() {
    return mockEndpointId
  },
}))

// Re-import per test to reset module-level probe state (mirrors
// useControlInfo.spec's singleton-reset pattern).
async function freshModule() {
  vi.resetModules()
  return await import('../usePreferredIP')
}

describe('composables/usePreferredIP', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockEndpointId = ''
  })

  describe('usePreferredIPCapability', () => {
    it('reports supported once the kernel answers GET /preferred-ip', async () => {
      mockEndpointId = 'a'
      mockJson.mockResolvedValue([])
      const { usePreferredIPCapability } = await freshModule()
      const { supported, ready } = usePreferredIPCapability()

      await vi.waitUntil(() => ready.value)
      expect(supported.value).toBe(true)
      expect(mockGet).toHaveBeenCalledWith('preferred-ip')
    })

    it('degrades to unsupported on 404 (official kernel)', async () => {
      mockEndpointId = 'a'
      mockJson.mockRejectedValue(new Error('404'))
      const { usePreferredIPCapability } = await freshModule()
      const { supported, ready } = usePreferredIPCapability()

      await vi.waitUntil(() => ready.value)
      expect(supported.value).toBe(false)
    })

    it('is unsupported with no endpoint selected, without probing', async () => {
      mockEndpointId = ''
      const { usePreferredIPCapability } = await freshModule()
      const { supported, ready } = usePreferredIPCapability()

      expect(ready.value).toBe(true)
      expect(supported.value).toBe(false)
      expect(mockGet).not.toHaveBeenCalled()
    })

    it('probes once per endpoint even with multiple consumers', async () => {
      mockEndpointId = 'a'
      mockJson.mockResolvedValue([])
      const { usePreferredIPCapability } = await freshModule()
      const first = usePreferredIPCapability()
      await vi.waitUntil(() => first.ready.value)

      const second = usePreferredIPCapability()
      await vi.waitUntil(() => second.ready.value)

      expect(mockGet).toHaveBeenCalledTimes(1)
    })
  })

  describe('retest error classification', () => {
    it('maps HTTP 409 to "already queued" and 404 to "entry missing"', async () => {
      const { isRetestAlreadyQueued, isEntryMissing } = await freshModule()

      expect(isRetestAlreadyQueued({ response: { status: 409 } })).toBe(true)
      expect(isRetestAlreadyQueued({ response: { status: 404 } })).toBe(false)
      expect(isRetestAlreadyQueued(new Error('network'))).toBe(false)
      expect(isEntryMissing({ response: { status: 404 } })).toBe(true)
      expect(isEntryMissing(null)).toBe(false)
    })

    it('toasts info for an already-queued round, error otherwise', async () => {
      const { showRetestToast } = await freshModule()
      const t = (key: string) => key

      showRetestToast({ response: { status: 409 } }, t)
      expect(toast.info).toHaveBeenCalledWith('preferredIPAlreadyQueued')

      showRetestToast(new Error('boom'), t)
      expect(toast.error).toHaveBeenCalledWith('preferredIPRetestFailed')
    })
  })
})
