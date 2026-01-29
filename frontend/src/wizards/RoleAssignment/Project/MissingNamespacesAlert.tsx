/* Copyright Contributors to the Open Cluster Management project */

import { Alert, Button, ExpandableSection, Tooltip } from '@patternfly/react-core'
import { useState } from 'react'
import { useTranslation } from '../../../lib/acm-i18next'
import { RoleAssignmentLabel } from '../../../routes/UserManagement/RoleAssignment/RoleAssignmentLabel'

const ClusterNamespace = ({ clusterName, namespaces }: { clusterName: string; namespaces: string[] }) => {
  return (
    <div style={{ marginBottom: 'var(--pf-t--global--spacer--md)' }}>
      <p>
        <strong>{clusterName}</strong>
      </p>
      <p>
        <RoleAssignmentLabel elements={namespaces} numLabel={3} />
      </p>
    </div>
  )
}

type MissingNamespacesAlertProps = {
  missingNamespacesClusterMap: Record<string, string[]>
  onGenerateMissingNamespaces: (missingNamespacesClusterMap: Record<string, string[]>) => void
}

export const MissingNamespacesAlert = ({
  missingNamespacesClusterMap,
  onGenerateMissingNamespaces,
}: MissingNamespacesAlertProps) => {
  const { t } = useTranslation()
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <Alert
      variant="danger"
      title={t('Some clusters are missing namespaces')}
      actionLinks={
        <>
          <Tooltip content={t('This will generate missing namespaces per cluster')}>
            <Button variant="secondary" onClick={() => onGenerateMissingNamespaces(missingNamespacesClusterMap)}>
              {t('Generate missing namespaces')}
            </Button>
          </Tooltip>
        </>
      }
    >
      <p>
        {t(
          'Some of the selected clusters are missing namespaces. Please generate missing namespaces. It is possible to generate missing namespaces by selecting the "Generate missing namespaces".'
        )}
      </p>
      <ExpandableSection
        toggleText={isExpanded ? t('Missing namespaces per cluster') : t('Show missing namespaces per cluster')}
        onToggle={(_, isExpanded) => setIsExpanded(isExpanded)}
        isExpanded={isExpanded}
      >
        {Object.entries(missingNamespacesClusterMap)
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          .filter(([_clusterName, namespaces]) => namespaces.length > 0)
          .map(([clusterName, namespaces]) => (
            <ClusterNamespace key={clusterName} clusterName={clusterName} namespaces={namespaces} />
          ))}
      </ExpandableSection>
    </Alert>
  )
}
