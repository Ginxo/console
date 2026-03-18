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

  it.each<{ description: string; authentications: Authentication[]; expected: boolean }>([
    {
      description: 'cluster CR has spec.type OIDC',
      authentications: [makeAuthentication('cluster', 'OIDC')],
      expected: true,
    },
    {
      description: 'cluster CR among multiple resources has spec.type OIDC',
      authentications: [makeAuthentication('other', 'IntegratedOAuth'), makeAuthentication('cluster', 'OIDC')],
      expected: true,
    },
    {
      description: 'cluster CR has spec.type IntegratedOAuth',
      authentications: [makeAuthentication('cluster', 'IntegratedOAuth')],
      expected: false,
    },
    {
      description: 'cluster CR has no spec.type',
      authentications: [makeAuthentication('cluster')],
      expected: false,
    },
    {
      description: 'no Authentication CR named cluster exists',
      authentications: [makeAuthentication('other', 'OIDC')],
      expected: false,
    },
    {
      description: 'authentications list is empty',
      authentications: [],
      expected: false,
    },
  ])('should return $expected when $description', ({ authentications, expected }) => {
    mockAuthentications = authentications

    const { result } = renderHook(() => useIsDirectAuthenticationEnabled())

    expect(result.current).toBe(expected)
  })
})
