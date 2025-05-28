import { SetFeatureFlag } from '@openshift-console/dynamic-plugin-sdk'

import { ACCESS_CONTROL_MANAGEMENT_FLAG } from './consts'

const useEnableAccessControlManagementMenuFlag = (setFeatureFlag: SetFeatureFlag) =>
  setFeatureFlag(ACCESS_CONTROL_MANAGEMENT_FLAG, true)

export { useEnableAccessControlManagementMenuFlag }
