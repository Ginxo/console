/* Copyright Contributors to the Open Cluster Management project */
import { ReactNode } from 'react'
import { LoadEventsData } from './LoadEventsData'

/**
 * Composition root for backend event streams.
 */
export function LoadData(props: Readonly<{ children?: ReactNode }>) {
  return (
    <>
      <LoadEventsData />
      {props.children}
    </>
  )
}
