import { describe, test, expect, beforeEach, vi } from 'vitest';
import { useTrafficLightStore } from '@/store/trafficLightStore';
import { AppService } from '@/types/system';

function createMockAppService(hasTrafficLight: boolean): AppService {
  return {
    hasTrafficLight,
  } as AppService;
}

describe('trafficLightStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTrafficLightStore.setState({
      appService: undefined,
      isTrafficLightVisible: false,
      shouldShowTrafficLight: false,
      trafficLightInFullscreen: false,
      unlistenEnterFullScreen: undefined,
      unlistenExitFullScreen: undefined,
    });
  });

  describe('initial state', () => {
    test('has traffic light hidden by default', () => {
      const state = useTrafficLightStore.getState();
      expect(state.isTrafficLightVisible).toBe(false);
      expect(state.shouldShowTrafficLight).toBe(false);
      expect(state.trafficLightInFullscreen).toBe(false);
    });

    test('has no appService by default', () => {
      expect(useTrafficLightStore.getState().appService).toBeUndefined();
    });
  });

  describe('initializeTrafficLightStore', () => {
    test('sets appService and visibility from hasTrafficLight=true', () => {
      const appService = createMockAppService(true);
      useTrafficLightStore.getState().initializeTrafficLightStore(appService);

      const state = useTrafficLightStore.getState();
      expect(state.appService).toBe(appService);
      expect(state.isTrafficLightVisible).toBe(true);
      expect(state.shouldShowTrafficLight).toBe(true);
    });

    test('sets visibility to false when hasTrafficLight=false', () => {
      const appService = createMockAppService(false);
      useTrafficLightStore.getState().initializeTrafficLightStore(appService);

      const state = useTrafficLightStore.getState();
      expect(state.isTrafficLightVisible).toBe(false);
      expect(state.shouldShowTrafficLight).toBe(false);
    });
  });

  describe('setTrafficLightVisibility', () => {
    test('sets visibility in the pure web build', async () => {
      await useTrafficLightStore.getState().setTrafficLightVisibility(true);

      const state = useTrafficLightStore.getState();
      expect(state.isTrafficLightVisible).toBe(true);
      expect(state.shouldShowTrafficLight).toBe(true);
      expect(state.trafficLightInFullscreen).toBe(false);
    });

    test('sets visible=false', async () => {
      await useTrafficLightStore.getState().setTrafficLightVisibility(false);

      const state = useTrafficLightStore.getState();
      expect(state.isTrafficLightVisible).toBe(false);
      expect(state.shouldShowTrafficLight).toBe(false);
    });
  });

  describe('initializeTrafficLightListeners', () => {
    test('is a no-op in the pure web build', async () => {
      await useTrafficLightStore.getState().initializeTrafficLightListeners();

      const state = useTrafficLightStore.getState();
      expect(state.unlistenEnterFullScreen).toBeUndefined();
      expect(state.unlistenExitFullScreen).toBeUndefined();
    });
  });

  describe('cleanupTrafficLightListeners', () => {
    test('calls unlisten functions and clears them', () => {
      const unlistenEnter = vi.fn();
      const unlistenExit = vi.fn();

      useTrafficLightStore.setState({
        unlistenEnterFullScreen: unlistenEnter,
        unlistenExitFullScreen: unlistenExit,
      });

      useTrafficLightStore.getState().cleanupTrafficLightListeners();

      expect(unlistenEnter).toHaveBeenCalledTimes(1);
      expect(unlistenExit).toHaveBeenCalledTimes(1);

      const state = useTrafficLightStore.getState();
      expect(state.unlistenEnterFullScreen).toBeUndefined();
      expect(state.unlistenExitFullScreen).toBeUndefined();
    });
  });
});
