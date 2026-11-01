"use client";

import { useState } from "react";
import {
  Copy,
  Eye,
  EyeOff,
  FileText,
  HelpCircle,
  KeyRound,
  Plus,
  Trash2,
} from "lucide-react";
import { copySecretToClipboard } from "@/lib/utils";
import type { CustomField } from "@/types/vault";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CustomFieldsEditorProps {
  fields: CustomField[];
  onChange: (fields: CustomField[]) => void;
  readOnly?: boolean;
}

const PRESET_TEMPLATES = [
  { label: "Security Question", type: "security_question" as const },
  { label: "Backup PIN", type: "hidden" as const },
  { label: "Recovery Answer", type: "security_question" as const },
  { label: "Server Port", type: "text" as const },
];

export function CustomFieldsEditor({
  fields,
  onChange,
  readOnly = false,
}: CustomFieldsEditorProps) {
  const [newLabel, setNewLabel] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newType, setNewType] = useState<"text" | "hidden" | "security_question">("text");
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());

  const handleAddField = () => {
    if (!newLabel.trim()) return;
    const newField: CustomField = {
      id: Math.random().toString(36).substring(2, 9),
      label: newLabel.trim(),
      value: newValue,
      isSecret: newType === "hidden" || newType === "security_question",
      type: newType,
    };
    onChange([...fields, newField]);
    setNewLabel("");
    setNewValue("");
  };

  const handleRemoveField = (id: string) => {
    onChange(fields.filter((f) => f.id !== id));
  };

  const toggleReveal = (id: string) => {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const applyPreset = (preset: (typeof PRESET_TEMPLATES)[number]) => {
    setNewLabel(preset.label);
    setNewType(preset.type);
  };

  if (readOnly) {
    if (!fields || fields.length === 0) return null;
    return (
      <div className="space-y-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Custom Fields &amp; Security Answers
        </span>
        <div className="space-y-1.5">
          {fields.map((f) => {
            const isRevealed = revealedIds.has(f.id);
            return (
              <div
                key={f.id}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-2.5 text-xs font-mono"
              >
                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-1.5">
                    {f.type === "security_question" ? (
                      <HelpCircle className="size-3 text-amber-500" />
                    ) : f.type === "hidden" ? (
                      <KeyRound className="size-3 text-emerald-500" />
                    ) : (
                      <FileText className="size-3 text-muted-foreground" />
                    )}
                    <span className="text-[10px] text-muted-foreground uppercase block truncate">
                      {f.label}
                    </span>
                  </div>
                  <span className="text-foreground break-all mt-0.5 block">
                    {f.isSecret && !isRevealed ? "••••••••••••" : f.value}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {f.isSecret && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => toggleReveal(f.id)}
                      className="font-mono text-[10px]"
                    >
                      {isRevealed ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => copySecretToClipboard(f.value, f.label)}
                    className="font-mono text-[10px]"
                  >
                    <Copy className="size-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3.5 rounded-xl border border-border/80 bg-muted/20 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label className="font-mono text-xs font-semibold text-foreground">
            Custom Fields &amp; Security Questions
          </Label>
          {fields.length > 0 && (
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              {fields.length}
            </span>
          )}
        </div>
        <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400">
          Encrypted client-side
        </span>
      </div>

      {/* Preset Quick Badges */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-mono text-muted-foreground">Quick add:</span>
        {PRESET_TEMPLATES.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => applyPreset(preset)}
            className="rounded border border-border/70 bg-background/80 px-2 py-0.5 font-mono text-[10px] text-muted-foreground transition hover:border-emerald-500/40 hover:text-emerald-600 dark:hover:text-emerald-400"
          >
            + {preset.label}
          </button>
        ))}
      </div>

      {/* Existing Fields List */}
      {fields.length > 0 && (
        <div className="space-y-2">
          {fields.map((field) => {
            const isRevealed = revealedIds.has(field.id);
            return (
              <div
                key={field.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border/80 bg-background p-2.5 text-xs font-mono shadow-2xs"
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    {field.type === "security_question" ? (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.2 font-mono text-[9px] text-amber-600 dark:text-amber-400">
                        <HelpCircle className="size-2.5" /> Q&amp;A
                      </span>
                    ) : field.type === "hidden" ? (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.2 font-mono text-[9px] text-emerald-600 dark:text-emerald-400">
                        <KeyRound className="size-2.5" /> Secret
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.2 font-mono text-[9px] text-muted-foreground">
                        <FileText className="size-2.5" /> Text
                      </span>
                    )}
                    <span className="font-semibold text-foreground truncate">
                      {field.label}
                    </span>
                  </div>
                  <span className="text-muted-foreground truncate block pl-0.5">
                    {field.isSecret && !isRevealed ? "••••••••••••" : field.value || "(empty)"}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {field.isSecret && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => toggleReveal(field.id)}
                      className="text-muted-foreground hover:text-foreground"
                      title={isRevealed ? "Hide value" : "Reveal value"}
                    >
                      {isRevealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => handleRemoveField(field.id)}
                    className="text-muted-foreground hover:text-red-500"
                    title="Remove field"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add New Field Row */}
      <div className="space-y-2 rounded-lg border border-border/60 bg-background/50 p-2.5">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
          <Input
            placeholder="Field Label (e.g., Mother's Maiden Name)"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            className="font-mono text-xs h-8 sm:col-span-5 bg-background"
          />
          <Input
            placeholder="Field Value"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            className="font-mono text-xs h-8 sm:col-span-4 bg-background"
          />
          <Select
            value={newType}
            onValueChange={(val) =>
              setNewType(val as "text" | "hidden" | "security_question")
            }
          >
            <SelectTrigger className="font-mono text-xs h-8 sm:col-span-3 bg-background">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="text" className="font-mono text-xs">
                Visible Text
              </SelectItem>
              <SelectItem value="hidden" className="font-mono text-xs">
                Secret / Masked
              </SelectItem>
              <SelectItem value="security_question" className="font-mono text-xs">
                Security Q&amp;A
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleAddField}
          disabled={!newLabel.trim()}
          className="font-mono text-xs gap-1.5 w-full hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400"
        >
          <Plus className="size-3.5" />
          Add Custom Field
        </Button>
      </div>
    </div>
  );
}
