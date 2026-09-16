/**
 * Printing a page from the screen — label sheets and purchase orders. The Mac app's web view does
 * not implement `window.print`, so it offers a message handler instead (desktop/macos/main.swift).
 */
type PrintBridge = { messageHandlers?: { simonPrint?: { postMessage: (message: unknown) => void } } };

export function printPage() {
  const bridge = (window as unknown as { webkit?: PrintBridge }).webkit?.messageHandlers?.simonPrint;
  if (bridge) bridge.postMessage({});
  else window.print();
}
