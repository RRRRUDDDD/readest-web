export const interceptWindowOpen = () => {
  const windowOpen = window.open;
  globalThis.open = function (
    url?: string | URL,
    target?: string,
    features?: string,
  ): Window | null {
    return windowOpen(url, target, features);
  };
};
