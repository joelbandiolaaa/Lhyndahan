"use client";

import { Check, Copy, Share2 } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Older phones / non-secure contexts: fall back to a hidden textarea.
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
}

export function CopyButton({ text, label, variant = "secondary" }: { text: string; label: string; variant?: "primary" | "secondary" }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant={variant}
      className="no-print"
      onClick={async () => {
        await copyToClipboard(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? <Check size={18} aria-hidden /> : <Copy size={18} aria-hidden />}
      {copied ? "Copied!" : label}
    </Button>
  );
}

const noop = () => () => {};
/** The share sheet exists on phones (and some browsers); false while rendering on the server. */
function useCanShare() {
  return useSyncExternalStore(
    noop,
    () => typeof navigator !== "undefined" && typeof navigator.share === "function",
    () => false,
  );
}

function ShareButton({ text, variant = "secondary" }: { text: string; variant?: "primary" | "secondary" }) {
  return (
    <Button
      type="button"
      variant={variant}
      className="no-print"
      onClick={async () => {
        try {
          await navigator.share({ text });
        } catch {
          /* closed the share sheet: nothing to do */
        }
      }}
    >
      <Share2 size={18} aria-hidden /> Share
    </Button>
  );
}

/** Copy always; Share (opens Messenger, Viber, etc.) where the device supports it. */
export function RiderActions({ text, copyLabel, variant = "secondary" }: { text: string; copyLabel: string; variant?: "primary" | "secondary" }) {
  const canShare = useCanShare();
  return (
    <div className="no-print flex flex-wrap gap-2">
      <CopyButton text={text} label={copyLabel} variant={variant} />
      {canShare ? <ShareButton text={text} variant={variant} /> : null}
    </div>
  );
}
