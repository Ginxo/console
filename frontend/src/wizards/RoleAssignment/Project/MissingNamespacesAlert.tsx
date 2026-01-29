/* Copyright Contributors to the Open Cluster Management project */

import { Alert, Button, ExpandableSection, Tooltip } from '@patternfly/react-core'
import { useContext, useState } from 'react'
import { useTranslation } from '../../../lib/acm-i18next'
import { fireManagedClusterActionCreate, ProjectRequestApiVersion, ProjectRequestKind } from '../../../resources'
import { RoleAssignmentLabel } from '../../../routes/UserManagement/RoleAssignment/RoleAssignmentLabel'
import { AcmToastContext } from '../../../ui-components'
import { CommonProjectCreateProgressBar } from './CommonProjectCreateProgressBar'

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
  onSuccess?: (createdNamespaces: string[]) => void
  onError?: (error: Error) => void
}

export const MissingNamespacesAlert = ({
  missingNamespacesClusterMap,
  onSuccess,
  onError,
}: MissingNamespacesAlertProps) => {
  const { t } = useTranslation()
  const [isExpanded, setIsExpanded] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const toastContext = useContext(AcmToastContext)

  const handleGenerateMissingNamespaces = async () => {
    setIsGenerating(true)
    try {
      await Promise.all(
        Object.entries(missingNamespacesClusterMap).map(([clusterName, namespaces]) =>
          namespaces.map((namespace) =>
            fireManagedClusterActionCreate(clusterName, {
              apiVersion: ProjectRequestApiVersion,
              kind: ProjectRequestKind,
              metadata: { name: namespace },
            })
              .then(async (actionResponse) => {
                if (actionResponse.actionDone === 'ActionDone') {
                  toastContext.addAlert({
                    title: t('Common project created'),
                    message: t('{{name}} project has been successfully created for the cluster {{cluster}}.', {
                      name: namespace,
                      cluster: clusterName,
                    }),
                    type: 'success',
                    autoClose: true,
                  })
                } else {
                  throw new Error(actionResponse.message)
                }
              })
              .catch((err) => {
                toastContext.addAlert({
                  title: t('Failed to create common project'),
                  message: t(
                    'Failed to create common project {{name}} for the cluster {{cluster}}. Error: {{error}}.',
                    {
                      name: namespace,
                      cluster: clusterName,
                      error: err.message,
                    }
                  ),
                  type: 'danger',
                  autoClose: true,
                })
                throw err
              })
          )
        )
      )
      onSuccess?.([...new Set(Object.values(missingNamespacesClusterMap).flat())])
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error('Failed to create project')
      onError?.(errorObj)
    } finally {
      setIsGenerating(false)
    }
  }

  return isGenerating ? (
    <Alert variant="info" title={t('Generating missing namespaces...')}>
      <CommonProjectCreateProgressBar successCount={0} errorCount={0} totalCount={0} />
    </Alert>
  ) : (
    <Alert
      variant="danger"
      title={t('Some clusters are missing namespaces')}
      actionLinks={
        <>
          <Tooltip content={t('This will generate missing namespaces per cluster')}>
            <Button variant="secondary" onClick={handleGenerateMissingNamespaces}>
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
