/* Copyright Contributors to the Open Cluster Management project */

import { act, render, waitFor } from '@testing-library/react'
import { createElement, ReactElement } from 'react'
import { RecoilRoot, useRecoilValue } from 'recoil'
import { settingsState, vmClusterRolesState } from '../atoms'
import { PluginDataContext, defaultContext, PluginData } from '../lib/PluginDataContext'
import { ClusterRole } from '../resources'
import { LoadRbacEvents } from './LoadRbacEvents'

let mockIsActive = true
jest.mock('../lib/usePageActivity', () => ({
  usePageActivity: () => ({ isActive: mockIsActive, deadline: null, pageInUse: true }),
}))

jest.mock('../resources/utils', () => ({
  getBackendUrl: () => '',
}))

type FakeEventSource = {
  url: string
  withCredentials: boolean
  readyState: number
  onmessage: ((ev: MessageEvent) => void) | null
  onerror: (() => void) | null
  close: jest.Mock
  emit: (data: unknown) => void
}

let sources: FakeEventSource[] = []
const OriginalEventSource = global.EventSource

beforeEach(() => {
  mockIsActive = true
  sources = []
  global.EventSource = class {
    static readonly CONNECTING = 0
    static readonly OPEN = 1
    static readonly CLOSED = 2
    url: string
    withCredentials: boolean
    readyState = 1
    onmessage: ((ev: MessageEvent) => void) | null = null
    onerror: (() => void) | null = null
    close = jest.fn()
    constructor(url: string | URL, init?: EventSourceInit) {
      this.url = url.toString()
      this.withCredentials = !!init?.withCredentials
      const self = this as unknown as FakeEventSource
      self.emit = (data: unknown) => {
        this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent)
      }
      sources.push(self)
    }
  } as unknown as typeof EventSource
})

afterEach(() => {
  global.EventSource = OriginalEventSource
})

function createTestContext(overrides: Partial<PluginData> = {}): PluginData {
  return {
    ...defaultContext,
    loadStarted: true,
    loadCompleted: true,
    startLoading: true,
    mounted: true,
    ...overrides,
  }
}

function RolesProbe() {
  const roles = useRecoilValue(vmClusterRolesState)
  return createElement('div', { id: 'roles' }, String(roles.length))
}

function Wrapper({ ctx, children }: { ctx: PluginData; children: ReactElement }) {
  return createElement(
    PluginDataContext.Provider,
    { value: ctx },
    createElement(
      RecoilRoot,
      {
        initializeState: ({ set }) => {
          set(settingsState, { EVENT_STREAM_IDLE_TIMEOUT: '1', EVENT_STREAM_IDLE_GRACE_PERIOD: '0' })
        },
      },
      children
    )
  )
}

const sampleRole: ClusterRole = {
  apiVersion: 'rbac.authorization.k8s.io/v1',
  kind: 'ClusterRole',
  metadata: { name: 'kubevirt.io:admin', uid: 'uid-1' },
}

describe('LoadRbacEvents', () => {
  it('opens /events/rbac with credentials and applies ADDED into the atom', async () => {
    const ctx = createTestContext()
    render(
      <Wrapper ctx={ctx}>
        <>
          <LoadRbacEvents />
          <RolesProbe />
        </>
      </Wrapper>
    )

    await waitFor(() => expect(sources.length).toBe(1))
    expect(sources[0].url).toBe('/events/rbac')
    expect(sources[0].withCredentials).toBe(true)

    act(() => {
      sources[0].emit({ type: 'START' })
      sources[0].emit({ type: 'ADDED', object: sampleRole })
      sources[0].emit({ type: 'EOP' })
      sources[0].emit({ type: 'LOADED' })
    })

    await waitFor(() => {
      expect(document.getElementById('roles')?.textContent).toBe('1')
    })
  })

  it('removes DELETED roles from the atom', async () => {
    const ctx = createTestContext()
    render(
      <Wrapper ctx={ctx}>
        <>
          <LoadRbacEvents />
          <RolesProbe />
        </>
      </Wrapper>
    )
    await waitFor(() => expect(sources.length).toBe(1))
    act(() => {
      sources[0].emit({ type: 'ADDED', object: sampleRole })
      sources[0].emit({ type: 'EOP' })
    })
    await waitFor(() => expect(document.getElementById('roles')?.textContent).toBe('1'))
    act(() => {
      sources[0].emit({ type: 'DELETED', object: sampleRole })
      sources[0].emit({ type: 'EOP' })
    })
    await waitFor(() => expect(document.getElementById('roles')?.textContent).toBe('0'))
  })

  it('closes the stream when idle with no grace period', async () => {
    const ctx = createTestContext()
    const { rerender } = render(
      <Wrapper ctx={ctx}>
        <LoadRbacEvents />
      </Wrapper>
    )
    await waitFor(() => expect(sources.length).toBe(1))
    mockIsActive = false
    rerender(
      <Wrapper ctx={ctx}>
        <LoadRbacEvents />
      </Wrapper>
    )
    expect(sources[0].close).toHaveBeenCalled()
  })
})
