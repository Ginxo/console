/* Copyright Contributors to the Open Cluster Management project */
import { Content, PageSection, Tab, Tabs, TabTitleText, Title } from '@patternfly/react-core'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from '../../../lib/acm-i18next'
import { Group, User } from '../../../resources/rbac'
import { GroupsTable } from '../../../routes/UserManagement/Identities/Groups/GroupsTable'
import { UsersTable } from '../../../routes/UserManagement/Identities/Users/UsersTable'
import { useRecoilValue, useSharedAtoms } from '../../../shared-recoil'
import { CreatePreAuthorizedIdentity } from './CreatePreAuthorizedIdentity'

interface IdentitiesListProps {
  onUserSelect?: (user: User) => void
  onGroupSelect?: (group: Group) => void
  initialSelectedIdentity?: { kind: 'User' | 'Group'; name: string }
}

const linkStyle = {
  background: 'none',
  border: 'none',
  color: 'var(--pf-global--link--Color)',
  textDecoration: 'underline',
  cursor: 'pointer',
  padding: 0,
  font: 'inherit',
} as const

export function IdentitiesList({ onUserSelect, onGroupSelect, initialSelectedIdentity }: IdentitiesListProps = {}) {
  const { t } = useTranslation()
  const { usersState, groupsState } = useSharedAtoms()
  const users = useRecoilValue(usersState)
  const groups = useRecoilValue(groupsState)

  const [activeTabKey, setActiveTabKey] = useState<string | number>(
    initialSelectedIdentity?.kind === 'Group' ? 'groups' : 'users'
  )
  const [showCreatePreAuthorizedUser, setShowCreatePreAuthorizedUser] = useState(false)
  const [showCreatePreAuthorizedGroup, setShowCreatePreAuthorizedGroup] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | undefined>()
  const [selectedGroup, setSelectedGroup] = useState<Group | undefined>()
  const [additionalUsers, setAdditionalUsers] = useState<User[]>([])
  const [additionalGroups, setAdditionalGroups] = useState<Group[]>([])

  useEffect(() => {
    if (!initialSelectedIdentity) return

    if (initialSelectedIdentity.kind === 'User' && users && !selectedUser) {
      const user = users.find((u) => u.metadata.name === initialSelectedIdentity.name)
      if (user) setSelectedUser(user)
    } else if (initialSelectedIdentity.kind === 'Group' && groups && !selectedGroup) {
      const group = groups.find((g) => g.metadata.name === initialSelectedIdentity.name)
      if (group) setSelectedGroup(group)
    }
  }, [initialSelectedIdentity, users, groups, selectedUser, selectedGroup])

  const handleTabClick = (_event: React.MouseEvent<HTMLElement, MouseEvent>, tabIndex: string | number) => {
    setActiveTabKey(tabIndex)
    setShowCreatePreAuthorizedUser(false)
    setShowCreatePreAuthorizedGroup(false)
  }

  const handleClosePreAuthorizedIdentity = () => {
    setShowCreatePreAuthorizedUser(false)
    setShowCreatePreAuthorizedGroup(false)
  }

  const handleOnUserSelect = useCallback(
    (user: User) => {
      setSelectedUser(user)
      onUserSelect?.(user)
    },
    [onUserSelect]
  )

  const handleOnGroupSelect = useCallback(
    (group: Group) => {
      setSelectedGroup(group)
      onGroupSelect?.(group)
    },
    [onGroupSelect]
  )

  const handleUserCreated = useCallback(
    (identity: User | Group) => {
      const user = identity as User
      setAdditionalUsers((prev) => {
        if (prev.some((u) => u.metadata.name === user.metadata.name)) return prev
        return [...prev, user]
      })
      handleOnUserSelect(user)
    },
    [handleOnUserSelect]
  )

  const handleGroupCreated = useCallback(
    (identity: User | Group) => {
      const group = identity as Group
      setAdditionalGroups((prev) => {
        if (prev.some((g) => g.metadata.name === group.metadata.name)) return prev
        return [...prev, group]
      })
      handleOnGroupSelect(group)
    },
    [handleOnGroupSelect]
  )

  return (
    <PageSection hasBodyWrapper={false}>
      <Title headingLevel="h1" size="lg" style={{ marginBottom: '0.5rem' }}>
        {t('Identities')}
      </Title>

      <Tabs activeKey={activeTabKey} onSelect={handleTabClick} aria-label={t('Identity selection tabs')}>
        <Tab eventKey="users" title={<TabTitleText>{t('Users')}</TabTitleText>} aria-label={t('Users tab')}>
          <div style={{ marginTop: 'var(--pf-t--global--spacer--md)' }}>
            <Content component="p" style={{ marginBottom: '1.5rem' }}>
              {t('Select a user to assign this role, or ')}{' '}
              <button type="button" style={linkStyle} onClick={() => setShowCreatePreAuthorizedUser(true)}>
                {t('add pre-authorized user')}
              </button>
            </Content>

            {showCreatePreAuthorizedUser ? (
              <CreatePreAuthorizedIdentity
                subjectKind="User"
                onClose={handleClosePreAuthorizedIdentity}
                onSuccess={handleUserCreated}
              />
            ) : (
              <UsersTable
                areLinksDisplayed={false}
                selectedUser={selectedUser}
                setSelectedUser={handleOnUserSelect}
                additionalUsers={additionalUsers}
              />
            )}
          </div>
        </Tab>

        <Tab eventKey="groups" title={<TabTitleText>{t('Groups')}</TabTitleText>} aria-label={t('Groups tab')}>
          <div style={{ marginTop: 'var(--pf-t--global--spacer--md)' }}>
            <Content component="p" style={{ marginBottom: '1.5rem' }}>
              {t('Select a group to assign this role, or ')}{' '}
              <button type="button" style={linkStyle} onClick={() => setShowCreatePreAuthorizedGroup(true)}>
                {t('add pre-authorized group')}
              </button>
            </Content>

            {showCreatePreAuthorizedGroup ? (
              <CreatePreAuthorizedIdentity
                subjectKind="Group"
                onClose={handleClosePreAuthorizedIdentity}
                onSuccess={handleGroupCreated}
              />
            ) : (
              <GroupsTable
                areLinksDisplayed={false}
                selectedGroup={selectedGroup}
                setSelectedGroup={handleOnGroupSelect}
                additionalGroups={additionalGroups}
              />
            )}
          </div>
        </Tab>
      </Tabs>
    </PageSection>
  )
}
