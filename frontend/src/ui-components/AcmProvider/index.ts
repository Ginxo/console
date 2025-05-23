/* Copyright Contributors to the Open Cluster Management project */

import { AcmIconVariant } from '../AcmIcons/AcmIcons'

export * from './AcmInlineProvider/AcmInlineProvider'

// These cannot change as they are used in existing resources as identifiers
export enum Provider {
  redhatcloud = 'rhocm',
  ansible = 'ans',
  openstack = 'ost',
  aws = 'aws',
  awss3 = 'awss3',
  gcp = 'gcp',
  azure = 'azr',
  vmware = 'vmw',
  ibm = 'ibm',
  ibmpower = 'ibmpower',
  ibmpowervs = 'ibmpowervs',
  ibmz = 'ibmz',
  baremetal = 'bmc',
  hostinventory = 'hostinventory',
  hybrid = 'hybrid',
  hypershift = 'hypershift',
  alibaba = 'alibaba',
  other = 'other',
  kubevirt = 'kubevirt',
  microshift = 'microshift',
  nutanix = 'nutanix',
  ovirt = 'ovirt',
  external = 'external',
  libvirt = 'libvirt',
  none = 'none',
}

export const ProviderShortTextMap = {
  [Provider.redhatcloud]: 'OCM',
  [Provider.ansible]: 'ANS',
  [Provider.openstack]: 'OpenStack',
  [Provider.aws]: 'Amazon',
  [Provider.awss3]: 'Amazon S3',
  [Provider.gcp]: 'Google',
  [Provider.azure]: 'Microsoft',
  [Provider.ibm]: 'IBM',
  [Provider.ibmpower]: 'IBM Power',
  [Provider.ibmpowervs]: 'IBM PowerVS',
  [Provider.ibmz]: 'IBM Z',
  [Provider.baremetal]: 'Bare metal',
  [Provider.vmware]: 'VMware',
  [Provider.hybrid]: 'Assisted installation',
  [Provider.hostinventory]: 'Host inventory',
  [Provider.hypershift]: 'Hypershift',
  [Provider.alibaba]: 'Alibaba',
  [Provider.other]: 'Other',
  [Provider.kubevirt]: 'OpenShift Virtualization',
  [Provider.microshift]: 'Red Hat Device Edge',
  [Provider.nutanix]: 'Nutanix',
  [Provider.ovirt]: 'oVirt',
  [Provider.external]: 'External',
  [Provider.libvirt]: 'Libvirt',
  [Provider.none]: 'None',
}

export const ProviderLongTextMap = {
  [Provider.redhatcloud]: 'Red Hat OpenShift Cluster Manager',
  [Provider.ansible]: 'Red Hat Ansible Automation Platform',
  [Provider.openstack]: 'Red Hat OpenStack Platform',
  [Provider.aws]: 'Amazon Web Services',
  [Provider.awss3]: 'Amazon Web Services - S3 Bucket',
  [Provider.gcp]: 'Google Cloud Platform',
  [Provider.azure]: 'Microsoft Azure',
  [Provider.ibm]: 'IBM Cloud',
  [Provider.ibmpower]: 'IBM Power',
  [Provider.ibmpowervs]: 'IBM Power Virtual Server',
  [Provider.ibmz]: 'IBM Z',
  [Provider.baremetal]: 'Bare metal',
  [Provider.vmware]: 'VMware vSphere',
  [Provider.hybrid]: 'Assisted installation',
  [Provider.hostinventory]: 'Host inventory',
  [Provider.hypershift]: 'Hypershift',
  [Provider.alibaba]: 'Alibaba Cloud',
  [Provider.other]: 'Other',
  [Provider.kubevirt]: 'Red Hat OpenShift Virtualization',
  [Provider.microshift]: 'Red Hat Device Edge',
  [Provider.nutanix]: 'Nutanix',
  [Provider.ovirt]: 'Red Hat oVirt',
  [Provider.external]: 'External Provider',
  [Provider.libvirt]: 'Libvirt Virtualization',
  [Provider.none]: 'No Provider',
}

export const ProviderIconMap = {
  [Provider.redhatcloud]: AcmIconVariant.redhat,
  [Provider.ansible]: AcmIconVariant.ansible,
  [Provider.openstack]: AcmIconVariant.redhat,
  [Provider.aws]: AcmIconVariant.aws,
  [Provider.awss3]: AcmIconVariant.awss3,
  [Provider.gcp]: AcmIconVariant.gcp,
  [Provider.azure]: AcmIconVariant.azure,
  [Provider.ibm]: AcmIconVariant.ibm,
  [Provider.ibmpower]: AcmIconVariant.ibmlogo,
  [Provider.ibmpowervs]: AcmIconVariant.ibmlogo,
  [Provider.ibmz]: AcmIconVariant.ibmlogo,
  [Provider.baremetal]: AcmIconVariant.baremetal,
  [Provider.vmware]: AcmIconVariant.vmware,
  [Provider.hostinventory]: AcmIconVariant.hybrid,
  [Provider.hybrid]: AcmIconVariant.hybrid,
  [Provider.alibaba]: AcmIconVariant.alibaba,
  [Provider.other]: AcmIconVariant.cloud,
  [Provider.hypershift]: AcmIconVariant.cloud,
  [Provider.kubevirt]: AcmIconVariant.kubevirt,
  [Provider.microshift]: AcmIconVariant.redhat,
  [Provider.nutanix]: AcmIconVariant.nutanix,
  [Provider.ovirt]: AcmIconVariant.redhat,
  [Provider.external]: AcmIconVariant.cloud,
  [Provider.libvirt]: AcmIconVariant.cloud,
  [Provider.none]: AcmIconVariant.cloud,
}
