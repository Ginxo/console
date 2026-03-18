/* Copyright Contributors to the Open Cluster Management project */
import { RBACResourceYaml } from '../../../../components/RBACResourceYaml'
import { RoleAssignmentIdentityAlert } from '../RoleAssignmentIdentityAlert'
import { useUserDetailsContext } from './UserPage'
import { useUserGroups } from './useUserGroups'

const UserYaml = () => {
  const { user } = useUserDetailsContext()
  const { userWithGroups } = useUserGroups()

  return user?.isOIDC ? (
    <RoleAssignmentIdentityAlert />
  ) : (
    <RBACResourceYaml resource={userWithGroups} resourceType="User" loading={false} />
  )
}

export { UserYaml }
