/* Copyright Contributors to the Open Cluster Management project */
import {
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

const ReasonFooter = ({
  roleAssignment,
  callbacksPerReasonMap,
  areActionButtonsDisabled,
  isCallbackProcessing,
}: {
  roleAssignment: FlattenedRoleAssignment
  callbacksPerReasonMap: RoleAssignmentStatusComponentProps['callbacksPerReasonMap']
  areActionButtonsDisabled?: boolean
  isCallbackProcessing?: boolean
}) => {
  const { t } = useTranslation()
  const callback = roleAssignment.status?.reason ? callbacksPerReasonMap?.[roleAssignment.status.reason] : undefined

  const isMissingNamespaces =
    roleAssignment.status?.reason === 'MissingNamespaces' ||
    (roleAssignment.status?.message?.includes('namespaces') && roleAssignment.status?.message?.includes('not found'))

  return isMissingNamespaces ? (
    <Button
      variant="primary"
      onClick={() => {
        if (callback) {
          callback(roleAssignment)
        } else {
          console.error('No callback method implemented for reason', roleAssignment.status?.reason)
        }
      }}
      isDisabled={areActionButtonsDisabled || !callback}
      isLoading={isCallbackProcessing}
    >
      {t('Create missing projects')}
    </Button>
  ) : null
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
      return t('Missing projects')
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
  areActionButtonsDisabled,
}: {
  roleAssignment: FlattenedRoleAssignment
  icon: TooltipProps['children']
  label: string
  bodyContent?: PopoverProps['bodyContent']
  footerContent?: PopoverProps['footerContent']
  callbacksPerReasonMap: RoleAssignmentStatusComponentProps['callbacksPerReasonMap']
  isCallbackProcessing: boolean
  areActionButtonsDisabled?: boolean
}) => {
  const { t } = useTranslation()
  const reason = roleAssignment.status?.reason ?? t('Not available')
  const message = roleAssignment.status?.message ?? t('Not available')

  return (
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
            areActionButtonsDisabled={areActionButtonsDisabled}
            isCallbackProcessing={isCallbackProcessing}
          />
        )
      }
      position={PopoverPosition.left}
    >
      <Label variant="outline" isDisabled={isCallbackProcessing} aria-disabled={isCallbackProcessing}>
        <span style={{ paddingRight: '8px' }}>{icon}</span>
        {label}
      </Label>
    </Popover>
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
  isCallbackProcessing?: boolean
  areActionButtonsDisabled?: boolean
}

const RoleAssignmentStatusComponent = ({
  roleAssignment,
  callbacksPerReasonMap,
  isCallbackProcessing,
  areActionButtonsDisabled,
}: RoleAssignmentStatusComponentProps) => {
  const { t } = useTranslation()
  const [isErrorExpanded, setIsErrorExpanded] = useState(false)
  const onErrorToggle = () => setIsErrorExpanded(!isErrorExpanded)

  const commonStatusTooltipProps = {
    roleAssignment,
    callbacksPerReasonMap,
    isCallbackProcessing: isCallbackProcessing ?? false,
    areActionButtonsDisabled,
  }

  switch (true) {
    case isCallbackProcessing:
      return (
        <StatusTooltip
          icon={<Spinner isInline aria-label={t('Creating common projects')} />}
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
            <Panel isScrollable>
              <PanelMain>
                <PanelMainBody>
                  <ExpandableSection
                    variant={ExpandableSectionVariant.truncate}
                    toggleText={isErrorExpanded ? t('Show less') : t('Show more')}
                    onToggle={onErrorToggle}
                    isExpanded={isErrorExpanded}
                  >
                    {roleAssignment.status?.message ?? t('Not available')}
                  </ExpandableSection>
                </PanelMainBody>
              </PanelMain>
            </Panel>
          }
          {...commonStatusTooltipProps}
        />
      )
    case roleAssignment.status?.status === 'Pending':
      return (
        <StatusTooltip
          icon={<Spinner isInline aria-label={t('Role Assignment being applied')} />}
          label={t('Pending')}
          {...commonStatusTooltipProps}
        />
      )
    default:
      return <p>{t('Unknown')}</p>
  }
}

export { RoleAssignmentStatusComponent }
