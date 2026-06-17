import { create } from 'zustand';
import type { Tool } from '../canvas/input';
import type { Camera } from '../canvas/renderer';

interface UIStore {
  tool:         Tool;
  camera:       Camera;
  setTool:      (t: Tool) => void;
  updateCamera: (fn: (cam: Camera) => void) => void;
  resetCamera:  () => void;
}

const DEFAULT_CAMERA: Camera = { x: -15, y: -9, zoom: 36 };

export const useUIStore = create<UIStore>((set, get) => ({
  tool:   'cable',
  camera: { ...DEFAULT_CAMERA },
  setTool:      tool => set({ tool }),
  updateCamera: fn => { const cam = { ...get().camera }; fn(cam); set({ camera: cam }); },
  resetCamera:  ()  => set({ camera: { ...DEFAULT_CAMERA } }),
}));
