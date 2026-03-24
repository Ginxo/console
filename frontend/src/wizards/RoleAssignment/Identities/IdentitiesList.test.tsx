/* Copyright Contributors to the Open Cluster Management project */

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom-v5-compat'
import { RecoilRoot } from 'recoil'
import { IdentitiesList } from './IdentitiesList'

jest.mock('../../../lib/acm-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

jest.mock('../../../routes/UserManagement/Identities/Users/UsersTable', () => ({
  UsersTable: (props: any) => (
    <div
      id="users-table"
      data-testid="users-table"
      data-arelinks={props.areLinksDisplayed}
      data-additionalusers={JSON.stringify((props.additionalUsers ?? []).map((u: any) => u.metadata.name))}
    >
      Users Table {props.areLinksDisplayed === false ? '(No Links)' : '(With Links)'}
      {props.selectedUser && ` - Selected: ${props.selectedUser.metadata.name}`}
      {props.setSelectedUser && (
        <button
          onClick={() => {
            const mockUser = { metadata: { name: 'test-user', uid: 'test-user-uid' } }
            props.setSelectedUser(mockUser)
          }}
        >
          Select User
        </button>
      )}
    </div>
  ),
}))

jest.mock('../../../routes/UserManagement/Identities/Groups/GroupsTable', () => ({
  GroupsTable: (props: any) => (
    <div
      id="groups-table"
      data-testid="groups-table"
      data-arelinks={props.areLinksDisplayed}
      data-additionalgroups={JSON.stringify((props.additionalGroups ?? []).map((g: any) => g.metadata.name))}
    >
      Groups Table {props.areLinksDisplayed === false ? '(No Links)' : '(With Links)'}
      {props.selectedGroup && ` - Selected: ${props.selectedGroup.metadata.name}`}
      {props.setSelectedGroup && (
        <button
          onClick={() => {
            const mockGroup = { metadata: { name: 'test-group', uid: 'test-group-uid' } }
            props.setSelectedGroup(mockGroup)
          }}
        >
          Select Group
        </button>
      )}
    </div>
  ),
}))

jest.mock('./CreatePreAuthorizedIdentity', () => ({
  CreatePreAuthorizedIdentity: ({ subjectKind, onClose, onSuccess }: any) => {
    const mockCreatedUser = { metadata: { name: 'new-pre-authorized-user', uid: 'new-user-uid' } }
    const mockCreatedGroup = { metadata: { name: 'new-pre-authorized-group', uid: 'new-group-uid' }, users: [] }
    const label = subjectKind === 'User' ? 'Pre-Auth User Form' : 'Pre-Auth Group Form'
    const handleSubmit = () => {
      onSuccess?.(subjectKind === 'User' ? mockCreatedUser : mockCreatedGroup)
      onClose()
    }
    return (
      <div>
        <span>{label}</span>
        <button onClick={onClose}>Cancel</button>
        <button onClick={handleSubmit}>Submit</button>
      </div>
    )
  },
}))

function Component(props: any = {}) {
  return (
    <RecoilRoot>
      <MemoryRouter>
        <IdentitiesList {...props} />
      </MemoryRouter>
    </RecoilRoot>
  )
}

describe('IdentitiesList', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('should render title and per-tab descriptions', () => {
    render(<Component />)

    expect(screen.getByText('Identities')).toBeInTheDocument()
    expect(screen.getByText(/Select a user to assign this role, or/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add pre-authorized user' })).toBeInTheDocument()
  })

  test('should render tabs for Users and Groups', () => {
    render(<Component />)

    expect(screen.getByRole('tab', { name: 'Users tab' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Groups tab' })).toBeInTheDocument()
  })

  test('should show Users tab as active by default', () => {
    render(<Component />)

    const usersTab = screen.getByRole('tab', { name: 'Users tab' })
    expect(usersTab).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Users Table (No Links)')).toBeInTheDocument()
  })

  test('should switch to Groups tab and show group description', () => {
    render(<Component />)

    const groupsTab = screen.getByRole('tab', { name: 'Groups tab' })
    fireEvent.click(groupsTab)

    expect(groupsTab).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText(/Select a group to assign this role, or/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add pre-authorized group' })).toBeInTheDocument()
  })

  test('should show CreatePreAuthorizedIdentity for users when link is clicked', async () => {
    render(<Component />)

    const preAuthorizedLink = screen.getByRole('button', { name: 'Add pre-authorized user' })
    fireEvent.click(preAuthorizedLink)

    await waitFor(() => {
      expect(screen.getByText('Pre-Auth User Form')).toBeInTheDocument()
    })
    expect(screen.queryByText('Users Table (No Links)')).not.toBeInTheDocument()
  })

  test('should show CreatePreAuthorizedIdentity for groups when link is clicked', async () => {
    render(<Component />)

    const groupsTab = screen.getByRole('tab', { name: 'Groups tab' })
    fireEvent.click(groupsTab)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Add pre-authorized group' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Add pre-authorized group' }))

    await waitFor(() => {
      expect(screen.getByText('Pre-Auth Group Form')).toBeInTheDocument()
    })
  })

  test('should return to table when CreatePreAuthorizedIdentity is cancelled', async () => {
    render(<Component />)

    fireEvent.click(screen.getByRole('button', { name: 'Add pre-authorized user' }))

    await waitFor(() => {
      expect(screen.getByText('Pre-Auth User Form')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    await waitFor(() => {
      expect(screen.getByText('Users Table (No Links)')).toBeInTheDocument()
    })
  })

  test('should add created user to additionalUsers on submit', async () => {
    const mockOnUserSelect = jest.fn()
    render(<Component onUserSelect={mockOnUserSelect} />)

    fireEvent.click(screen.getByRole('button', { name: 'Add pre-authorized user' }))

    await waitFor(() => {
      expect(screen.getByText('Pre-Auth User Form')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      expect(screen.getByTestId('users-table')).toBeInTheDocument()
    })

    expect(mockOnUserSelect).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { name: 'new-pre-authorized-user', uid: 'new-user-uid' } })
    )

    const usersTable = screen.getByTestId('users-table')
    expect(usersTable.getAttribute('data-additionalusers')).toContain('new-pre-authorized-user')
  })

  test('should add created group to additionalGroups on submit', async () => {
    const mockOnGroupSelect = jest.fn()
    render(<Component onGroupSelect={mockOnGroupSelect} />)

    fireEvent.click(screen.getByRole('tab', { name: 'Groups tab' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Add pre-authorized group' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Add pre-authorized group' }))

    await waitFor(() => {
      expect(screen.getByText('Pre-Auth Group Form')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      expect(screen.getByTestId('groups-table')).toBeInTheDocument()
    })

    expect(mockOnGroupSelect).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { name: 'new-pre-authorized-group', uid: 'new-group-uid' } })
    )

    const groupsTable = screen.getByTestId('groups-table')
    expect(groupsTable.getAttribute('data-additionalgroups')).toContain('new-pre-authorized-group')
  })

  test('should reset create form when switching tabs', async () => {
    render(<Component />)

    fireEvent.click(screen.getByRole('button', { name: 'Add pre-authorized user' }))

    await waitFor(() => {
      expect(screen.getByText('Pre-Auth User Form')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('tab', { name: 'Groups tab' }))

    await waitFor(() => {
      expect(screen.queryByText('Pre-Auth User Form')).not.toBeInTheDocument()
      expect(screen.getByText('Groups Table (No Links)')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('tab', { name: 'Users tab' }))

    await waitFor(() => {
      expect(screen.queryByText('Pre-Auth User Form')).not.toBeInTheDocument()
      expect(screen.getByText('Users Table (No Links)')).toBeInTheDocument()
    })
  })

  test('should pass areLinksDisplayed=false to both table components', () => {
    render(<Component />)

    expect(screen.getByText('Users Table (No Links)')).toBeInTheDocument()

    const groupsTab = screen.getByRole('tab', { name: 'Groups tab' })
    fireEvent.click(groupsTab)

    expect(screen.getByText('Groups Table (No Links)')).toBeInTheDocument()
  })
})
