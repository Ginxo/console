/* Copyright Contributors to the Open Cluster Management project */
import { useCallback, useContext, useEffect, useState } from 'react'
import { generatePath, useNavigate } from 'react-router-dom-v5-compat'
import { AcmDataFormPage } from '../../components/AcmDataForm'
import { FormData, Section } from '../../components/AcmFormData'
import { LostChangesContext } from '../../components/LostChanges'
import { useTranslation } from '../../lib/acm-i18next'
import { NavigationPath, useBackCancelNavigation } from '../../NavigationPath'
import {
  IResource
} from '../../resources'
import { AccessControl, AccessControlApiVersion, AccessControlKind } from '../../resources/access-control'
import { createResource, patchResource } from '../../resources/utils'
import {
  AcmToastContext
} from '../../ui-components'
import { useAllClusters } from '../Infrastructure/Clusters/ManagedClusters/components/useAllClusters'
import schema from './schema.json'
import { RoleBinding } from '../../resources/access-control'


const AccessControlManagementForm = (
  { isEditing, isViewing, handleModalToggle, hideYaml, accessControl }: {
    isEditing: boolean
    isViewing: boolean
    handleModalToggle?: () => void
    hideYaml?: boolean
    accessControl?: AccessControl
  }
) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { back, cancel } = useBackCancelNavigation()
  const toastContext = useContext(AcmToastContext)

  // Data
  const managedClusters = useAllClusters(true)

  // Form Values
  const [namespace, setNamespace] = useState('')
  const [role, setRole] = useState('')
  const [createdDate, setCreatedDate] = useState('')
  const [selectedUsers, setSelectedUsers] = useState<RoleBinding[]>([])


  const { submitForm } = useContext(LostChangesContext)

  useEffect(() => {
    setNamespace(accessControl?.metadata?.namespace ?? '')
    setRole(accessControl?.metadata?.name ?? '')
    setCreatedDate(accessControl?.metadata?.creationTimestamp ?? '')
    setSelectedUsers((accessControl?.spec?.roleBindings ?? []) as RoleBinding[])
  }, [accessControl?.metadata])

  const { cancelForm } = useContext(LostChangesContext)
  const guardedHandleModalToggle = useCallback(() => cancelForm(handleModalToggle), [cancelForm, handleModalToggle])

  const stateToData = () => ({
    apiVersion: AccessControlApiVersion,
    kind: AccessControlKind,
    type: 'Opaque',
    metadata: {
      name: 'tbd', //TODO: proper name and namespace
      namespace: 'tbd',
    },
    data: {
      id: '',
      namespaces: [],
      cluster: namespace,
      roles: [],
      creationTimestamp: ''
    },
  })

  const stateToSyncs = () => [
    { path: 'AccessControl[0].metadata.namespace', setState: setNamespace },
    { path: 'AccessControl[0].metadata.name', setState: setRole },

  ]

  const title = isViewing ? accessControl?.metadata?.uid! : isEditing ? t('Edit access control') : t('Add access control')
  const breadcrumbs = [{ text: t('Access Controls'), to: NavigationPath.accessControlManagement }, { text: title }]
  
  const formData: FormData = {
    title,
    description: t('An access control stores the... TO BE DEFINED'),
    breadcrumb: breadcrumbs,
    sections: [
      {
        type: 'Section',
        title: t('Basic information'),
        wizardTitle: t('Enter the basic Access Control information'),
        inputs: [
          {
            id: 'namespace',
            type: 'Select',
            label: t('Cluster'),
            value: namespace,
            onChange: setNamespace,
            options: managedClusters.map(namespace => ({
              id: namespace.name,
              value: namespace.name,
              text: namespace.name,
            })),
            isRequired: true,
            isDisabled: false
          },
          {
            id: 'name',
            type: 'Text',
            label: 'Name',
            placeholder: 'name',
            value: role,
            onChange: setRole,
            isRequired: true,
          },
          {
            id: 'date',
            type: 'Text',
            label: t('Created at'),
            value: createdDate,
            onChange: setCreatedDate,
            isRequired: true,
            isDisabled: false,
          },             
        ],

      },  
      {
        type: 'SectionGroup',
        title: 'Access Control Information',
        sections: [
          ...[...new Set(selectedUsers.map(user => user.namespace))].map((namespace, index) => {
            const usersForNamespace = selectedUsers.filter(user => user.namespace === namespace);
            const rolesForNamespace = [...new Set(usersForNamespace.map(user => user.roleRef.name))];
            return {
              type: 'Section',
              title: namespace,
              wizardTitle: t(`Enter the Access Control information for ${namespace}`),
              inputs: [
                {
                  id: `${index}`,
                  type: 'Text',
                  label: 'Users',
                  value: [...new Set(usersForNamespace.map(user => user.subject.name))].join(', '),
                  onChange: () => {},
                  isRequired: true,
                  isDisabled: true,
                },
                {
                  id: `${index}`,
                  type: 'Text',
                  label: 'Roles',
                  value: [...new Set(rolesForNamespace)].join(', '),
                  onChange: () => {},
                  isRequired: true,
                  isDisabled: true,
                }
              ]
            }as Section;
          })
        ]
      },
    ],
    submit: () => {
      let accessControlData = formData?.customData ?? stateToData()
      if (Array.isArray(accessControlData)) {
        accessControlData = accessControlData[0]
      }
      if (isEditing) {
        const accessControl = accessControlData as AccessControl
        const patch: { op: 'replace'; path: string; value: unknown }[] = []
        const data: AccessControl['metadata'] = { ...accessControl.metadata!, namespace } // TODO: the rest of fields
        patch.push({ op: 'replace', path: `/data`, value: data })
        return patchResource(accessControl, patch).promise.then(() => {
          toastContext.addAlert({
            title: t('Acccess Control updated'),
            message: t('accessControlForm.updated.message', { id: data.uid }),
            type: 'success',
            autoClose: true,
          })
          submitForm()
          navigate(NavigationPath.accessControlManagement)
        })
      } else {
        return createResource(accessControlData as IResource).promise.then((resource) => {
          toastContext.addAlert({
            title: t('Access Control created'),
            message: t('accessControlForm.created.message', { id: (resource as AccessControl).metadata?.uid }),
            type: 'success',
            autoClose: true,
          })
          submitForm()

          if (handleModalToggle) {
            handleModalToggle()
          } else {
            navigate(NavigationPath.accessControlManagement)
          }
        })
      }
    },
    submitText: isEditing ? t('Save') : t('Add'),
    submittingText: isEditing ? t('Saving') : t('Adding'),
    reviewTitle: t('Review your selections'),
    reviewDescription: t('Return to a step to make changes'),
    cancelLabel: t('Cancel'),
    nextLabel: t('Next'),
    backLabel: t('Back'),
    back: handleModalToggle ? guardedHandleModalToggle : back(NavigationPath.accessControlManagement),
    cancel: handleModalToggle ? guardedHandleModalToggle : cancel(NavigationPath.accessControlManagement),
    stateToSyncs,
    stateToData,
  }

  return (
    <AcmDataFormPage
      formData={formData}
      editorTitle={t('Access Control YAML')}
      schema={schema}
      mode={isViewing ? 'details' : isEditing ? 'form' : 'wizard'}
      hideYaml={hideYaml}
      secrets={[]}
      immutables={
        isEditing
          ? ['*.metadata.name', '*.metadata.namespace', '*.data.id', '*.data.creationTimestamp']
          : []
      }
      edit={() => navigate(
        generatePath(NavigationPath.editAccessControlManagement, {
          id: accessControl?.metadata?.uid!,
        })
      )}
      isModalWizard={!!handleModalToggle}
    />
  )
}

export { AccessControlManagementForm }
