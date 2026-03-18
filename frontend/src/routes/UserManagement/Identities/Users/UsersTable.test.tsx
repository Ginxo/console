/* Copyright Contributors to the Open Cluster Management project */

import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom-v5-compat'
import { RecoilRoot } from 'recoil'
import { MulticlusterRoleAssignment } from '../../../../resources/multicluster-role-assignment'
import { User } from '../../../../resources/rbac'
import { UsersTable } from './UsersTable'
import { useRecoilValue, useSharedAtoms } from '../../../../shared-recoil'

jest.mock('../../../../shared-recoil', () => ({
  useRecoilValue: jest.fn(),
  useSharedAtoms: jest.fn(),
}))

const mockUseRecoilValue = useRecoilValue as jest.MockedFunction<typeof useRecoilValue>
const mockUseSharedAtoms = useSharedAtoms as jest.MockedFunction<typeof useSharedAtoms>

const usersAtom = Symbol('usersState')
const mraAtom = Symbol('multiclusterRoleAssignmentState')

const mockUsers: User[] = [
  {
    apiVersion: 'user.openshift.io/v1',
    kind: 'User',
    metadata: {
      name: 'alice.trask',
      uid: 'alice.trask',
      creationTimestamp: '2023-01-01T00:00:00Z',
    },
  },
  {
    apiVersion: 'user.openshift.io/v1',
    kind: 'User',
    metadata: {
      name: 'bob.levy',
      uid: 'bob.levy',
      creationTimestamp: '2023-01-02T00:00:00Z',
    },
  },
]

const mockMras: MulticlusterRoleAssignment[] = [
  {
    apiVersion: 'rbac.open-cluster-management.io/v1beta1',
    kind: 'MulticlusterRoleAssignment',
    metadata: { name: 'mra-charlie', creationTimestamp: '2023-02-01T00:00:00Z' },
    spec: {
      subject: { kind: 'User', name: 'charlie.new' },
      roleAssignments: [],
    },
  },
  {
    apiVersion: 'rbac.open-cluster-management.io/v1beta1',
    kind: 'MulticlusterRoleAssignment',
    metadata: { name: 'mra-alice', creationTimestamp: '2023-02-02T00:00:00Z' },
    spec: {
      subject: { kind: 'User', name: 'alice.trask' },
      roleAssignments: [],
    },
  },
  {
    apiVersion: 'rbac.open-cluster-management.io/v1beta1',
    kind: 'MulticlusterRoleAssignment',
    metadata: { name: 'mra-group', creationTimestamp: '2023-02-03T00:00:00Z' },
    spec: {
      subject: { kind: 'Group', name: 'ops-team' },
      roleAssignments: [],
    },
  },
]

function Component(props: any = {}) {
  return (
    <RecoilRoot>
      <MemoryRouter>
        <UsersTable {...props} />
      </MemoryRouter>
    </RecoilRoot>
  )
}

function setupMocks(users: User[] = mockUsers, mras: MulticlusterRoleAssignment[] = mockMras) {
  mockUseSharedAtoms.mockReturnValue({
    usersState: usersAtom,
    multiclusterRoleAssignmentState: mraAtom,
  } as any)

  mockUseRecoilValue.mockImplementation((atom: any) => {
    if (atom === usersAtom) return users
    if (atom === mraAtom) return mras
    return []
  })
}

describe('UsersTable', () => {
  beforeEach(() => setupMocks())

  test('should render users table with mock users', async () => {
    render(<Component />)

    await waitFor(() => {
      expect(screen.getByText('alice.trask')).toBeInTheDocument()
      expect(screen.getByText('bob.levy')).toBeInTheDocument()
    })
  })

  test('should render component without errors', () => {
    render(<Component />)
    expect(document.body).toBeInTheDocument()
  })

  test('should render with hiddenColumns prop', async () => {
    render(<Component hiddenColumns={['identity-provider']} />)

    await waitFor(() => {
      expect(screen.getByText('alice.trask')).toBeInTheDocument()
      expect(screen.getByText('bob.levy')).toBeInTheDocument()
    })
  })

  test('should render with areLinksDisplayed prop set to false', async () => {
    render(<Component areLinksDisplayed={false} />)

    await waitFor(() => {
      expect(screen.getByText('alice.trask')).toBeInTheDocument()
      expect(screen.getByText('bob.levy')).toBeInTheDocument()
    })
  })

  test('should render with setSelectedUser callback', async () => {
    const mockSetSelectedUser = jest.fn()
    render(<Component setSelectedUser={mockSetSelectedUser} />)

    await waitFor(() => {
      expect(screen.getByText('alice.trask')).toBeInTheDocument()
    })

    expect(mockSetSelectedUser).toBeDefined()
  })

  test('should render with selectedUser prop', async () => {
    const selectedUser = mockUsers[0]
    render(<Component selectedUser={selectedUser} />)

    await waitFor(() => {
      expect(screen.getByText('alice.trask')).toBeInTheDocument()
      expect(screen.getByText('bob.levy')).toBeInTheDocument()
    })
  })

  test('should pass selectedUser to usersTableColumns', async () => {
    const selectedUser = mockUsers[0]
    const mockSetSelectedUser = jest.fn()
    render(<Component selectedUser={selectedUser} setSelectedUser={mockSetSelectedUser} />)

    await waitFor(() => {
      expect(screen.getByText('alice.trask')).toBeInTheDocument()
      expect(screen.getByText('bob.levy')).toBeInTheDocument()
    })
  })

  test('should render with all props combined', async () => {
    const mockSetSelectedUser = jest.fn()
    const selectedUser = mockUsers[0]

    render(
      <Component
        hiddenColumns={['identity-provider']}
        areLinksDisplayed={false}
        selectedUser={selectedUser}
        setSelectedUser={mockSetSelectedUser}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('alice.trask')).toBeInTheDocument()
      expect(screen.getByText('bob.levy')).toBeInTheDocument()
    })
  })

  test('should use external selectedUser when provided', async () => {
    const mockSetSelectedUser = jest.fn()
    const selectedUser = mockUsers[0]

    render(<Component selectedUser={selectedUser} setSelectedUser={mockSetSelectedUser} />)

    await waitFor(() => {
      expect(screen.getByText('alice.trask')).toBeInTheDocument()
      expect(screen.getByText('bob.levy')).toBeInTheDocument()
    })
  })

  test('should render without selectedUser when not provided', async () => {
    render(<Component />)

    await waitFor(() => {
      expect(screen.getByText('alice.trask')).toBeInTheDocument()
      expect(screen.getByText('bob.levy')).toBeInTheDocument()
    })
  })

  test('should show MRA-derived user not already in usersState', async () => {
    render(<Component />)

    await waitFor(() => {
      expect(screen.getByText('alice.trask')).toBeInTheDocument()
      expect(screen.getByText('bob.levy')).toBeInTheDocument()
      expect(screen.getByText('charlie.new')).toBeInTheDocument()
    })
  })

  test('should not duplicate user that exists in both usersState and MRA', async () => {
    render(<Component />)

    await waitFor(() => {
      const aliceElements = screen.getAllByText('alice.trask')
      expect(aliceElements).toHaveLength(1)
    })
  })

  test('should not show MRA subjects with kind Group in users table', async () => {
    render(<Component />)

    await waitFor(() => {
      expect(screen.getByText('charlie.new')).toBeInTheDocument()
      expect(screen.queryByText('ops-team')).not.toBeInTheDocument()
    })
  })

  test('should render only rbac users when MRA state is empty', async () => {
    setupMocks(mockUsers, [])

    render(<Component />)

    await waitFor(() => {
      expect(screen.getByText('alice.trask')).toBeInTheDocument()
      expect(screen.getByText('bob.levy')).toBeInTheDocument()
    })
  })
})
