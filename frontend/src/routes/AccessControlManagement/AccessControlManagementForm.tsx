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
import { AccessControl, AccessControlApiVersion } from '../../resources/access-control'
import { createResource, patchResource } from '../../resources/utils'
import {
  AcmToastContext
} from '../../ui-components'
import { useAllClusters } from '../Infrastructure/Clusters/ManagedClusters/components/useAllClusters'
import schema from './schema.json'
import { RoleBinding } from '../../resources/access-control'


const AccessControlManagementForm = (
  { isEditing, isViewing, handleModalToggle, hideYaml, accessControl, namespaces: namespacesProp, }: {
    isEditing: boolean
    isViewing: boolean
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

  // Form Values
  const [namespace, setNamespace] = useState('')
  const [createdDate, setCreatedDate] = useState('')
  const [selectedUsers, setSelectedUsers] = useState<RoleBinding[]>([])
  const [name, setName] = useState('')

  const { submitForm } = useContext(LostChangesContext)

  useEffect(() => {
    setNamespace(accessControl?.metadata?.namespace ?? '')
    setCreatedDate(accessControl?.metadata?.creationTimestamp ?? '')
    setSelectedUsers((accessControl?.spec?.roleBindings ?? []) as RoleBinding[])
    setName(accessControl?.metadata?.name ?? '')
  }, [accessControl?.metadata])

  console.log(namespacesProp,'namespacesProp')
  console.log(accessControl,'accessControl')

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

  const stateToData = () => [{
    apiVersion: AccessControlApiVersion,
    kind: accessControl ? accessControl?.kind : 'ClusterPermission',
    metadata: {
      name,
      namespace,
    },
    spec: {
      roleBindings: selectedUsers ? selectedUsers : [{namespace:"",roleRef:{name:"",apiGroup:"",kind:""},subject:{name:"",apiGroup:"",kind:""}}],
    },
    }];

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
            onChange: (value) => {
              setNamespace(value)
            },
            // options: managedClusters.map(namespace => ({
            //   id: namespace.name,
            //   value: namespace.name,
            // })),
            options: namespaceOptions,
            isRequired: true,
            isDisabled: false
          },
          {
            id: 'name',
            type: 'Text',
            label: 'Name',
            placeholder: 'name',
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
            isHidden:true,
          },             
        ],

      },  
      {
        type: 'SectionGroup',
        title: 'Access Control Information',
        sections: selectedUsers.map((user, index) => {
          return {
            type: 'Section',
            title: `Access Control ${index + 1}`,
            wizardTitle: t(`Access Control Details for ${user.subject?.name || 'Unknown User'}`),
            inputs: [
              {
                id: `user-${index}`,
                type: 'Text',
                label: 'Namespace',
                value: user.namespace || '',
                onChange: (value: string) => {
                  setSelectedUsers((prev) => {
                    const updated = [...prev]
                    updated[index] = {
                      ...updated[index],
                      namespace: value,
                    }
                    return updated
                  })
                },
                isRequired: true,
              },
              {
                id: `subject-kind-${index}`,
                type: 'Radio',
                label: '',
                value: user.subject?.kind.toLowerCase() || 'user',
                onChange: (value: string) => {
                  setSelectedUsers((prev) => {
                    const updated = [...prev]
                    const current = updated[index]
                    const kind = value === 'user' ? 'User' : 'Group' as 'User' | 'Group'

                    const newSubject = {
                      kind,
                      apiGroup: 'rbac.authorization.k8s.io',
                      name: current.subject?.name || '',
                    }
                    updated[index] = {
                      ...current,
                      subject: newSubject,
                    }
                    return updated
                  })
                },
                options: [
                  { id: 'user', value: 'user', text: t('User') },
                  { id: 'group', value: 'group', text: t('Group') },
                ],
                isRequired: true,
                isHidden: isViewing ? true : false,
              },
              {
                id: `subject-${index}`,
                type: 'Text',
                label: user.subject?.kind === 'Group' ? t('Group name') : t('User name'),
                value: user.subject?.name || '',
                onChange: (value: string) => {
                  setSelectedUsers((prev) => {
                    const updated = [...prev]
                    const current = updated[index]
                    const newSubject = {
                      kind: current.subject?.kind || 'User',
                      apiGroup: 'rbac.authorization.k8s.io',
                      name: value,
                    }
                    updated[index] = {
                      ...current,
                      subject: newSubject,
                    }
                    return updated
                  })
                },
                isRequired: true,
              },              
              {
                id: `role-${index}`,
                type: 'Select',
                label: t('Role'),
                value: user.roleRef?.name || '',
                onChange: (value) =>
                  setSelectedUsers((prev) => {
                    const updated = [...prev]
                    const roleRef = { ...updated[index].roleRef, name: value }
                    updated[index] = { ...updated[index], roleRef }
                    return updated
                  }),
                options: roles.map(r => ({
                  id: r.id,
                  value: r.value,
                })),
                isRequired: true,
                isDisabled: false,
              },
            ],
          } as Section
        }),
      }
      ,
    ],
    submit: () => {
      let accessControlData = formData?.customData ?? stateToData()
      if (Array.isArray(accessControlData)) {
        accessControlData = accessControlData[0]
      }
      if (isEditing) {
        const accessControl = accessControlData as AccessControl
        console.log(accessControl,'accessControl')
        const patch: { op: 'replace'; path: string; value: unknown }[] = []
        const metadata: AccessControl['metadata'] = accessControl.metadata!
        patch.push({ op: 'replace', path: `/spec/roleBindings`, value: selectedUsers })
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
