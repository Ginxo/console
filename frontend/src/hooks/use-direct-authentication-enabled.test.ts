/* Copyright Contributors to the Open Cluster Management project */

import { renderHook } from '@testing-library/react-hooks'
import { useIsDirectAuthenticationEnabled } from './use-direct-authentication-enabled'
import { Authentication } from '../resources'

let mockAuthentications: Authentication[] = []

jest.mock('../shared-recoil', () => ({
  useSharedAtoms: () => ({
    authenticationsState: 'authenticationsState',
  }),
  useRecoilValue: () => mockAuthentications,
}))

function makeAuthentication(name: string, specType?: string): Authentication {
  return {
    apiVersion: 'config.openshift.io/v1',
    kind: 'Authentication',
    metadata: { name },
    ...(specType !== undefined && { spec: { type: specType } }),
  } as Authentication
}

describe('useIsDirectAuthenticationEnabled', () => {
  beforeEach(() => {
    mockAuthentications = []
  })

  it('should return true when the cluster Authentication CR has spec.type OIDC', () => {
    mockAuthentications = [makeAuthentication('cluster', 'OIDC')]

    const { result } = renderHook(() => useIsDirectAuthenticationEnabled())

    expect(result.current).toBe(true)
  })

  it('should return false when the cluster Authentication CR has spec.type IntegratedOAuth', () => {
    mockAuthentications = [makeAuthentication('cluster', 'IntegratedOAuth')]

    const { result } = renderHook(() => useIsDirectAuthenticationEnabled())

    expect(result.current).toBe(false)
  })

  it('should return false when the cluster Authentication CR has no spec.type', () => {
    mockAuthentications = [makeAuthentication('cluster')]

    const { result } = renderHook(() => useIsDirectAuthenticationEnabled())

    expect(result.current).toBe(false)
  })

  it('should return false when no Authentication CR named cluster exists', () => {
    mockAuthentications = [makeAuthentication('other', 'OIDC')]

    const { result } = renderHook(() => useIsDirectAuthenticationEnabled())

    expect(result.current).toBe(false)
  })

  it('should return false when the authentications list is empty', () => {
    mockAuthentications = []

    const { result } = renderHook(() => useIsDirectAuthenticationEnabled())

    expect(result.current).toBe(false)
  })

  it('should find the cluster CR among multiple Authentication resources', () => {
    mockAuthentications = [makeAuthentication('other', 'IntegratedOAuth'), makeAuthentication('cluster', 'OIDC')]

    const { result } = renderHook(() => useIsDirectAuthenticationEnabled())

    expect(result.current).toBe(true)
  })
})
