/* Copyright Contributors to the Open Cluster Management project */
import { useGroupDetailsContext } from './GroupPage'
import { RBACResourceYaml } from '../../../../components/RBACResourceYaml'
import { RoleAssignmentIdentityAlert } from '../RoleAssignmentIdentityAlert'

const GroupYaml = () => {
  const { group } = useGroupDetailsContext()

  return group?.isOIDC ? (
    <RoleAssignmentIdentityAlert />
  ) : (
    <RBACResourceYaml resource={group} loading={false} resourceType="Group" />
  )
}

export { GroupYaml }
