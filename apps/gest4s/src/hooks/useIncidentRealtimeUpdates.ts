import { trpc } from '../trpc'

export function useIncidentRealtimeUpdates() {
  const utils = trpc.useUtils()

  const refreshIncidents = async () => {
    await utils.incidents.list.invalidate()
  }

  trpc.incidents.onCreated.useSubscription(undefined, {
    onData: refreshIncidents,
    onError: (error) => console.error('[incident subscription] create error:', error),
  })

  trpc.incidents.onUpdated.useSubscription(undefined, {
    onData: refreshIncidents,
    onError: (error) => console.error('[incident subscription] update error:', error),
  })

  trpc.incidents.onDeleted.useSubscription(undefined, {
    onData: refreshIncidents,
    onError: (error) => console.error('[incident subscription] delete error:', error),
  })
}
