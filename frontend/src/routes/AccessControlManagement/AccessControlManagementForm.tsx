/* Copyright Contributors to the Open Cluster Management project */
import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { generatePath, useNavigate } from 'react-router-dom-v5-compat'
import { AcmDataFormPage } from '../../components/AcmDataForm'
import { FormData } from '../../components/AcmFormData'
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
import { useSearchCompleteLazyQuery } from '../Search/search-sdk/search-sdk'
import { searchClient } from '../Search/search-sdk/search-client'
import { get } from 'lodash'

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
  const [cluster, setCluster] = useState('')
  const { submitForm } = useContext(LostChangesContext)
  const [role, setRole] = useState('')

  useEffect(() => {
    setCluster(accessControl?.metadata?.namespace ?? '')
    console.log("test")
    console.log(accessControl?.metadata)
  }, [accessControl?.metadata])

  //react hook that updates namespaces, along with setNamespaces as a function to reset namespaces
  const [namespaces, setNamespaces] = useState([])
  const [getSearchResults, { data, loading, error, refetch }] = useSearchCompleteLazyQuery({
    client: process.env.NODE_ENV === 'test' ? undefined : searchClient,
  })
  useEffect(() => {
      getSearchResults({
        client: process.env.NODE_ENV === 'test' ? undefined : searchClient,
        variables: {
          property: 'namespace',
          query: {
            keywords: [],
            filters: [
              {
                property: 'cluster',
                values: [cluster],
              },
            ],
          },
          limit: -1,
        },
      })
  }, [cluster])

  const namespaceItems: string[] = useMemo(() => get(data || [], 'searchComplete') ?? [], [data?.searchComplete])

  console.log(namespaceItems)

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
      cluster: cluster,
      roles: [],
      creationTimestamp: ''
    },
  })

  const stateToSyncs = () => [
    { path: 'AccessControl[0].data.cluster', setState: setCluster },
  ]

  const title = isViewing ? accessControl?.metadata?.uid! : isEditing ? t('Edit access control') : t('Add access control')
  const breadcrumbs = [{ text: t('Access Controls'), to: NavigationPath.accessControlManagement }, { text: title }]

  
  // const [currentSearch] = useState<string>('')
  // const searchbartest = <Searchbar
  //             queryString={currentSearch}
  //             saveSearchTooltip={''}
  //             setSaveSearch={() => {}}
  //             updateBrowserUrl={() => {}}
  //             savedSearchQueries={[]}
  //             inputPlaceholder={currentSearch === '' ? 'Filter VirtualMachines' : ''}
  //             exportEnabled={false}
  //           />

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
            id: 'cluster',
            type: 'Select',
            label: 'Managedcluster',
            value: cluster,
            onChange: setCluster,
            options: managedClusters.map(cluster => ({
              id: cluster.name,
              value: cluster.name,
              text: cluster.name,
            })),
            isRequired: true,
            isDisabled: false
          },
          {
            id: 'name',
            type: 'Select',
            label: 'Namespaces of the managedcluster',
            placeholder: 'name',
            value: role,
            onChange: setRole,
            options: namespaceItems.map(namespace => ({
              id: namespace,
              value: namespace,
              text: namespace,
            })),
            isRequired: true,
          },
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
        const data: AccessControl['metadata'] = { ...accessControl.metadata!, namespace } // TODO: the rest of fields
        patch.push({ op: 'replace', path: `/data`, value: data })
        return patchResource(accessControl, patch).promise.then(() => {
          toastContext.addAlert({
            title: t('Acccess Control updated'),
            message: t('accessControlForm.updated.message', { id: data?.uid }),
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
