import { useTranslation } from '../../lib/acm-i18next'
import { Stack, StackItem, Title } from '@patternfly/react-core'
import { AcmLabels } from '../../ui-components'

export interface RoleBindingSectionProps {
  title: string
  idPrefix: string
  isViewing: boolean
  isRequired: boolean
  selectedNamespaces: string[]
  selectedUserGroups: string[]
  selectedRoles: string[]
  subjectType: 'User' | 'Group'
  namespaceOptions: { id: string; value: string; text: string }[]
  roleOptions: { id: string; value: string }[]
  userGroupOptions: { id: string; value: string }[]
  onNamespaceChange: (values: string[]) => void
  onSubjectTypeChange: (value: string) => void
  onUserGroupChange: (values: string[]) => void
  onRoleChange: (values: string[]) => void
}

export const RoleBindingSection = ({
  title,
  idPrefix,
  isViewing,
  isRequired,
  selectedNamespaces,
  selectedUserGroups,
  selectedRoles,
  subjectType,
  namespaceOptions,
  roleOptions,
  userGroupOptions,
  onNamespaceChange,
  onSubjectTypeChange,
  onUserGroupChange,
  onRoleChange,
}: RoleBindingSectionProps) => {
  const { t } = useTranslation()

  return {
    type: 'Section' as const,
    title: t(title),
    wizardTitle: t(title),
    inputs: [
      {
        id: `${idPrefix}-namespaces`,
        type: 'Multiselect' as const,
        label: t('Namespaces'),
        placeholder: t('Select or enter namespace'),
        value: selectedNamespaces,
        onChange: onNamespaceChange,
        options: namespaceOptions,
        isRequired: isRequired,
        isHidden: isViewing,
      },
      {
        id: `${idPrefix}-selectionType`,
        type: 'Radio' as const,
        label: '',
        value: subjectType.toLowerCase(),
        onChange: onSubjectTypeChange,
        options: [
          { id: 'user', value: 'user', text: t('User') },
          { id: 'group', value: 'group', text: t('Group') },
        ],
        isRequired: isRequired,
        isHidden: isViewing,
      },
      {
        id: `${idPrefix}-subject`,
        type: 'CreatableMultiselect' as const,
        label: subjectType === 'Group' ? t('Groups') : t('Users'),
        placeholder: subjectType === 'Group' ? t('Select or enter group name') : t('Select or enter user name'),
        value: selectedUserGroups,
        onChange: onUserGroupChange,
        options: userGroupOptions,
        isRequired: isRequired,
        isHidden: isViewing,
        isCreatable: true,
      },
      {
        id: `${idPrefix}-roles`,
        type: 'Multiselect' as const,
        label: t('Roles'),
        placeholder: 'Select or enter roles',
        value: selectedRoles,
        onChange: onRoleChange,
        options: roleOptions,
        isRequired: isRequired,
        isHidden: isViewing,
      },
      {
        id: 'custom-labels',
        type: 'Custom' as const,
        isHidden: !isViewing,
        component: (
          <Stack hasGutter>
            <StackItem>
              <Title headingLevel="h6">{t('Namespaces')}</Title>
              <AcmLabels isVertical={false} labels={selectedNamespaces} />
            </StackItem>
            <StackItem>
              <Title headingLevel="h6">{t('Users')}</Title>
              <AcmLabels isVertical={false} labels={selectedUserGroups} />
            </StackItem>
            <StackItem>
              <Title headingLevel="h6">{t('Roles')}</Title>
              <AcmLabels isVertical={false} labels={selectedRoles} />
            </StackItem>
          </Stack>
        ),
      },
    ],
  }
}
