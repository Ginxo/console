/* Copyright Contributors to the Open Cluster Management project */
import { RoleAssignmentPreselected } from '../../routes/UserManagement/RoleAssignments/model/role-assignment-preselected'
import { GroupKind, UserKind } from '../../resources'

/**
 * True when subject.kind has changed and is different to preselected subject kind.
 */
export function getIsChangingSubjectForKindChange(
  preselected: RoleAssignmentPreselected | undefined,
  newKind: string
): boolean {
  return preselected?.subject?.kind !== undefined && preselected?.subject?.kind !== newKind
}

/**
 * True when subject.user has changed and is different to preselected.subject.value,
 * or when preselected subject kind is not User.
 */
export function getIsChangingSubjectForUserChange(
  preselected: RoleAssignmentPreselected | undefined,
  users: string[]
): boolean {
  return (
    (preselected?.subject?.kind === UserKind &&
      preselected?.subject?.value !== undefined &&
      !users.includes(preselected.subject.value)) ||
    preselected?.subject?.kind !== UserKind
  )
}

/**
 * True when subject.group has changed and is different to preselected.subject.value,
 * or when preselected subject kind is not Group.
 */
export function getIsChangingSubjectForGroupChange(
  preselected: RoleAssignmentPreselected | undefined,
  groups: string[]
): boolean {
  return (
    (preselected?.subject?.kind === GroupKind &&
      preselected?.subject?.value !== undefined &&
      !groups.includes(preselected.subject.value)) ||
    preselected?.subject?.kind !== GroupKind
  )
}
