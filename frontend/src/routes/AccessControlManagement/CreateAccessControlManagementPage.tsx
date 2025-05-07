/* Copyright Contributors to the Open Cluster Management project */

import { PageSection } from '@patternfly/react-core'
import { useTranslation } from 'react-i18next'
import { ErrorPage } from '../../components/ErrorPage'
import { LoadingPage } from '../../components/LoadingPage'
import { useProjects } from '../../hooks/useProjects'
import { NavigationPath } from '../../NavigationPath'
import { AcmEmptyState, AcmPage, AcmPageHeader, Provider } from '../../ui-components'
import { AccessControlManagementForm } from './AccessControlManagementForm'

const CreateAccessControlManagementPage = () => {
  const { t } = useTranslation()
  const { projects, error, loading } = useProjects()

  return (() => {
    switch (true) {
      case error !== undefined:
        return (
          <ErrorPage error={error} />
        )
      case loading:
        return (
          <LoadingPage />
        )
      case projects.length === 0:
        return (
          <AcmPage
            header={
              <AcmPageHeader
                title={t('Add Access Control Management')}
                breadcrumb={[{ text: t('AccessControlManagements'), to: NavigationPath.accessControlManagement }, { text: t('Add Access Control Management') }]}
              />
            }
          >
            <PageSection variant="light" isFilled>
              <AcmEmptyState title={t('Unauthorized')} message={t('rbac.unauthorized.namespace')} showSearchIcon={true} />
            </PageSection>
          </AcmPage>)
      default:
        return (
          <AccessControlManagementForm namespaces={projects} isEditing={false} isViewing={false} credentialsType={Provider.ansible} />
        )
    }
  })();
}

export { CreateAccessControlManagementPage }
