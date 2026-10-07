"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <Button type="button" variant="secondary" onClick={() => window.print()} className="no-print">
      <Printer size={18} aria-hidden /> Print
    </Button>
  );
}
