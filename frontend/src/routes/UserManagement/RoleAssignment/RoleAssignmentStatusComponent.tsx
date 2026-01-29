/* Copyright Contributors to the Open Cluster Management project */
import {
  Button,
  ExpandableSection,
  ExpandableSectionVariant,
  Label,
  Popover,
  Spinner,
  Tooltip,
  TooltipProps,
  Truncate,
} from '@patternfly/react-core'
import { CheckCircleIcon, ExclamationCircleIcon, UploadIcon } from '@patternfly/react-icons'
import { useTranslation } from '../../../lib/acm-i18next'
import { RoleAssignmentStatus } from '../../../resources/multicluster-role-assignment'
import { useState } from 'react'

type RoleAssignmentStatusComponentProps = {
  status?: RoleAssignmentStatus
}

const StatusTooltip = ({
  status,
  children,
  content,
  isContentLeftAligned,
}: {
  status: RoleAssignmentStatus
  children: TooltipProps['children']
  content?: React.ReactNode
  isContentLeftAligned?: boolean
}) => (
  <Tooltip
    title={status.status}
    content={content || `${status.reason}: ${status.message}`}
    isContentLeftAligned={isContentLeftAligned}
  >
    {children}
  </Tooltip>
)

const RoleAssignmentStatusComponent = ({ status }: RoleAssignmentStatusComponentProps) => {
  const { t } = useTranslation()

  const [isErrorExpanded, setIsErrorExpanded] = useState(false)

  const onErrorToggle = () => setIsErrorExpanded(!isErrorExpanded)

  switch (status?.status) {
    case 'Active':
      return (
        <StatusTooltip status={status}>
          <Label variant="outline">
            <span style={{ paddingRight: '8px' }}>
              <CheckCircleIcon
                style={{
                  color: 'var(--pf-t--global--icon--color--status--success--default)',
                }}
              />
            </span>
            {t('Active')}
          </Label>
        </StatusTooltip>
      )
    case 'Error':
      return (
        <Popover
          triggerAction="hover"
          headerContent={status.reason}
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
          footerContent={
            <Button icon={<UploadIcon />} variant="primary" onClick={() => {}}>
              {t('Generate missing namespaces')}
            </Button>
          }
        >
          <Label variant="outline">
            <span style={{ paddingRight: '8px' }}>
              <ExclamationCircleIcon color="var(--pf-t--global--icon--color--status--danger--default)" />
            </span>
            {t('Error')}
          </Label>
        </Popover>
      )
    case 'Pending':
      return (
        <StatusTooltip status={status}>
          <Label variant="outline">
            <span style={{ paddingRight: '8px' }}>
              <Spinner isInline aria-label="Role Assignment being applied" />
            </span>
            {t('Pending')}
          </Label>
        </StatusTooltip>
      )
    default:
      return <p>{t('Unknown')}</p>
  }
}

export { RoleAssignmentStatusComponent }
