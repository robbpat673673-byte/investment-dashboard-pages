// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { isBeforeInstallPromptEvent, registerStaticServiceWorker } from "./pwa";

afterEach(() => vi.unstubAllGlobals());

describe("公開靜態版 PWA", () => {
  it("在支援 Service Worker 的瀏覽器於 load 後註冊離線快取", () => {
    const register = vi.fn(async () => undefined);
    vi.stubGlobal("navigator", { serviceWorker: { register } });
    registerStaticServiceWorker();
    window.dispatchEvent(new Event("load"));

    expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/" });
  });

  it("只接受具備 install prompt API 的安裝事件", () => {
    expect(isBeforeInstallPromptEvent(new Event("beforeinstallprompt"))).toBe(false);
    expect(isBeforeInstallPromptEvent(Object.assign(new Event("beforeinstallprompt"), { prompt: async () => undefined, userChoice: Promise.resolve({ outcome: "accepted", platform: "web" }) }))).toBe(true);
  });
});
