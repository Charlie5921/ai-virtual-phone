import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { ChatPluginBootstrap } from "@/components/chat-plugin-bootstrap";
import { ChatReasoningVisibilityController } from "@/components/chat-reasoning-visibility-controller";
import { CSSImportEnhancer } from "@/components/css-import-enhancer";
import { PWAManifestInjector } from "@/components/pwa-manifest-injector";
import { PWARegistrar } from "@/components/pwa-registrar";
import "../styles/fonts.css";
import "./globals.css";

const CLIENT_CHUNK_RECOVERY_SCRIPT = String.raw`
(() => {
  const recoveryKey = "ai_phone_chunk_recovery_v1";
  const chunkFailure = /ChunkLoadError|Loading chunk .* failed|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|module script.*MIME type/i;

  const readReason = (event) => {
    const reason = event && (event.reason || event.error || event.message || event);
    return String((reason && (reason.stack || reason.message)) || reason || "");
  };

  const recover = (event) => {
    if (!chunkFailure.test(readReason(event))) return;

    try {
      if (sessionStorage.getItem(recoveryKey)) return;
      sessionStorage.setItem(recoveryKey, String(Date.now()));
    } catch (_) {
      return;
    }

    Promise.resolve()
      .then(async () => {
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.filter((key) => key.startsWith("ai-phone-pwa-")).map((key) => caches.delete(key)));
        }
        if ("serviceWorker" in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map((registration) => registration.update().catch(() => undefined)));
        }
      })
      .finally(() => window.location.reload());
  };

  window.addEventListener("error", recover, true);
  window.addEventListener("unhandledrejection", recover, true);
  window.setTimeout(() => {
    try { sessionStorage.removeItem(recoveryKey); } catch (_) {}
  }, 15000);
})();
`;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  // Resize the layout with Android Chrome's keyboard so the header stays visible.
  interactiveWidget: "resizes-content",
};

export const metadata: Metadata = {
  title: "float",
  description: "float",
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <head>
        <script dangerouslySetInnerHTML={{ __html: CLIENT_CHUNK_RECOVERY_SCRIPT }} />
        <link rel="manifest" href="/manifest.webmanifest" crossOrigin="use-credentials" />
        <meta name="theme-color" content="#f8f7f2" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="icon" href="/icon-192.png" type="image/png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="float" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>
        <PWAManifestInjector />
        <PWARegistrar />
        <CSSImportEnhancer />
        <ChatPluginBootstrap />
        <ChatReasoningVisibilityController />
        {children}
      </body>
    </html>
  );
}
