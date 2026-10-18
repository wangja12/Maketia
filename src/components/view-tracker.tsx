"use client";

import { useEffect } from "react";

/*
 * Sends a page view, then one event per call-to-action click, to /api/events.
 * The token was signed by the server for this exact page, variant and visitor.
 */

function send(body: Record<string, string>) {
  const data = JSON.stringify(body);
  if (!navigator.sendBeacon?.("/api/events", new Blob([data], { type: "application/json" }))) {
    void fetch("/api/events", { method: "POST", body: data, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => {});
  }
}

export function ViewTracker({ token }: { token: string }) {
  useEffect(() => {
    const utmSource = new URLSearchParams(location.search).get("utm_source") ?? "";
    send({ token, type: "page_view", referrer: document.referrer, utmSource });

    const onClick = (e: MouseEvent) => {
      const cta = (e.target as Element | null)?.closest?.("[data-tia-cta]");
      if (cta) send({ token, type: "cta_click", target: cta.getAttribute("data-tia-cta") ?? "" });
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [token]);
  return null;
}
