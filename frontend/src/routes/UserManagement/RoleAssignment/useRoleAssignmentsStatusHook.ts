/* Copyright Contributors to the Open Cluster Management project */

import { useContext, useEffect, useState } from 'react'
import { FlattenedRoleAssignment } from '../../../resources/clients/model/flattened-role-assignment'
import { RoleAssignmentStatusComponentProps } from './RoleAssignmentStatusComponent'
import { AcmToastContext } from '../../../ui-components'
import { useTranslation } from '../../../lib/acm-i18next'

const useRoleAssignmentsStatusHook = () => {
  const [callbackProgress, setCallbackProgress] = useState<
    NonNullable<RoleAssignmentStatusComponentProps['callbackProgress']>
  >({
    successCount: 0,
    errorCount: 0,
    totalCount: 0,
  })

  const [isProcessingRoleAssignmentMap, setIsProcessingRoleAssignmentMap] = useState<Record<string, boolean>>({})
  const [intervalId, setIntervalId] = useState<NodeJS.Timeout | null>(null)
  const [roleAssignmentToProcess, setRoleAssignmentToProcess] = useState<FlattenedRoleAssignment>()

  const toastContext = useContext(AcmToastContext)
  const { t } = useTranslation()

  const handleMissingNamespaces = (roleAssignment: FlattenedRoleAssignment) => {
    setIsProcessingRoleAssignmentMap((prev) => ({ ...prev, [roleAssignment.name]: true }))
    setRoleAssignmentToProcess(roleAssignment)
    setCallbackProgress({ successCount: 0, errorCount: 0, totalCount: 10 })

    const interval = setInterval(() => {
      const isError = Math.random() < 0.2
      setCallbackProgress((prev) => ({
        ...prev,
        successCount: isError ? prev.successCount : prev.successCount + 1,
        errorCount: isError ? prev.errorCount + 1 : prev.errorCount,
      }))
    }, 1000)
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
    if (
      roleAssignmentToProcess?.name &&
      intervalId &&
      callbackProgress.successCount + callbackProgress.errorCount === callbackProgress.totalCount
    ) {
      clearInterval(intervalId)
      setIsProcessingRoleAssignmentMap((prev) => ({ ...prev, [roleAssignmentToProcess.name]: false }))
      setRoleAssignmentToProcess(undefined)

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
  }, [callbackProgress, intervalId, roleAssignmentToProcess?.name, t, toastContext])

  const callbacksPerReasonMap: RoleAssignmentStatusComponentProps['callbacksPerReasonMap'] = {
    MissingNamespaces: handleMissingNamespaces,
    // TODO: to remove as soon as reason 'MissingNamespaces' is returned back
    ApplicationFailed: handleMissingNamespaces,
  }
  return {
    callbackProgress,
    callbacksPerReasonMap,
    isProcessingRoleAssignmentMap,
    isCallbackDisabled: roleAssignmentToProcess !== undefined,
  }
}

export { useRoleAssignmentsStatusHook }
