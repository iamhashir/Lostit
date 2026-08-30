import React from 'react';
import { Platform, type ViewProps } from 'react-native';
import {
  requireNativeViewManager,
  requireOptionalNativeModule
} from 'expo-modules-core';

export type PortionScannerSupport = {
  arCoreSupported: boolean;
  arCoreInstalled: boolean;
  depthSupported: boolean;
  rawDepthSupported: boolean;
  availability: string;
  message: string;
};

export type PortionDepthReading = {
  depthMm: number;
  distanceCm: number;
  coverage: number;
  depthWidth: number;
  depthHeight: number;
  tracking: boolean;
  timestamp: number;
  plateDepthMm: number;
  baseDepthMm: number;
  rawVolumeMl: number;
  estimatedVolumeMl: number;
  estimatedHeightMm: number;
  foodPixelRatio: number;
  objectPixelRatio: number;
  planeResidualMm: number;
  estimateConfidence: number;
  stability: number;
  sampleWindow: number;
  autofocusEnabled: boolean;
  distanceOk: boolean;
  componentTouchesGuide: boolean;
  focalLengthPx: number;
};

export type PortionScannerStatusEvent = {
  state: string;
  message: string;
};

export type PortionDepthViewProps = ViewProps & {
  roiWidthFraction?: number;
  roiHeightFraction?: number;
  onDepthUpdate?: (event: { nativeEvent: PortionDepthReading }) => void;
  onScannerStatus?: (event: { nativeEvent: PortionScannerStatusEvent }) => void;
};

type PortionScannerNativeModule = {
  getSupportStatusAsync(): Promise<PortionScannerSupport>;
};

const nativeModule = requireOptionalNativeModule<PortionScannerNativeModule>('PortionScanner');

const NativeDepthView = Platform.OS === 'android'
  ? requireNativeViewManager<PortionDepthViewProps>('PortionScanner')
  : null;

const unavailable: PortionScannerSupport = {
  arCoreSupported: false,
  arCoreInstalled: false,
  depthSupported: false,
  rawDepthSupported: false,
  availability: 'NATIVE_MODULE_UNAVAILABLE',
  message: 'The Android depth-scanner module is not available in this build.'
};

export async function getPortionScannerSupportAsync(): Promise<PortionScannerSupport> {
  if (!nativeModule) return unavailable;
  return nativeModule.getSupportStatusAsync();
}

export function PortionDepthView(props: PortionDepthViewProps) {
  if (!NativeDepthView) return null;
  return React.createElement(NativeDepthView, props);
}

export const isPortionScannerNativeModuleLinked = Boolean(nativeModule);
