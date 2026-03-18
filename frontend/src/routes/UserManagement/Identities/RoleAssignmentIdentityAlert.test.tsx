/* Copyright Contributors to the Open Cluster Management project */
import { render, screen } from '@testing-library/react'
import { RoleAssignmentIdentityAlert } from './RoleAssignmentIdentityAlert'

jest.mock('../../../lib/acm-i18next', () => ({
  useTranslation: jest.fn().mockReturnValue({
    t: (key: string) => key,
  }),
}))

describe('RoleAssignmentIdentityAlert', () => {
  it('renders a danger alert with the expected title', () => {
    render(<RoleAssignmentIdentityAlert />)

    expect(screen.getByText("Can't display this information")).toBeInTheDocument()
  })

  it('renders the alert body message', () => {
    render(<RoleAssignmentIdentityAlert />)

    expect(
      screen.getByText("The identity is coming from external IDP and this information can't be displayed")
    ).toBeInTheDocument()
  })

  it('renders as an inline danger variant', () => {
    const { container } = render(<RoleAssignmentIdentityAlert />)

    const alert = container.querySelector('.pf-m-danger')
    expect(alert).toBeInTheDocument()

    const inlineAlert = container.querySelector('.pf-m-inline')
    expect(inlineAlert).toBeInTheDocument()
  })
})
