/* Copyright Contributors to the Open Cluster Management project */

import { useMemo } from 'react'
import { useSharedAtoms, useRecoilValue } from '../shared-recoil'

export function useIsDirectAuthenticationEnabled(): boolean {
  const { authenticationsState } = useSharedAtoms()
  const authentications = useRecoilValue(authenticationsState)
  return useMemo(() => {
    const clusterAuth = authentications.find((auth) => auth.metadata?.name === 'cluster')
    return clusterAuth?.spec?.type === 'OIDC'
  }, [authentications])
}
