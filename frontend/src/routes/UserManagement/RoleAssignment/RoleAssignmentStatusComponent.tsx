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
  PopoverProps,
  Spinner,
  TooltipProps,
} from '@patternfly/react-core'
import { CheckCircleIcon, ExclamationCircleIcon, UploadIcon } from '@patternfly/react-icons'
import { useState } from 'react'
import { useTranslation } from '../../../lib/acm-i18next'
import { RoleAssignmentStatus } from '../../../resources/multicluster-role-assignment'

type RoleAssignmentStatusComponentProps = {
  status?: RoleAssignmentStatus
}

const ReasonFooter = ({
  status,
  reasonCallbacksMap,
}: RoleAssignmentStatusComponentProps & {
  reasonCallbacksMap?: Partial<Record<NonNullable<RoleAssignmentStatus['reason']>, () => void>>
}) => {
  const { t } = useTranslation()
  const callback = status?.reason ? reasonCallbacksMap?.[status.reason] : undefined
  switch (true) {
    // TODO: to adapt as soon as reason 'MissingNamespaces' is returned back
    case status?.reason === 'MissingNamespaces' ||
      (status?.message?.includes('namespaces') && status?.message?.includes('not found')):
      return (
        <Button
          icon={<UploadIcon />}
          variant="primary"
          onClick={callback ?? (() => console.error('No callback method implemented for reason', status?.reason))}
        >
          {t('Generate missing namespaces')}
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
  status,
  icon,
  label,
  bodyContent,
  footerContent,
  reasonCallbacksMap,
}: {
  status: RoleAssignmentStatus
  icon: TooltipProps['children']
  label: string
  bodyContent?: PopoverProps['bodyContent']
  footerContent?: PopoverProps['footerContent']
  reasonCallbacksMap?: Partial<Record<NonNullable<RoleAssignmentStatus['reason']>, () => void>>
}) => {
  const { t } = useTranslation()
  const reason = status.reason ?? t('Not available')
  const message = status.message ?? t('Not available')

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
      footerContent={footerContent ?? <ReasonFooter status={status} reasonCallbacksMap={reasonCallbacksMap} />}
    >
      <Label variant="outline">
        <span style={{ paddingRight: '8px' }}>{icon}</span>
        {label}
      </Label>
    </Popover>
  )
}

const RoleAssignmentStatusComponent = ({ status }: RoleAssignmentStatusComponentProps) => {
  const { t } = useTranslation()
  const [isErrorExpanded, setIsErrorExpanded] = useState(false)
  const onErrorToggle = () => setIsErrorExpanded(!isErrorExpanded)

  const [isCallbackProcessing, setIsCallbackProcessing] = useState(false)

  const handleMissingNamespaces = () => {
    setIsCallbackProcessing(true)
    setTimeout(() => {
      setIsCallbackProcessing(false)
    }, 3000)
  }

  const reasonCallbacksMap: Partial<Record<NonNullable<RoleAssignmentStatus['reason']>, () => void>> = {
    MissingNamespaces: handleMissingNamespaces,
    // TODO: to adapt as soon as reason 'MissingNamespaces' is returned back
    ApplicationFailed: handleMissingNamespaces,
  }

  const commonStatusTooltipProps = {
    status: status as RoleAssignmentStatus,
    reasonCallbacksMap,
  }

  switch (true) {
    case isCallbackProcessing:
      return <Spinner isInline aria-label="Callback processing" />
    case status?.status === 'Active':
      return (
        <StatusTooltip
          icon={<CheckCircleIcon color="var(--pf-t--global--icon--color--status--success--default)" />}
          label={t('Active')}
          {...commonStatusTooltipProps}
        />
      )
    case status?.status === 'Error':
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
              {status.message}
            </ExpandableSection>
          }
          {...commonStatusTooltipProps}
        />
      )
    case status?.status === 'Pending':
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
}

export { RoleAssignmentStatusComponent }
