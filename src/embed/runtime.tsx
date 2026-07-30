import { createContext, useContext } from "react";
import type { HarnessKitApi } from "@/lib/invoke";

export type EmbeddedTheme = "light" | "dark" | "system";

export interface HarnessKitEmbedRuntime {
  api: HarnessKitApi;
  portalContainer: HTMLElement;
  assetBase: string;
  storage: Storage;
  storageNamespace: string;
  reportError(error: unknown): void;
}

const RuntimeContext = createContext<HarnessKitEmbedRuntime | null>(null);

export function HarnessKitRuntimeProvider({
  runtime,
  children,
}: {
  runtime: HarnessKitEmbedRuntime;
  children: React.ReactNode;
}) {
  return (
    <RuntimeContext.Provider value={runtime}>
      {children}
    </RuntimeContext.Provider>
  );
}

export function useHarnessKitRuntime(): HarnessKitEmbedRuntime {
  const runtime = useContext(RuntimeContext);
  if (!runtime) {
    throw new Error(
      "HarnessKit embed components must be rendered inside HarnessKitRuntimeProvider",
    );
  }
  return runtime;
}

export function createNamespacedStorage(
  storage: Storage,
  namespace: string,
): Storage {
  const prefix = `${namespace}:`;
  return {
    get length() {
      let count = 0;
      for (let i = 0; i < storage.length; i += 1) {
        if (storage.key(i)?.startsWith(prefix)) count += 1;
      }
      return count;
    },
    clear() {
      const keys: string[] = [];
      for (let i = 0; i < storage.length; i += 1) {
        const key = storage.key(i);
        if (key?.startsWith(prefix)) keys.push(key);
      }
      for (const key of keys) storage.removeItem(key);
    },
    getItem(key) {
      return storage.getItem(`${prefix}${key}`);
    },
    key(index) {
      const keys: string[] = [];
      for (let i = 0; i < storage.length; i += 1) {
        const key = storage.key(i);
        if (key?.startsWith(prefix)) keys.push(key.slice(prefix.length));
      }
      return keys[index] ?? null;
    },
    removeItem(key) {
      storage.removeItem(`${prefix}${key}`);
    },
    setItem(key, value) {
      storage.setItem(`${prefix}${key}`, value);
    },
  };
}
