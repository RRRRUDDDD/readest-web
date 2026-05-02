export interface CopyURIRequest {
  uri: string;
  dst: string;
}

export interface CopyURIResponse {
  success: boolean;
  error?: string;
}

export interface UseBackgroundAudioRequest {
  enabled: boolean;
}

export interface InstallPackageRequest {
  path: string;
}

export interface InstallPackageResponse {
  success: boolean;
  error?: string;
}

export interface SetSystemUIVisibilityRequest {
  visible: boolean;
  darkMode: boolean;
}

export interface SetSystemUIVisibilityResponse {
  success: boolean;
  error?: string;
}

export interface GetStatusBarHeightResponse {
  height: number;
  error?: string;
}

export interface GetSystemFontsListResponse {
  fonts: Record<string, string>;
  error?: string;
}

export interface InterceptKeysRequest {
  volumeKeys?: boolean;
  backKey?: boolean;
}

export interface LockScreenRequest {
  orientation: 'portrait' | 'landscape' | 'auto';
}

export interface GetSystemColorSchemeResponse {
  colorScheme: 'light' | 'dark';
  error?: string;
}

export interface GetSafeAreaInsetsResponse {
  top: number;
  right: number;
  bottom: number;
  left: number;
  error?: string;
}

interface GetScreenBrightnessResponse {
  brightness: number;
  error?: string;
}

interface SetScreenBrightnessRequest {
  brightness: number;
}

interface SetScreenBrightnessResponse {
  success: boolean;
  error?: string;
}

interface GetExternalSDCardPathResponse {
  path: string | null;
  error?: string;
}

interface SelectDirectoryResponse {
  cancelled?: boolean;
  uri?: string;
  path?: string;
  error?: string;
}

export interface GetStorefrontRegionCodeResponse {
  regionCode?: string;
  error?: string;
}

export async function copyURIToPath(_request: CopyURIRequest): Promise<CopyURIResponse> {
  return { success: false, error: 'Not supported in browser' };
}

export async function invokeUseBackgroundAudio(
  _request: UseBackgroundAudioRequest,
): Promise<void> {}

export async function installPackage(
  _request: InstallPackageRequest,
): Promise<InstallPackageResponse> {
  return { success: false, error: 'Not supported in browser' };
}

export async function setSystemUIVisibility(
  _request: SetSystemUIVisibilityRequest,
): Promise<SetSystemUIVisibilityResponse> {
  return { success: true };
}

export async function getStatusBarHeight(): Promise<GetStatusBarHeightResponse> {
  return { height: 0 };
}

export async function getSysFontsList(): Promise<GetSystemFontsListResponse> {
  return { fonts: {} };
}

export async function interceptKeys(_request: InterceptKeysRequest): Promise<void> {}

export async function lockScreenOrientation(_request: LockScreenRequest): Promise<void> {}

export async function getSystemColorScheme(): Promise<GetSystemColorSchemeResponse> {
  const darkMode =
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  return { colorScheme: darkMode ? 'dark' : 'light' };
}

export async function getSafeAreaInsets(): Promise<GetSafeAreaInsetsResponse> {
  return { top: 0, right: 0, bottom: 0, left: 0 };
}

export async function getScreenBrightness(): Promise<GetScreenBrightnessResponse> {
  return { brightness: 1 };
}

export async function setScreenBrightness(
  _request: SetScreenBrightnessRequest,
): Promise<SetScreenBrightnessResponse> {
  return { success: true };
}

export async function getExternalSDCardPath(): Promise<GetExternalSDCardPathResponse> {
  return { path: null };
}

export async function selectDirectory(): Promise<SelectDirectoryResponse> {
  return { cancelled: true };
}

export async function getStorefrontRegionCode(): Promise<GetStorefrontRegionCodeResponse> {
  return {};
}
