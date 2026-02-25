/* Copyright Contributors to the Open Cluster Management project */
import {
  Alert,
  AlertGroup,
  Button,
  ExpandableSection,
  ExpandableSectionVariant,
  Label,
  Panel,
  PanelMain,
  PanelMainBody,
  Popover,
  PopoverPosition,
  PopoverProps,
  Spinner,
  TooltipProps,
} from '@patternfly/react-core'
import { CheckCircleIcon, ExclamationCircleIcon } from '@patternfly/react-icons'
import { useState } from 'react'
import { useTranslation } from '../../../lib/acm-i18next'
import { FlattenedRoleAssignment } from '../../../resources/clients/model/flattened-role-assignment'
import { RoleAssignmentStatus } from '../../../resources/multicluster-role-assignment'
import { CommonProjectCreateProgressBar } from '../../../wizards/RoleAssignment/CommonProjectCreateProgressBar'

const ReasonFooter = ({
  roleAssignment,
  callbacksPerReasonMap,
  isCallbackProcessing,
  isCallbackDisabled,
}: {
  roleAssignment: FlattenedRoleAssignment
  callbacksPerReasonMap: RoleAssignmentStatusComponentProps['callbacksPerReasonMap']
  isCallbackProcessing: boolean
  isCallbackDisabled?: boolean
}) => {
  const { t } = useTranslation()
  const callback = roleAssignment.status?.reason ? callbacksPerReasonMap?.[roleAssignment.status.reason] : undefined
  switch (true) {
    // TODO: to adapt as soon as reason 'MissingNamespaces' is returned back
    case roleAssignment.status?.reason === 'MissingNamespaces' ||
      (roleAssignment.status?.message?.includes('namespaces') && roleAssignment.status?.message?.includes('not found')):
      return (
        <Button
          variant="primary"
          onClick={() =>
            callback
              ? callback(roleAssignment)
              : () => console.error('No callback method implemented for reason', roleAssignment.status?.reason)
          }
          isDisabled={isCallbackProcessing || isCallbackDisabled}
        >
          {t('Create missing projects')}
        </Button>
      )
    default:
      return null
  }
}

const ReasonString = ({ reason }: { reason: RoleAssignmentStatus['reason'] }) => {
  const { t } = useTranslation()
  switch (reason) {
    case 'Processing':
      return t('Processing')
    case 'InvalidReference':
      return t('Invalid reference')
    case 'NoMatchingClusters':
      return t('No matching clusters')
    case 'SuccessfullyApplied':
      return t('Successfully applied')
    case 'MissingNamespaces':
      return t('Missing namespaces')
    case 'ApplicationFailed':
      return t('Application failed')
    default:
      return reason
  }
}

const StatusTooltip = ({
  roleAssignment,
  icon,
  label,
  bodyContent,
  footerContent,
  callbacksPerReasonMap,
  isCallbackProcessing,
  isCallbackDisabled,
}: {
  roleAssignment: FlattenedRoleAssignment
  icon: TooltipProps['children']
  label: string
  bodyContent?: PopoverProps['bodyContent']
  footerContent?: PopoverProps['footerContent']
  callbacksPerReasonMap: RoleAssignmentStatusComponentProps['callbacksPerReasonMap']
  isCallbackProcessing: boolean
  isCallbackDisabled?: boolean
}) => {
  const { t } = useTranslation()
  const reason = roleAssignment.status?.reason ?? t('Not available')
  const message = roleAssignment.status?.message ?? t('Not available')

  const LabelContent = (
    <Label variant="outline" isDisabled={isCallbackProcessing} aria-disabled={true}>
      <span style={{ paddingRight: '8px' }}>{icon}</span>
      {label}
    </Label>
  )

  return isCallbackProcessing ? (
    LabelContent
  ) : (
    <Popover
      triggerAction="hover"
      headerContent={<ReasonString reason={reason} />}
      bodyContent={
        bodyContent ?? (
          <Panel isScrollable>
            <PanelMain tabIndex={0} maxHeight="150px">
              <PanelMainBody style={{ padding: '0px' }}>{message}</PanelMainBody>
            </PanelMain>
          </Panel>
        )
      }
      footerContent={
        footerContent ?? (
          <ReasonFooter
            roleAssignment={roleAssignment}
            callbacksPerReasonMap={callbacksPerReasonMap}
            isCallbackProcessing={isCallbackProcessing}
            isCallbackDisabled={isCallbackDisabled}
          />
        )
      }
      position={PopoverPosition.left}
    >
      {LabelContent}
    </Popover>
  )
}

const CommonProjectCreateAlertProgress = ({
  successCount,
  errorCount,
  totalCount,
}: {
  successCount: number
  errorCount: number
  totalCount: number
}) => {
  const { t } = useTranslation()
  const variant = errorCount > 0 ? 'danger' : successCount === totalCount ? 'success' : 'info'

  return (
    <AlertGroup hasAnimations isToast isLiveRegion>
      <Alert isLiveRegion variant={variant} title={t('Creating missing projects')}>
        <CommonProjectCreateProgressBar
          successCount={successCount}
          errorCount={errorCount}
          totalCount={totalCount}
          hideTitle={true}
        />
      </Alert>
    </AlertGroup>
  )
}

/** Props for the RoleAssignmentStatusComponent
 * @param status - The status of the role assignment
 * @param callbacksPerReasonMap - A map of callbacks per reason. The key is the reason and the value is the callback function. This is used to display the callback button in the status tooltip.
 * @param callbackProgress - The status of the callback processing
 * @param callbackProgress.isProcessing - Whether the callback processing is in progress
 * @param callbackProgress.successCount - The number of successful callbacks
 * @param callbackProgress.errorCount - The number of error callbacks
 * @param callbackProgress.totalCount - The total number of callbacks
 */
export type RoleAssignmentStatusComponentProps = {
  roleAssignment: FlattenedRoleAssignment
  callbacksPerReasonMap?: Partial<
    Record<NonNullable<RoleAssignmentStatus['reason']>, (roleAssignment: FlattenedRoleAssignment) => void>
  >
  callbackProgress?: {
    successCount: number
    errorCount: number
    totalCount: number
  }
  isCallbackProcessing?: boolean
  isCallbackDisabled?: boolean
}

const RoleAssignmentStatusComponent = ({
  roleAssignment,
  callbacksPerReasonMap,
  callbackProgress,
  isCallbackProcessing,
  isCallbackDisabled,
}: RoleAssignmentStatusComponentProps) => {
  const { t } = useTranslation()
  const [isErrorExpanded, setIsErrorExpanded] = useState(false)
  const onErrorToggle = () => setIsErrorExpanded(!isErrorExpanded)

  const commonStatusTooltipProps = {
    roleAssignment,
    callbacksPerReasonMap,
    isCallbackProcessing: isCallbackProcessing ?? false,
    isCallbackDisabled,
  }

  return (
    <>
      {isCallbackProcessing && (
        <CommonProjectCreateAlertProgress
          successCount={callbackProgress?.successCount ?? 0}
          errorCount={callbackProgress?.errorCount ?? 0}
          totalCount={callbackProgress?.totalCount ?? 0}
        />
      )}
      {(() => {
        switch (true) {
          case isCallbackProcessing:
            return (
              <StatusTooltip
                icon={<Spinner isInline aria-label="Creating common projects for the role assignment clusters" />}
                label={t('Creating common projects')}
                {...commonStatusTooltipProps}
              />
            )
          case roleAssignment.status?.status === 'Active':
            return (
              <StatusTooltip
                icon={<CheckCircleIcon color="var(--pf-t--global--icon--color--status--success--default)" />}
                label={t('Active')}
                {...commonStatusTooltipProps}
              />
            )
          case roleAssignment.status?.status === 'Error':
            return (
              <StatusTooltip
                icon={<ExclamationCircleIcon color="var(--pf-t--global--icon--color--status--danger--default)" />}
                label={t('Error')}
                bodyContent={
                  <ExpandableSection
                    variant={ExpandableSectionVariant.truncate}
                    toggleText={isErrorExpanded ? t('Show less') : t('Show more')}
                    onToggle={onErrorToggle}
                    isExpanded={isErrorExpanded}
                  >
                    {roleAssignment.status?.message}
                  </ExpandableSection>
                }
                {...commonStatusTooltipProps}
              />
            )
          case roleAssignment.status?.status === 'Pending':
            return (
              <StatusTooltip
                icon={<Spinner isInline aria-label="Role Assignment being applied" />}
                label={t('Pending')}
                {...commonStatusTooltipProps}
              />
            )
          default:
            return <p>{t('Unknown')}</p>
        }
      })()}
    </>
  )
}

export { RoleAssignmentStatusComponent }
