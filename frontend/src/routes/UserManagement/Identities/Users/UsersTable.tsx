/* Copyright Contributors to the Open Cluster Management project */
import { useCallback, useMemo } from 'react'
import { Trans, useTranslation } from '../../../../lib/acm-i18next'
import { DOC_LINKS, ViewDocumentationLink } from '../../../../lib/doc-util'
import { User } from '../../../../resources/rbac'
import { useRecoilValue, useSharedAtoms } from '../../../../shared-recoil'
import { AcmButton, AcmEmptyState, AcmTable, compareStrings } from '../../../../ui-components'
import { IAcmTableButtonAction } from '../../../../ui-components/AcmTable/AcmTableTypes'
import { useFilters, usersTableColumns } from '../IdentityTableHelper'

interface UsersTableProps {
  hiddenColumns?: string[]
  areLinksDisplayed?: boolean
  selectedUser?: User
  setSelectedUser?: (user: User) => void
  additionalUsers?: User[]
  isCreateButtonDisplayed?: boolean
  createButtonText?: string
  onCreateClick?: () => void
  tableActionButtons?: IAcmTableButtonAction[]
}

const UsersTable = ({
  hiddenColumns,
  areLinksDisplayed = true,
  selectedUser,
  setSelectedUser,
  additionalUsers,
  isCreateButtonDisplayed,
  createButtonText,
  onCreateClick,
  tableActionButtons,
}: UsersTableProps) => {
  const { t } = useTranslation()
  const { usersState } = useSharedAtoms()
  const rbacUsers = useRecoilValue(usersState)
  const users = useMemo(() => {
    const all = [...(rbacUsers ?? []), ...(additionalUsers ?? [])]
    const unique = all.filter((u, i, arr) => arr.findIndex((x) => x.metadata.name === u.metadata.name) === i)
    return unique.toSorted((a, b) => compareStrings(a.metadata.name ?? '', b.metadata.name ?? ''))
  }, [rbacUsers, additionalUsers])

  const handleRadioSelect = useCallback(
    (uid: string) => {
      const user = uid ? users.find((user) => user.metadata.uid === uid) : undefined
      if (user) {
        setSelectedUser?.(user)
      }
    },
    [users, setSelectedUser]
  )

  const keyFn = useCallback((user: User) => user.metadata.name ?? '', [])

  const filters = useFilters('user', users)
  const columns = useMemo(
    () =>
      usersTableColumns({
        t,
        hiddenColumns,
        onRadioSelect: setSelectedUser ? handleRadioSelect : () => {},
        areLinksDisplayed,
        selectedIdentity: selectedUser,
      }),
    [areLinksDisplayed, handleRadioSelect, hiddenColumns, selectedUser, setSelectedUser, t]
  )

  return (
    <AcmTable<User>
      key="users-table"
      filters={filters}
      columns={columns}
      keyFn={keyFn}
      items={users}
      tableActionButtons={tableActionButtons}
      resultView={{
        page: 1,
        loading: false,
        refresh: () => {},
        items: [],
        emptyResult: false,
        processedItemCount: 0,
        isPreProcessed: false,
      }}
      emptyState={
        <AcmEmptyState
          title={t(`In order to view Users, add Identity provider`)}
          message={
            <Trans
              i18nKey="Once Identity provider is added, Users will appear in the list after they log in."
              components={{ bold: <strong /> }}
            />
          }
          action={
            <div>
              {isCreateButtonDisplayed && onCreateClick && (
                <AcmButton variant="primary" onClick={onCreateClick}>
                  {createButtonText ?? t('Create user')}
                </AcmButton>
              )}
              <ViewDocumentationLink doclink={DOC_LINKS.IDENTITY_PROVIDER_CONFIGURATION} />
            </div>
          }
        />
      }
    />
  )
}

export { UsersTable }
