/* Copyright Contributors to the Open Cluster Management project */
import { useCallback, useContext, useEffect, useRef, useState } from 'react'
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { useSetRecoilState } from 'recoil'
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import {
  ServerSideEventData,
  useEventStreamIdleGracePeriod,
  useEventStreamIdleTimeout,
  vmClusterRolesState,
  WatchEvent,
} from '../atoms'
import { PluginDataContext } from '../lib/PluginDataContext'
import { usePageActivity } from '../lib/usePageActivity'
import { ClusterRole } from '../resources'
import { getBackendUrl } from '../resources/utils'

function resourceKey(object: WatchEvent['object']): string {
  return `${object.metadata.namespace}/${object.metadata.name}`
}

export function LoadRbacEvents() {
  const { mounted } = useContext(PluginDataContext)
  const idleTimeoutMs = useEventStreamIdleTimeout()
  const gracePeriodMs = useEventStreamIdleGracePeriod()
  const { isActive } = usePageActivity(idleTimeoutMs, mounted)
  const setVMClusterRoles = useSetRecoilState(vmClusterRolesState)

  const wasActiveRef = useRef(true)
  const streamStoppedRef = useRef(false)
  const graceTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const eventSourceRef = useRef<EventSource>()
  const processIntervalRef = useRef<ReturnType<typeof setInterval>>()
  const cacheRef = useRef<Record<string, ClusterRole>>({})
  const [restartKey, setRestartKey] = useState(0)

  const stopStream = useCallback(() => {
    streamStoppedRef.current = true
    eventSourceRef.current?.close()
    eventSourceRef.current = undefined
    if (processIntervalRef.current) {
      clearInterval(processIntervalRef.current)
      processIntervalRef.current = undefined
    }
  }, [])

  useEffect(() => {
    if (!isActive && wasActiveRef.current) {
      wasActiveRef.current = false
      if (gracePeriodMs <= 0) {
        stopStream()
      } else {
        graceTimerRef.current = setTimeout(stopStream, gracePeriodMs)
      }
    } else if (isActive && !wasActiveRef.current) {
      wasActiveRef.current = true
      if (graceTimerRef.current) {
        clearTimeout(graceTimerRef.current)
        graceTimerRef.current = undefined
      }
      if (streamStoppedRef.current) {
        streamStoppedRef.current = false
        cacheRef.current = {}
        setVMClusterRoles([])
        setRestartKey((k) => k + 1)
      }
    }
  }, [isActive, gracePeriodMs, stopStream, setVMClusterRoles])

  useEffect(() => {
    const eventQueue: WatchEvent[] = []
    const cache = cacheRef.current

    function processEventQueue() {
      if (eventQueue.length === 0) return
      const watchEvents = eventQueue.splice(0)
      for (const watchEvent of watchEvents) {
        const key = resourceKey(watchEvent.object)
        switch (watchEvent.type) {
          case 'ADDED':
          case 'MODIFIED':
            cache[key] = watchEvent.object as ClusterRole
            break
          case 'DELETED':
            delete cache[key]
            break
        }
      }
      setVMClusterRoles(Object.values(cache))
    }

    function processMessage(event: MessageEvent) {
      if (!event.data) return
      try {
        const data = JSON.parse(event.data) as ServerSideEventData
        switch (data.type) {
          case 'ADDED':
          case 'MODIFIED':
          case 'DELETED':
            eventQueue.push(data)
            break
          case 'START':
            eventQueue.length = 0
            break
          case 'EOP':
          case 'LOADED':
            processEventQueue()
            break
        }
      } catch (err) {
        console.error(err)
      }
    }

    let evtSource: EventSource | undefined
    function startWatch() {
      evtSource = new EventSource(`${getBackendUrl()}/events/rbac`, { withCredentials: true })
      eventSourceRef.current = evtSource
      evtSource.onmessage = processMessage
      evtSource.onerror = function () {
        if (streamStoppedRef.current) return
        if (evtSource?.readyState === EventSource.CLOSED) {
          setTimeout(() => {
            startWatch()
          }, 1000)
        }
      }
    }
    startWatch()

    const timeout = setInterval(processEventQueue, 500)
    processIntervalRef.current = timeout
    return () => {
      clearInterval(timeout)
      if (evtSource) evtSource.close()
      eventSourceRef.current = undefined
      processIntervalRef.current = undefined
    }
  }, [restartKey, setVMClusterRoles])

  return null
}
