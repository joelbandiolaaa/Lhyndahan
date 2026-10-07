"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

const VISITOR_KEY = "hopia-visitor";
const SOURCE_KEY = "hopia-source";

/** Where this visit came from. Facebook/Messenger in-app browsers often send no referrer, so check the user agent too. */
function detectSource(): string {
  const params = new URLSearchParams(location.search);
  const utm = (params.get("utm_source") ?? "").toLowerCase();
  const ref = document.referrer.toLowerCase();
  const ua = navigator.userAgent;
  if (utm.includes("messenger") || ref.includes("messenger.com") || ref.includes("m.me") || /\bMessenger\b|FB_IAB.*Orca|Orca-Android/i.test(ua)) return "messenger";
  if (utm.includes("instagram") || ref.includes("instagram.com") || /Instagram/i.test(ua)) return "instagram";
  if (utm.includes("facebook") || utm === "fb" || params.has("fbclid") || /facebook\.com|fb\.com|fb\.me/.test(ref) || /FBAN|FBAV|FB_IAB/i.test(ua)) return "facebook";
  if (ref.includes("google.")) return "google";
  if (!ref || ref.includes(location.host)) return "direct";
  return "other";
}

function visitorId(): string {
  let id = localStorage.getItem(VISITOR_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(VISITOR_KEY, id);
  }
  return id;
}

/** Privacy-friendly page view counter: random id in this browser, no cookies, no IP. */
export function Tracker() {
  const pathname = usePathname();
  useEffect(() => {
    try {
      let source = sessionStorage.getItem(SOURCE_KEY);
      if (!source) {
        source = detectSource();
        sessionStorage.setItem(SOURCE_KEY, source);
      }
      void supabaseBrowser().rpc("track_view", { p_visitor: visitorId(), p_path: pathname, p_source: source });
    } catch {
      // Storage blocked or offline: skip counting, never break the shop.
    }
  }, [pathname]);
  return null;
}
