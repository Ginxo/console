/* Copyright Contributors to the Open Cluster Management project */
import { useCallback, useContext, useEffect, useState } from 'react'
import { generatePath, useNavigate } from 'react-router-dom-v5-compat'
import { AcmDataFormPage } from '../../components/AcmDataForm'
import { FormData } from '../../components/AcmFormData'
import { LostChangesContext } from '../../components/LostChanges'
import { useTranslation } from '../../lib/acm-i18next'
import { NavigationPath, useBackCancelNavigation } from '../../NavigationPath'
import {
  IResource
} from '../../resources'
import { AccessControl, AccessControlApiVersion } from '../../resources/access-control'
import { createResource, patchResource } from '../../resources/utils'
import {
  AcmLabels,
  AcmToastContext
} from '../../ui-components'
import { useAllClusters } from '../Infrastructure/Clusters/ManagedClusters/components/useAllClusters'
import schema from './schema.json'
import { RoleBinding } from '../../resources/access-control'
import { Stack, StackItem, Title } from '@patternfly/react-core'


const AccessControlManagementForm = (
  { isEditing, isViewing, handleModalToggle, hideYaml, accessControl, namespaces: namespacesProp,isCreatable }: {
    isEditing: boolean
    isViewing: boolean
    isCreatable: boolean
    handleModalToggle?: () => void
    hideYaml?: boolean
    accessControl?: AccessControl
    namespaces?: string[]
  }
) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { back, cancel } = useBackCancelNavigation()
  const toastContext = useContext(AcmToastContext)

  // Data
  const managedClusters = useAllClusters(true)
  const roles = [{id:"1", value:"kubevirt.io:view"},{id:"2", value:"kubevirt.io:edit"},{id:"1", value:"kubevirt.io:admin"}]
  const allUsers = ['Bob', 'Matt', 'Kike', 'Kurtis', 'Oksana']
  const allGroups = ['devs', 'admins', 'qa']

  // Form Values
  const [namespace, setNamespace] = useState('')
  const [createdDate, setCreatedDate] = useState('')
  const [selectedUsers, setSelectedUsers] = useState<RoleBinding[]>([])
  const [name, setName] = useState('')

  const [selectedUserNames, setSelectedUserNames] = useState<string[]>([])
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [selectedNamespaces, setSelectedNamespaces] = useState<string[]>([])
  
  const [subjectType, setSubjectType] = useState<'User' | 'Group'>('User')


  const { submitForm } = useContext(LostChangesContext)


  useEffect(() => {
    setNamespace(accessControl?.metadata?.namespace ?? '')
    setCreatedDate(accessControl?.metadata?.creationTimestamp ?? '')
    setSelectedUsers((accessControl?.spec?.roleBindings ?? []) as RoleBinding[])
    setName(accessControl?.metadata?.name ?? '')
  
    if (accessControl?.spec?.roleBindings) {
      setSelectedUserNames([
        ...new Set(accessControl.spec.roleBindings.map(rb => rb.subject.name)),
      ])
      setSelectedRoles([
        ...new Set(accessControl.spec.roleBindings.map(rb => rb.roleRef.name)),
      ])
      setSelectedNamespaces([
        ...new Set(accessControl.spec.roleBindings.map(rb => rb.namespace)),
      ])
    }
  }, [accessControl?.metadata])

  useEffect(() => {
    if (!isEditing && !isViewing && selectedUsers.length === 0) {
      setSelectedUsers([
        {
          namespace, 
          roleRef: {
            name: '',
            apiGroup: 'rbac.authorization.k8s.io',
            kind:'Role',
          },
          subject: {
            name: '',
            apiGroup: 'rbac.authorization.k8s.io',
            kind: 'User',
          },
        },
      ])
    }
  }, [isEditing, isViewing, selectedUsers.length])
  
  

  const { cancelForm } = useContext(LostChangesContext)
  const guardedHandleModalToggle = useCallback(() => cancelForm(handleModalToggle), [cancelForm, handleModalToggle])

  const stateToData = () => {
    const roleBindings = selectedNamespaces.flatMap((ns) =>
      selectedUserNames.flatMap((user) =>
        selectedRoles.map((role) => ({
          namespace: ns,
          roleRef: {
            name: role,
            apiGroup: 'rbac.authorization.k8s.io',
            kind: 'Role',
          },
          subject: {
            name: user,
            apiGroup: 'rbac.authorization.k8s.io',
            kind: subjectType,
          },
        }))
      )
    )
    
  
    return [
      {
        apiVersion: AccessControlApiVersion,
        kind: accessControl ? accessControl?.kind : 'ClusterPermission',
        metadata: {
          name,
          namespace,
        },
        spec: {
          roleBindings,
        },
      },
    ]
  }
  
  const stateToSyncs = () => [
    { path: 'AccessControl[0].metadata.namespace', setState: setNamespace },
    { path: 'AccessControl[0].metadata.name', setState: setName },
    { path: 'AccessControl[0].spec.roleBindings', setState: setSelectedUsers },
  ]
  
 
  const title = isViewing ? accessControl?.metadata?.uid! : isEditing ? t('Edit access control') : t('Add access control')
  const breadcrumbs = [{ text: t('Access Controls'), to: NavigationPath.accessControlManagement }, { text: title }]

  const namespaceOptions = (namespacesProp ?? managedClusters.map(c => c.name)).map(ns => ({
    id: ns,
    value: ns,
    text: ns,
  }))
 console.log(isCreatable,'isCreatable')
  const formData: FormData = {
    title,
    description: t('An access control stores the... TO BE DEFINED'),
    breadcrumb: breadcrumbs,
    sections: [
      {
        type: 'Section',
        title: t('Basic information'),
        wizardTitle: t('Basic information'),
        inputs: [
          {
            id: 'namespace',
            type: 'Select',
            label: t('Cluster'),
            placeholder:'Select or enter cluster name',
            value: namespace,
            onChange: (value) => {
              setNamespace(value)
            },
            options: namespaceOptions,
            isRequired: true,
          },
          {
            id: 'name',
            type: 'Text',
            label: 'Name',
            placeholder: 'Enter access control name',
            value: name,
            onChange: setName,
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
            isHidden: isCreatable || isEditing,
          },             
        ],
      },    
      {
        type: 'Section',
        title: t('Role Bindings'),
        wizardTitle: t('Role Bindings'),
        inputs: [
          {
            id: 'namespaces',
            type: 'Multiselect',
            label: t('Namespaces'),
            placeholder:'Select or enter namespace',
            value: selectedNamespaces,
            onChange: (values) => setSelectedNamespaces(values),
            options: namespaceOptions,
            isRequired: true,
            isHidden: isViewing,
          },
          {
            id: 'selectionType',
            type: 'Radio',
            label: '',
            value: subjectType.toLowerCase(),
            onChange: (value: string) => {
              setSelectedUserNames([])
              setSubjectType(value === 'group' ? 'Group' : 'User')
            },
            options: [
              { id: 'user', value: 'user', text: t('User') },
              { id: 'group', value: 'group', text: t('Group') },
            ],
            isRequired: true,
            isHidden: isViewing,
          },
          {
            id: 'subject',
            type: 'Multiselect',
            label: subjectType === 'Group' ? t('Groups') : t('Users'),
            placeholder: subjectType === 'Group'? t('Select or enter group name') : t('Select or enter user name'),
            value: selectedUserNames,
            onChange: (values) => setSelectedUserNames(values),
            options: (subjectType === 'Group' ? allGroups : allUsers).map((val) => ({
              id: val,
              value: val,
            })),
            isRequired: true,
            isHidden: isViewing,
          },
          {
            id: 'roles',
            type: 'Multiselect',
            label: t('Roles'),
            placeholder:'Select or enter roles',
            value: selectedRoles,
            onChange: (values) => setSelectedRoles(values),
            options: roles.map(r => ({ id: r.id, value: r.value })),
            isRequired: true,
            isHidden: isViewing,
          },
          {
            id: 'custom-labels',
            type: 'Custom',
            isHidden: !isViewing,
            component: (
              <Stack hasGutter>
                <StackItem>
                  <Title headingLevel="h6">{t('Namespaces')}</Title>
                  <AcmLabels isVertical={false}  labels={selectedNamespaces} />
                </StackItem>
                <StackItem>
                  <Title headingLevel="h6">{t('Users')}</Title>
                  <AcmLabels isVertical={false}  labels={selectedUserNames}/>
                </StackItem>
                <StackItem>
                  <Title headingLevel="h6">{t('Roles')}</Title>
                  <AcmLabels isVertical={false} labels={selectedRoles} />
                </StackItem>
              </Stack>
            ),
          }
        ],
      }
      
    ],
    submit: () => {
      let accessControlData = formData?.customData ?? stateToData()
      if (Array.isArray(accessControlData)) {
        accessControlData = accessControlData[0]
      }
      if (isEditing) {
        const accessControl = accessControlData as AccessControl
        const patch: { op: 'replace'; path: string; value: unknown }[] = []
        const metadata: AccessControl['metadata'] = accessControl.metadata!
        patch.push({ op: 'replace', path: `/spec/roleBindings`, value: accessControl.spec.roleBindings })
        return patchResource(accessControl, patch).promise.then(() => {
          toastContext.addAlert({
            title: t('Acccess Control updated'),
            message: t('accessControlForm.updated.message', { id: metadata.uid }),
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
