/* Copyright Contributors to the Open Cluster Management project */

import { useContext, useEffect, useMemo, useState } from 'react'
import { useTranslation } from '../../../lib/acm-i18next'
import { FlattenedRoleAssignment } from '../../../resources/clients/model/flattened-role-assignment'
import { AcmAlertInfoWithId, AcmToastContext } from '../../../ui-components'
import { CommonProjectCreateProgressBar } from '../../../wizards/RoleAssignment/CommonProjectCreateProgressBar'
import { RoleAssignmentStatusComponentProps } from './RoleAssignmentStatusComponent'
import { searchClient } from '../../Search/search-sdk/search-client'
import { useSearchResultItemsQuery } from '../../Search/search-sdk/search-sdk'
import { useClusterNamespaceMap } from '../../../utils/useClusterNamespaceMap'

interface CallbackProgress {
  successCount: number
  errorCount: number
  totalCount: number
  failedClusterNames: string[]
}

const useRoleAssignmentsStatusHook = () => {
  const { clusterNamespaceMap } = useClusterNamespaceMap()

  console.log('KIKE clusterNamespaceMap', clusterNamespaceMap)

  const [callbackProgress, setCallbackProgress] = useState<CallbackProgress>({
    successCount: 0,
    errorCount: 0,
    totalCount: 0,
    failedClusterNames: [],
  })

  const [isProcessingRoleAssignmentMap, setIsProcessingRoleAssignmentMap] = useState<Record<string, boolean>>({})
  const [intervalId, setIntervalId] = useState<NodeJS.Timeout | null>(null)
  const [roleAssignmentToProcess, setRoleAssignmentToProcess] = useState<FlattenedRoleAssignment>()
  const [creatingMissingProjectsAlert, setCreatingMissingProjectsAlert] = useState<AcmAlertInfoWithId>()
  const isAnyRoleAssignmentProcessing = useMemo(() => roleAssignmentToProcess !== undefined, [roleAssignmentToProcess])

  const toastContext = useContext(AcmToastContext)
  const { t } = useTranslation()

  const handleMissingNamespaces = (roleAssignment: FlattenedRoleAssignment) => {
    setIsProcessingRoleAssignmentMap((prev) => ({ ...prev, [roleAssignment.name]: true }))
    setRoleAssignmentToProcess(roleAssignment)
    setCallbackProgress({ successCount: 0, errorCount: 0, totalCount: 10, failedClusterNames: [] })

    setCreatingMissingProjectsAlert(
      toastContext.addAlert({
        title: t('Creating missing projects'),
        message: <CommonProjectCreateProgressBar successCount={0} errorCount={0} totalCount={10} />,
        type: 'info',
        autoClose: false,
      })
    )

    const interval = setInterval(() => {
      const isError = Math.random() < 0.2
      setCallbackProgress((prev) => ({
        ...prev,
        successCount: isError ? prev.successCount : prev.successCount + 1,
        errorCount: isError ? prev.errorCount + 1 : prev.errorCount,
      }))
    }, 200)
    setIntervalId(interval)
  }

  useEffect(() => {
    return () => {
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, [intervalId])

  useEffect(() => {
    return () => {
      if (toastContext && creatingMissingProjectsAlert) {
        toastContext.removeAlert(creatingMissingProjectsAlert)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creatingMissingProjectsAlert])

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
      intervalId &&
      callbackProgress.successCount + callbackProgress.errorCount === callbackProgress.totalCount
    ) {
      clearInterval(intervalId)
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
  }, [callbackProgress, creatingMissingProjectsAlert, intervalId, roleAssignmentToProcess?.name, t, toastContext])

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
