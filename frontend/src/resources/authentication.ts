/* Copyright Contributors to the Open Cluster Management project */
import { Metadata } from './metadata'
import { IResource } from './resource'

export const AuthenticationApiVersion = 'config.openshift.io/v1'
export const AuthenticationKind = 'Authentication'

export interface Authentication extends IResource {
  apiVersion: 'config.openshift.io/v1'
  kind: 'Authentication'
  metadata: Metadata
  spec?: {
    type?: string
  }
}
