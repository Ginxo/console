/* Copyright Contributors to the Open Cluster Management project */

import { useContext, useEffect, useMemo, useState } from 'react'
import { useTranslation } from '../../../lib/acm-i18next'
import { FlattenedRoleAssignment } from '../../../resources/clients/model/flattened-role-assignment'
import { AcmAlertInfoWithId, AcmToastContext } from '../../../ui-components'
import { useClusterNamespaceMap } from '../../../utils/useClusterNamespaceMap'
import { CommonProjectCreateProgressBar } from '../../../wizards/RoleAssignment/CommonProjectCreateProgressBar'
import { RoleAssignmentStatusComponentProps } from './RoleAssignmentStatusComponent'
import { fireManagedClusterActionCreate, ProjectRequestKind, ProjectRequestApiVersion } from '../../../resources'

interface CallbackProgress {
  successCount: number
  errorCount: number
  totalCount: number
  errorClusterNamespacesMap: Record<string, string[]>
}

const getMissingNamespacesPerCluster = (
  clusterNamespaceMap: Record<string, string[]>,
  targetNamespaces: string[],
  clusterNamesSet: Set<string>
) =>
  (Object.keys(clusterNamespaceMap) as string[])
    .filter((cluster) => clusterNamesSet.has(cluster))
    .reduce<Record<string, string[]>>((acc, cluster) => {
      const existingNamespaces = clusterNamespaceMap[cluster] ?? []
      const missing = targetNamespaces.filter((ns) => !existingNamespaces.includes(ns))
      if (missing.length > 0) acc[cluster] = missing
      return acc
    }, {})

const useRoleAssignmentsStatusHook = () => {
  const { clusterNamespaceMap } = useClusterNamespaceMap()
  const [callbackProgress, setCallbackProgress] = useState<CallbackProgress>({
    successCount: 0,
    errorCount: 0,
    totalCount: 0,
    errorClusterNamespacesMap: {},
  })

  const [isProcessingRoleAssignmentMap, setIsProcessingRoleAssignmentMap] = useState<Record<string, boolean>>({})
  const [roleAssignmentToProcess, setRoleAssignmentToProcess] = useState<FlattenedRoleAssignment>()
  const [creatingMissingProjectsAlert, setCreatingMissingProjectsAlert] = useState<AcmAlertInfoWithId>()
  const isAnyRoleAssignmentProcessing = useMemo(() => roleAssignmentToProcess !== undefined, [roleAssignmentToProcess])

  const toastContext = useContext(AcmToastContext)
  const { t } = useTranslation()

  const handleMissingNamespaces = async (roleAssignment: FlattenedRoleAssignment) => {
    const missingNamespacesPerCluster = getMissingNamespacesPerCluster(
      clusterNamespaceMap,
      roleAssignment.targetNamespaces ?? [],
      new Set(roleAssignment.clusterNames ?? [])
    )
    const totalCount = Object.values(missingNamespacesPerCluster).reduce(
      (sum, namespaces) => sum + namespaces.length,
      0
    )

    if (totalCount > 0) {
      setIsProcessingRoleAssignmentMap((prev) => ({ ...prev, [roleAssignment.name]: true }))
      setRoleAssignmentToProcess(roleAssignment)
      setCallbackProgress({ successCount: 0, errorCount: 0, totalCount, errorClusterNamespacesMap: {} })

      setCreatingMissingProjectsAlert(
        toastContext.addAlert({
          title: t('Creating missing projects'),
          message: <CommonProjectCreateProgressBar successCount={0} errorCount={0} totalCount={totalCount} />,
          type: 'info',
          autoClose: false,
        })
      )

      const counter = {
        success: 0,
        error: 0,
        errorClusterNamespacesMap: {} as Record<string, string[]>,
        totalCount,
      }

      await Promise.all(
        Object.entries(missingNamespacesPerCluster).map(([clusterName, namespaces]) =>
          namespaces.map((namespace) =>
            fireManagedClusterActionCreate(clusterName, {
              apiVersion: ProjectRequestApiVersion,
              kind: ProjectRequestKind,
              metadata: { name: namespace },
            })
              .then(async (actionResponse) => {
                if (actionResponse.actionDone === 'ActionDone') {
                  counter.success++
                } else {
                  counter.error++
                  counter.errorClusterNamespacesMap[clusterName] = [
                    ...(counter.errorClusterNamespacesMap[clusterName] || []),
                    namespace,
                  ]
                  toastContext.addAlert({
                    title: t('Error creating missing project'),
                    message: t(
                      'Error creating missing project {{project}} for cluster {{cluster}}. Error: {{error}}.',
                      {
                        project: namespace,
                        cluster: clusterName,
                        error: actionResponse.message,
                      }
                    ),
                    type: 'danger',
                    autoClose: true,
                  })
                }
              })
              .catch((err) => {
                counter.error++
                counter.errorClusterNamespacesMap[clusterName] = [
                  ...(counter.errorClusterNamespacesMap[clusterName] || []),
                  namespace,
                ]
                toastContext.addAlert({
                  title: t('Error creating missing project'),
                  message: t('Error creating missing project {{project}} for cluster {{cluster}}. Error: {{error}}.', {
                    project: namespace,
                    cluster: clusterName,
                    error: err.message,
                  }),
                  type: 'danger',
                  autoClose: true,
                })
              })
              .finally(() =>
                setCallbackProgress((prev) => ({
                  ...prev,
                  successCount: counter.success || 0,
                  errorCount: counter.error || 0,
                  errorClusterNamespacesMap: counter.errorClusterNamespacesMap,
                }))
              )
          )
        )
      )
    } else {
      toastContext.addAlert({
        title: t('No missing namespaces'),
        message: t(
          'No missing namespaces found for {{name}} RoleAssignment. MultiClusterRoleAssignment resource is reconciling information.',
          {
            name: roleAssignment.name,
          }
        ),
        type: 'info',
        autoClose: true,
      })
    }
  }

  useEffect(
    () => () => {
      if (toastContext && creatingMissingProjectsAlert) {
        toastContext.removeAlert(creatingMissingProjectsAlert)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [creatingMissingProjectsAlert]
  )

  useEffect(() => {
    if (creatingMissingProjectsAlert && roleAssignmentToProcess) {
      toastContext.modifyAlert({
        ...creatingMissingProjectsAlert,
        message: (
          <CommonProjectCreateProgressBar
            successCount={callbackProgress.successCount}
            errorCount={callbackProgress.errorCount}
            totalCount={callbackProgress.totalCount}
            hideTitle={true}
          />
        ),
        type: callbackProgress.errorCount > 0 ? 'danger' : 'info',
      })
    }
  }, [callbackProgress, creatingMissingProjectsAlert, roleAssignmentToProcess, toastContext])

  useEffect(() => {
    if (
      roleAssignmentToProcess?.name &&
      callbackProgress.successCount + callbackProgress.errorCount === callbackProgress.totalCount
    ) {
      setIsProcessingRoleAssignmentMap((prev) => ({ ...prev, [roleAssignmentToProcess.name]: false }))
      setRoleAssignmentToProcess(undefined)
      if (creatingMissingProjectsAlert) {
        toastContext.removeAlert(creatingMissingProjectsAlert)
      }

      if (callbackProgress.errorCount > 0) {
        toastContext.addAlert({
          title: t('Error generating missing namespaces'),
          message: t(
            'Error generating missing namespaces for {{name}}. {{errorCount}} errors occurred. Please try again.',
            {
              name: roleAssignmentToProcess.name,
              errorCount: callbackProgress.errorCount,
            }
          ),
          type: 'danger',
          autoClose: true,
        })
      } else {
        toastContext.addAlert({
          title: t('Missing namespaces generated'),
          message: t('Missing namespaces for {{name}} have been successfully generated.', {
            name: roleAssignmentToProcess.name,
          }),
          type: 'success',
          autoClose: true,
        })
      }
    }
  }, [callbackProgress, creatingMissingProjectsAlert, roleAssignmentToProcess?.name, t, toastContext])

  const callbacksPerReasonMap: RoleAssignmentStatusComponentProps['callbacksPerReasonMap'] = {
    MissingNamespaces: handleMissingNamespaces,
    // TODO: to remove as soon as reason 'MissingNamespaces' is returned back
    ApplicationFailed: handleMissingNamespaces,
  }
  return {
    callbacksPerReasonMap,
    isProcessingRoleAssignmentMap,
    isAnyRoleAssignmentProcessing,
  }
}

export { useRoleAssignmentsStatusHook }
