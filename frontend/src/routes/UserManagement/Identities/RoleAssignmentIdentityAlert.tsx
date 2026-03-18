/* Copyright Contributors to the Open Cluster Management project */
import { Alert, PageSection } from '@patternfly/react-core'
import { useTranslation } from '../../../lib/acm-i18next'

const RoleAssignmentIdentityAlert = () => {
  const { t } = useTranslation()

  return (
    <PageSection hasBodyWrapper={false}>
      <Alert isInline variant="danger" title={t("Can't display this information")}>
        <p>{t("The identity is coming from external IDP and this information can't be displayed")}</p>
      </Alert>
    </PageSection>
  )
}

export { RoleAssignmentIdentityAlert }
