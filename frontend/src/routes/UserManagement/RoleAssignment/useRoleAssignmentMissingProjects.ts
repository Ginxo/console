/* Copyright Contributors to the Open Cluster Management project */

import { useMemo } from 'react'
import { FlattenedRoleAssignment } from '../../../resources/clients/model/flattened-role-assignment'
import { useAllClusters } from '../../Infrastructure/Clusters/ManagedClusters/components/useAllClusters'

type RoleAssignmentMissingProjectsProps = {
  roleAssignment: FlattenedRoleAssignment
}

export const useRoleAssignmentMissingProjects = ({ roleAssignment }: RoleAssignmentMissingProjectsProps) => {
  const clusters = useAllClusters(true)
  console.log('clusters', clusters)

  const missingProjects = useMemo(() => {
    return roleAssignment.clusterNames.filter((cluster) => !roleAssignment.targetNamespaces?.includes(cluster))
  }, [roleAssignment])

  return { missingProjects }
}
