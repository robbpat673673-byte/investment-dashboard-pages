export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function isBeforeInstallPromptEvent(value: Event): value is BeforeInstallPromptEvent {
  return "prompt" in value && "userChoice" in value;
}

export function registerStaticServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  const basePath = import.meta.env.BASE_URL;
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register(`${basePath.endsWith("/") ? basePath : `${basePath}/`}sw.js`, { scope: basePath });
  });
}
