/* Copyright Contributors to the Open Cluster Management project */

import { useMemo } from 'react'
import { Cluster } from '../../routes/UserManagement/RoleAssignments/hook/RoleAssignmentDataHook'

type ClusterGranularityValidationProps = {
  selectedNamespaces?: string[]
  clusters: Cluster[]
}

export const useClusterGranularityValidation = ({
  selectedNamespaces,
  clusters,
}: ClusterGranularityValidationProps) => {
  const missingNamespacesClusterMap = useMemo(
    () =>
      clusters.reduce<Record<string, string[]>>((map, cluster) => {
        const namespacesOnCluster = new Set(cluster.namespaces ?? [])
        map[cluster.name] = selectedNamespaces?.filter((ns) => !namespacesOnCluster.has(ns)) ?? []
        return map
      }, {}),
    [clusters, selectedNamespaces]
  )

  const isAnyClusterMissingNamespaces = useMemo(
    () => Object.values(missingNamespacesClusterMap).some((namespaces) => namespaces.length > 0),
    [missingNamespacesClusterMap]
  )

  return { isAnyClusterMissingNamespaces, missingNamespacesClusterMap }
}
