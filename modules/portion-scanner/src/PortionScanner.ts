import { requireOptionalNativeModule } from 'expo-modules-core';

export type PortionScannerSupport = {
  arCoreSupported: boolean;
  arCoreInstalled: boolean;
  depthSupported: boolean;
  rawDepthSupported: boolean;
  availability: string;
  message: string;
};

type PortionScannerNativeModule = {
  getSupportStatusAsync(): Promise<PortionScannerSupport>;
};

const nativeModule = requireOptionalNativeModule<PortionScannerNativeModule>('PortionScanner');

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

export const isPortionScannerNativeModuleLinked = Boolean(nativeModule);
