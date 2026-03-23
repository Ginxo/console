/* Copyright Contributors to the Open Cluster Management project */

import { Content, PageSection, Tab, Tabs, TabTitleText, Title } from '@patternfly/react-core'
import { Meta, StoryObj } from '@storybook/react'
import React, { useState } from 'react'
import { useTranslation } from '../../../lib/acm-i18next'

const MockUsersTable = ({ onUserClick }: { onUserClick?: () => void }) => (
  <div style={{ padding: '1rem', border: '1px dashed #ccc', textAlign: 'center' }}>
    <h3>Users Table (Mocked)</h3>
    <p>This would show the actual users table with data</p>
    <button onClick={onUserClick} style={{ marginTop: '0.5rem' }}>
      Select Mock User
    </button>
  </div>
)

const MockGroupsTable = ({ onGroupClick }: { onGroupClick?: () => void }) => (
  <div style={{ padding: '1rem', border: '1px dashed #ccc', textAlign: 'center' }}>
    <h3>Groups Table (Mocked)</h3>
    <p>This would show the actual groups table with data</p>
    <button onClick={onGroupClick} style={{ marginTop: '0.5rem' }}>
      Select Mock Group
    </button>
  </div>
)

interface MockedIdentitiesListProps {
  onUserSelect?: (user: any) => void
  onGroupSelect?: (group: any) => void
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

const MockedIdentitiesList = ({ onUserSelect, onGroupSelect }: MockedIdentitiesListProps) => {
  const { t } = useTranslation()
  const [activeTabKey, setActiveTabKey] = useState<string | number>('users')
  const [showCreatePreAuthorizedUser, setShowCreatePreAuthorizedUser] = useState(false)
  const [showCreatePreAuthorizedGroup, setShowCreatePreAuthorizedGroup] = useState(false)

  const handleTabClick = (_event: React.MouseEvent<HTMLElement, MouseEvent>, tabIndex: string | number) => {
    setActiveTabKey(tabIndex)
    setShowCreatePreAuthorizedUser(false)
    setShowCreatePreAuthorizedGroup(false)
  }

  const handleUserClick = () => {
    const mockUser = { name: 'Mock User', id: 'mock-user-1' }
    onUserSelect?.(mockUser)
  }

  const handleGroupClick = () => {
    const mockGroup = { name: 'Mock Group', id: 'mock-group-1' }
    onGroupSelect?.(mockGroup)
  }

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
              <div style={{ padding: '1rem', border: '1px dashed #ccc', textAlign: 'center' }}>
                <h3>Create Pre-Authorized User (Mocked)</h3>
                <button onClick={() => setShowCreatePreAuthorizedUser(false)}>Cancel</button>
                <button onClick={() => setShowCreatePreAuthorizedUser(false)}>Submit</button>
              </div>
            ) : (
              <MockUsersTable onUserClick={handleUserClick} />
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
              <div style={{ padding: '1rem', border: '1px dashed #ccc', textAlign: 'center' }}>
                <h3>Create Pre-Authorized Group (Mocked)</h3>
                <button onClick={() => setShowCreatePreAuthorizedGroup(false)}>Cancel</button>
                <button onClick={() => setShowCreatePreAuthorizedGroup(false)}>Submit</button>
              </div>
            ) : (
              <MockGroupsTable onGroupClick={handleGroupClick} />
            )}
          </div>
        </Tab>
      </Tabs>
    </PageSection>
  )
}

const meta: Meta<typeof MockedIdentitiesList> = {
  title: 'Wizards/RoleAssignment/IdentitiesList',
  component: MockedIdentitiesList,
  argTypes: {
    onUserSelect: { action: 'onUserSelect' },
    onGroupSelect: { action: 'onGroupSelect' },
  },
}

export default meta

type Story = StoryObj<typeof MockedIdentitiesList>

export const Default: Story = {
  args: {
    onUserSelect: (user) => console.log('User selected:', user),
    onGroupSelect: (group) => console.log('Group selected:', group),
  },
}

export const WithoutHandlers: Story = {
  args: {},
}
