/**
 * @module kanban-create-card-dialog
 * Dialog component for creating a new Kanban card.
 * Provides a two-step flow: first select a card type (post, video, copy, etc.),
 * then fill in type-specific template fields (title, platform, caption, dimensions, etc.)
 * before submitting the card to a selected column.
 */
import { useState } from "react";
import {
  CARD_TYPES,
  CARD_TYPE_LABELS,
  CARD_TYPE_COLORS,
  CARD_TYPE_FIELDS,
  type CardType,
  type CardTemplateField,
} from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LayoutGrid,
  Image,
  Printer,
  Monitor,
  FileText,
  Video,
  Palette,
  ArrowLeft,
  Users,
  Camera,
} from "lucide-react";
import { TextareaWithExtras } from "@/components/rich-text-editor";
import { useQuery } from "@tanstack/react-query";

/** Maps each card type to its representative Lucide icon component. */
const CARD_TYPE_ICONS: Record<CardType, React.ComponentType<{ className?: string }>> = {
  geral: LayoutGrid,
  post: Image,
  video: Video,
  material_offline: Printer,
  material_digital: Monitor,
  copy: FileText,
  roteiro: FileText,
  identidade_visual: Palette,
  reuniao: Users,
  captacao: Camera,
};

/** Props for the {@link KanbanCreateCardDialog} component. */
interface KanbanCreateCardDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { title: string; cardType: string; templateData: string }) => void;
  columnTitle: string;
  clientId?: number;
}

export function KanbanCreateCardDialog({
  open,
  onClose,
  onSubmit,
  columnTitle,
  clientId,
}: KanbanCreateCardDialogProps) {
  const { data: textTemplates } = useQuery<{ id: number; name: string; content: string }[]>({
    queryKey: [`/api/onboarding/${clientId}/text-templates`],
    enabled: !!clientId,
  });
  const { data: clientData } = useQuery<{ enableReuniao?: boolean; enableCaptacao?: boolean }>({
    queryKey: ['/api/clients', clientId],
    enabled: !!clientId,
  });

  const availableTypes = CARD_TYPES.filter((type) => {
    if (!clientData) return true;
    if (type === "reuniao" && !clientData.enableReuniao) return false;
    if (type === "captacao" && !clientData.enableCaptacao) return false;
    return true;
  });

  const [step, setStep] = useState<1 | 2>(1);
  const [selectedType, setSelectedType] = useState<CardType | null>(null);
  const [title, setTitle] = useState("");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  const resetState = () => {
    setStep(1);
    setSelectedType(null);
    setTitle("");
    setFieldValues({});
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleTypeSelect = (type: CardType) => {
    setSelectedType(type);
    setStep(2);
    setFieldValues({});
  };

  const handleBack = () => {
    setStep(1);
    setSelectedType(null);
    setTitle("");
    setFieldValues({});
  };

  const handleFieldChange = (key: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleMultiSelectToggle = (key: string, option: string) => {
    setFieldValues((prev) => {
      const currentVal = prev[key] || "[]";
      let arr: string[] = [];
      try { arr = JSON.parse(currentVal); } catch {}
      if (arr.includes(option)) {
        arr = arr.filter((v) => v !== option);
      } else {
        arr = [...arr, option];
      }
      return { ...prev, [key]: JSON.stringify(arr) };
    });
  };

  const handleSubmit = () => {
    if (!title.trim() || !selectedType) return;
    const fields = CARD_TYPE_FIELDS[selectedType];
    const templateObj: Record<string, any> = {};
    for (const field of fields) {
      if (field.type === "multi-select") {
        try { templateObj[field.key] = JSON.parse(fieldValues[field.key] || "[]"); } catch { templateObj[field.key] = []; }
      } else {
        templateObj[field.key] = fieldValues[field.key] || "";
      }
    }
    onSubmit({
      title: title.trim(),
      cardType: selectedType,
      templateData: JSON.stringify(templateObj),
    });
    resetState();
  };

  const fields: CardTemplateField[] = selectedType ? CARD_TYPE_FIELDS[selectedType] : [];

  const hasRequiredEmpty = fields
    .filter((f) => f.required)
    .some((f) => {
      const val = fieldValues[f.key];
      if (f.type === "multi-select") {
        try {
          const arr = JSON.parse(val || "[]");
          return !Array.isArray(arr) || arr.length === 0;
        } catch { return true; }
      }
      return !val?.trim();
    });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent
        className="max-w-[520px] max-h-[80vh] overflow-y-auto"
        data-testid="dialog-create-card"
      >
        <DialogHeader>
          <DialogTitle data-testid="text-dialog-title">
            Novo Cartão - {columnTitle}
          </DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground" data-testid="text-step1-label">
              Selecione o tipo de cartão:
            </p>
            <div className="grid grid-cols-2 gap-2">
              {availableTypes.map((type) => {
                const Icon = CARD_TYPE_ICONS[type];
                const colorClass = CARD_TYPE_COLORS[type];
                return (
                  <button
                    key={type}
                    className="flex items-center gap-3 rounded-md border p-3 text-left hover-elevate active-elevate-2 transition-colors"
                    onClick={() => handleTypeSelect(type)}
                    data-testid={`button-type-${type}`}
                  >
                    <div className={`${colorClass} rounded-md p-2 text-white shrink-0`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-medium">
                      {CARD_TYPE_LABELS[type]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 2 && selectedType && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBack}
                data-testid="button-back"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="flex items-center gap-2">
                {(() => {
                  const Icon = CARD_TYPE_ICONS[selectedType];
                  const colorClass = CARD_TYPE_COLORS[selectedType];
                  return (
                    <div className={`${colorClass} rounded-md p-1.5 text-white`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                  );
                })()}
                <span className="text-sm font-medium text-muted-foreground">
                  {CARD_TYPE_LABELS[selectedType]}
                </span>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Título <span className="text-destructive">*</span>
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Título do cartão..."
                data-testid="input-card-title"
              />
            </div>

            {fields.map((field) => (
              <div key={field.key}>
                <label className="text-sm font-medium mb-1.5 block">
                  {field.label}
                  {field.required && <span className="text-destructive"> *</span>}
                </label>
                {field.type === "text" && (
                  <Input
                    value={fieldValues[field.key] || ""}
                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                    placeholder={field.label}
                    data-testid={`input-field-${field.key}`}
                  />
                )}
                {field.type === "textarea" && (
                  <TextareaWithExtras
                    value={fieldValues[field.key] || ""}
                    onChange={(val) => handleFieldChange(field.key, val)}
                    placeholder={field.label}
                    templates={textTemplates}
                    rows={3}
                    testId={`textarea-field-${field.key}`}
                  />
                )}
                {field.type === "date" && (
                  <Input
                    type="date"
                    value={fieldValues[field.key] || ""}
                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                    data-testid={`input-field-${field.key}`}
                  />
                )}
                {field.type === "select" && field.options && (
                  <Select
                    value={fieldValues[field.key] || ""}
                    onValueChange={(val) => handleFieldChange(field.key, val)}
                  >
                    <SelectTrigger data-testid={`select-field-${field.key}`}>
                      <SelectValue placeholder={`Selecionar ${field.label.toLowerCase()}...`} />
                    </SelectTrigger>
                    <SelectContent>
                      {field.options.map((opt) => (
                        <SelectItem key={opt} value={opt} data-testid={`option-${field.key}-${opt}`}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {field.type === "multi-select" && field.options && (
                  <div className="flex flex-wrap gap-3 pt-1" data-testid={`multiselect-field-${field.key}`}>
                    {field.options.map((opt) => {
                      let selected: string[] = [];
                      try { selected = JSON.parse(fieldValues[field.key] || "[]"); } catch {}
                      const isChecked = selected.includes(opt);
                      return (
                        <label key={opt} className="flex items-center gap-2 cursor-pointer text-sm">
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() => handleMultiSelectToggle(field.key, opt)}
                            data-testid={`checkbox-${field.key}-${opt}`}
                          />
                          {opt}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}

            <div className="flex items-center gap-2 justify-end pt-2">
              <Button
                variant="outline"
                onClick={handleBack}
                data-testid="button-back-bottom"
              >
                Voltar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!title.trim() || hasRequiredEmpty}
                data-testid="button-submit-card"
              >
                Criar Cartão
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
