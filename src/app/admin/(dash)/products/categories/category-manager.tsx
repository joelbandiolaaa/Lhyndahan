"use client";

import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import type { ActionResult } from "@/lib/types";
import { addCategory, deleteCategory, moveCategory, renameCategory } from "./actions";

export type CategoryRow = { id: string; name: string; count: number };

export function CategoryManager({ categories }: { categories: CategoryRow[] }) {
  const router = useRouter();
  const [names, setNames] = useState<Record<string, string>>({});
  const [newName, setNewName] = useState("");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();

  function run(action: () => Promise<ActionResult>, after?: () => void) {
    start(async () => {
      const res = await action();
      setResult(res);
      if (res.ok) after?.();
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3 p-4">
        <ul className="flex flex-col gap-3">
          {categories.map((c, i) => {
            const value = names[c.id] ?? c.name;
            return (
              <li key={c.id} className="flex flex-col gap-2 rounded-xl border border-line p-3">
                <div className="flex items-center gap-2">
                  <Input
                    aria-label={`Name of ${c.name}`}
                    value={value}
                    maxLength={40}
                    onChange={(e) => setNames((n) => ({ ...n, [c.id]: e.target.value }))}
                  />
                  <button type="button" aria-label={`Move ${c.name} up`} disabled={pending || i === 0} onClick={() => run(() => moveCategory(c.id, "up"))} className="tap grid size-11 shrink-0 place-items-center rounded-xl bg-sunken disabled:opacity-40">
                    <ArrowUp size={18} aria-hidden />
                  </button>
                  <button type="button" aria-label={`Move ${c.name} down`} disabled={pending || i === categories.length - 1} onClick={() => run(() => moveCategory(c.id, "down"))} className="tap grid size-11 shrink-0 place-items-center rounded-xl bg-sunken disabled:opacity-40">
                    <ArrowDown size={18} aria-hidden />
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="num text-sm text-muted">{c.count} product(s)</span>
                  <span className="flex-1" />
                  <Button
                    type="button" loading={pending} disabled={value.trim() === c.name}
                    onClick={() => run(() => renameCategory(c.id, value), () => setNames((n) => ({ ...n, [c.id]: c.name })))}
                  >
                    Save name
                  </Button>
                  <Button
                    type="button" variant="danger" disabled={pending || c.count > 0}
                    title={c.count > 0 ? "Move its products to another category first" : undefined}
                    onClick={() => { if (confirm(`Delete the "${c.name}" category?`)) run(() => deleteCategory(c.id)); }}
                  >
                    <Trash2 size={16} aria-hidden /> Delete
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <form
        className="flex flex-col gap-3 rounded-xl border border-dashed border-line p-4"
        onSubmit={(e) => { e.preventDefault(); run(() => addCategory(newName), () => setNewName("")); }}
      >
        <h2 className="text-[17px] font-semibold">Add a category</h2>
        <Field label="Name" name="new-category" hint="e.g. Cakes, Cookies">
          {(p) => <Input {...p} value={newName} maxLength={40} onChange={(e) => setNewName(e.target.value)} />}
        </Field>
        <Button type="submit" loading={pending} disabled={!newName.trim()} className="self-start">Add category</Button>
      </form>

      {result ? <Notice tone={result.ok ? "success" : "error"}>{result.message}</Notice> : null}
    </div>
  );
}
