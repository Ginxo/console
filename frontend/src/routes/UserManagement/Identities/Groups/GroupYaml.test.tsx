/* Copyright Contributors to the Open Cluster Management project */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom-v5-compat'
import { RecoilRoot } from 'recoil'
import { GroupYaml } from './GroupYaml'
import { Group, UserApiVersion, GroupKind } from '../../../../resources/rbac'
import { useGroupDetailsContext } from './GroupPage'

jest.mock('../../../../lib/acm-i18next', () => ({
  useTranslation: jest.fn().mockReturnValue({
    t: (key: string) => key,
  }),
}))

jest.mock('./GroupPage', () => ({
  ...jest.requireActual('./GroupPage'),
  useGroupDetailsContext: jest.fn(),
}))

const mockUseGroupDetailsContext = useGroupDetailsContext as jest.MockedFunction<typeof useGroupDetailsContext>

function Component() {
  return (
    <RecoilRoot>
      <MemoryRouter>
        <GroupYaml />
      </MemoryRouter>
    </RecoilRoot>
  )
}

describe('GroupYaml', () => {
  beforeEach(() => {
    mockUseGroupDetailsContext.mockClear()
  })

  test('should render group not found message', () => {
    mockUseGroupDetailsContext.mockReturnValue({
      group: undefined,
      users: [],
    })

    render(<Component />)

    expect(screen.getByText('Group not found')).toBeInTheDocument()
  })

  test('should render YAML editor with group data', () => {
    const mockGroup: Group = {
      apiVersion: UserApiVersion,
      kind: GroupKind,
      metadata: {
        name: 'test-group',
        uid: 'test-group-uid',
        creationTimestamp: '2025-01-24T17:48:45Z',
      },
      users: ['test-user'],
    }

    mockUseGroupDetailsContext.mockReturnValue({
      group: mockGroup,
      users: [],
    })

    render(<Component />)

    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  test('should render alert when group is from OIDC', () => {
    const oidcGroup: Group = {
      apiVersion: UserApiVersion,
      kind: GroupKind,
      metadata: {
        name: 'oidc-group',
        uid: 'oidc-group',
        creationTimestamp: '2025-01-24T17:48:45Z',
      },
      users: [],
      isOIDC: true,
    }

    mockUseGroupDetailsContext.mockReturnValue({
      group: oidcGroup,
      users: [],
    })

    render(<Component />)

    expect(screen.getByText("Can't display this information")).toBeInTheDocument()
    expect(
      screen.getByText("The identity is coming from external IDP and this information can't be displayed")
    ).toBeInTheDocument()
  })
})
