// Barcode scanning is handled by BarcodeScannerModal (components/barcode-scanner-modal.tsx)
// which uses @zxing/browser — works in Capacitor WKWebView and web browsers.

export const canScan = (): boolean =>
  typeof navigator !== "undefined" && !!navigator.mediaDevices
