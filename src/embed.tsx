if (typeof window !== "undefined" && !(window as any).process) {
  (window as any).process = {
    env: { NODE_ENV: "production" },
    platform: "browser",
    cwd: () => "/",
    nextTick: (cb: (...args: any[]) => void, ...args: any[]) => setTimeout(() => cb(...args), 0),
  };
}

import { registerHarnessKitPanel } from "./embed/custom-element";

registerHarnessKitPanel();

export {
  HarnessKitPanel,
  registerHarnessKitPanel,
  type HarnessKitErrorEventDetail,
  type HarnessKitNavigateEventDetail,
  type HarnessKitPanelElement,
  type HarnessKitReadyEventDetail,
} from "./embed/custom-element";
