import { getOrders } from '../api'

// Module-level singleton — survives Orders.jsx unmounting when the user
// navigates to an order and back (App.jsx remounts pages via key={page}).
// Lets a return-to-list land instantly on the data that was already there
// instead of re-running the full /orders fetch every time.
let cachedOrders = null
let cachedAt = 0
const TTL = 30000

const listeners = new Set()
function notify() {
  listeners.forEach(fn => fn(cachedOrders))
}

// Subscribers get pushed the latest array whenever it changes underneath
// them — e.g. a websocket order_updated patch landing while the list isn't
// even mounted, so it's already current whenever the user does open it.
export function subscribeOrders(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getCachedOrdersSnapshot() {
  return cachedOrders
}

export async function getOrdersFromCache(forceRefresh = false) {
  const isStale = Date.now() - cachedAt > TTL
  if (!forceRefresh && cachedOrders && !isStale) {
    return cachedOrders
  }
  // light=true: server returns only the ~25 fields the list overview,
  // dashboard and app-shell (overdue/counts) actually read — order detail
  // pages fetch their own full record separately via getOrder(id), so this
  // never has to carry every field just for the list view.
  const result = await getOrders({ light: true })
  cachedOrders = Array.isArray(result) ? result : (result?.orders || [])
  cachedAt = Date.now()
  notify()
  return cachedOrders
}

export function invalidateOrdersCache() {
  cachedOrders = null
  cachedAt = 0
}

// Point-update a single order in place (e.g. from a websocket order_updated
// event) without refetching the whole list. No-op if nothing is cached yet.
export function patchOrderInCache(orderId, patch) {
  if (!cachedOrders || !patch) return
  cachedOrders = cachedOrders.map(o => (o.id === orderId ? { ...o, ...patch } : o))
  notify()
}
