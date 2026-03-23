/* Copyright Contributors to the Open Cluster Management project */

import { Http2ServerRequest, Http2ServerResponse } from 'http2'
import { jsonRequest } from '../lib/json-request'
import { logger } from '../lib/logger'
import { respondInternalServerError } from '../lib/respond'
import { getServiceAccountToken } from '../lib/serviceAccountToken'
import { getAuthenticatedToken } from '../lib/token'
import { IResource } from '../resources/resource'
import { ResourceList } from '../resources/resource-list'
import { getHubClusterName, getIsHubSelfManaged, getIsObservabilityInstalled, getKubeResources } from './events'

export async function hub(req: Http2ServerRequest, res: Http2ServerResponse): Promise<void> {
  const token = await getAuthenticatedToken(req, res)
  if (token) {
    const serviceAccountToken = getServiceAccountToken()

    try {
      const path = process.env.CLUSTER_API_URL + '/apis/apiextensions.k8s.io/v1/customresourcedefinitions'
      const [crdResponse, authentications] = await Promise.all([
        jsonRequest(path, serviceAccountToken)
          .then((response: ResourceList<IResource>) => {
            const mcgh = response.items.find(
              (crd) => crd.metadata.name === 'multiclusterglobalhubs.operator.open-cluster-management.io'
            )
            return { isGlobalHub: mcgh !== undefined }
          })
          .catch((err: Error) => {
            logger.error({ msg: 'Error getting Multicluster Global Hubs', error: err.message })
            return { isGlobalHub: false }
          }),
        getKubeResources('Authentication', 'config.openshift.io/v1'),
      ])

      const clusterAuth = authentications.find((r) => r.metadata?.name === 'cluster')
      const typedAuth = clusterAuth as {
        spec?: {
          type?: string
          oidcProviders?: Array<{
            claimMappings?: {
              username?: { claim?: string; prefix?: { prefixString?: string }; prefixPolicy?: string }
              groups?: { claim?: string; prefix?: string }
            }
          }>
        }
      }
      const isDirectAuthenticationEnabled = typedAuth?.spec?.type === 'OIDC'

      const oidcClaimMappings = typedAuth?.spec?.oidcProviders?.[0]?.claimMappings
      const authentication = {
        isDirectAuthenticationEnabled,
        ...(oidcClaimMappings && {
          claimMappings: {
            username: {
              claim: oidcClaimMappings.username?.claim,
              prefix: oidcClaimMappings.username?.prefix,
              prefixPolicy: oidcClaimMappings.username?.prefixPolicy,
            },
            groups: {
              claim: oidcClaimMappings.groups?.claim,
              prefix: oidcClaimMappings.groups?.prefix,
            },
          },
        }),
      }

      const response = {
        isGlobalHub: crdResponse.isGlobalHub,
        localHubName: getHubClusterName(),
        isHubSelfManaged: getIsHubSelfManaged(),
        isObservabilityInstalled: getIsObservabilityInstalled(),
        authentication,
      }

      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(response))
    } catch (err) {
      logger.error(err)
      respondInternalServerError(req, res)
    }
  }
}
