/* Copyright Contributors to the Open Cluster Management project */

import { useContext } from 'react'
import { useTranslation } from '../../../lib/acm-i18next'
import { Group, User } from '../../../resources/rbac'
import { useRecoilValue, useSharedAtoms } from '../../../shared-recoil'
import { AcmToastContext } from '../../../ui-components/AcmAlert/AcmToast'
import { CreateIdentityForm } from './CreateIdentityForm'
import { CreateIdentityFormDirectAuthentication } from './CreateIdentityFormDirectAuthentication'

function getSaveButtonText(t: ReturnType<typeof useTranslation>['t'], isDirectAuth: boolean, isUser: boolean): string {
  const texts = {
    addUser: t('Add pre-authorized user'),
    addGroup: t('Add pre-authorized group'),
    saveUser: t('Save pre-authorized user'),
    saveGroup: t('Save pre-authorized group'),
  }
  const key = `${isDirectAuth ? 'add' : 'save'}${isUser ? 'User' : 'Group'}` as keyof typeof texts
  return texts[key]
}

interface CreatePreAuthorizedIdentityProps {
  subjectKind: 'User' | 'Group'
  onClose: () => void
  onSuccess: (identity: User | Group) => void
}

export function CreatePreAuthorizedIdentity({ subjectKind, onClose, onSuccess }: CreatePreAuthorizedIdentityProps) {
  const { t } = useTranslation()
  const toastContext = useContext(AcmToastContext)
  const { isDirectAuthenticationEnabledState, claimMappingsState } = useSharedAtoms()
  const isDirectAuthenticationEnabled = useRecoilValue(isDirectAuthenticationEnabledState)
  const claimMappings = useRecoilValue(claimMappingsState)

  const isUser = subjectKind === 'User'

  const handleSuccess = (identity: User | Group) => {
    const name = identity.metadata.name
    let title: string
    let message: string
    if (isDirectAuthenticationEnabled) {
      title = isUser ? t('Pre-authorized user added') : t('Pre-authorized group added')
      message = isUser
        ? t('{{name}} user has been successfully added.', { name })
        : t('{{name}} group has been successfully added.', { name })
    } else {
      title = isUser ? t('Pre-authorized user created') : t('Pre-authorized group created')
      message = isUser
        ? t('{{name}} user has been successfully created.', { name })
        : t('{{name}} group has been successfully created.', { name })
    }
    toastContext.addAlert({ title, message, type: 'success', autoClose: true })
    onSuccess(identity)
    onClose()
  }

  const handleError = (name: string) => {
    toastContext.addAlert({
      title: isUser ? t('Failed to create pre-authorized user') : t('Failed to create pre-authorized group'),
      message: isUser
        ? t('Failed to create pre-authorized user {{name}}. Please try again.', { name })
        : t('Failed to create pre-authorized group {{name}}. Please try again.', { name }),
      type: 'danger',
    })
  }

  const saveButtonText = getSaveButtonText(t, isDirectAuthenticationEnabled, isUser)
  const cancelButtonText = isUser ? t('Cancel and search users instead') : t('Cancel and search groups instead')

  return (
    <div>
      <p style={{ marginBottom: '1rem' }}>
        {t("This role assignment will activate automatically on the identity's first login.")}
      </p>

      {isDirectAuthenticationEnabled ? (
        <CreateIdentityFormDirectAuthentication
          subjectKind={subjectKind}
          claimMappings={claimMappings}
          saveButtonText={saveButtonText}
          cancelButtonText={cancelButtonText}
          onSuccess={handleSuccess}
          onCancel={onClose}
        />
      ) : (
        <CreateIdentityForm
          subjectKind={subjectKind}
          saveButtonText={saveButtonText}
          cancelButtonText={cancelButtonText}
          onSuccess={handleSuccess}
          onCancel={onClose}
          onError={handleError}
        />
      )}
    </div>
  )
}
