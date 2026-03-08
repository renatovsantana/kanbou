import { useState, useEffect, useRef } from "react";
import { useRoute } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TextareaWithExtras } from "@/components/rich-text-editor";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, ChevronLeft, ChevronRight, Send, FileText, Loader2, Upload, X, ImageIcon, AlertCircle } from "lucide-react";
import { BRIEFING_QUESTIONS, type BriefingQuestion } from "./briefings";
import type { BriefingTemplateQuestion } from "@shared/schema";

/** Shape of the briefing data returned from the public API endpoint */
type BriefingData = {
  id: number;
  title: string;
  status: string;
  clientName: string;
  client: { name: string } | null;
  briefingType?: string;
  templateId?: number | null;
  answers?: string | null;
};

/** Maximum allowed image file size for briefing uploads (2MB) */
const MAX_IMAGE_SIZE = 2 * 1024 * 1024;

/**
 * BriefingPublicPage - Public-facing page where clients fill out briefing questionnaires.
 * Accessed via a unique token URL without authentication.
 * Supports both standard brand briefings (multi-phase wizard) and custom template-based briefings.
 * Handles form validation, image/file uploads, and submission.
 */
export default function BriefingPublicPage() {
  const [, params] = useRoute("/briefing/:token");
  const token = params?.token || "";
  const { toast } = useToast();

  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [currentPhase, setCurrentPhase] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [uploadingImages, setUploadingImages] = useState(false);
  const [templateQuestions, setTemplateQuestions] = useState<BriefingTemplateQuestion[]>([]);
  const [isCustomBriefing, setIsCustomBriefing] = useState(false);
  const [templateLoadError, setTemplateLoadError] = useState(false);
  const [templateLoading, setTemplateLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/briefings/public/${token}`)
      .then(r => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then(async (data) => {
        setBriefing(data);
        if (data.status === "Respondido") setSubmitted(true);
        if (data.answers) {
          try { setAnswers(JSON.parse(data.answers)); } catch {}
        }
        if (data.briefingType === "custom" && data.templateId) {
          setIsCustomBriefing(true);
          setTemplateLoading(true);
          try {
            const tRes = await fetch(`/api/briefings/public/${token}/template`);
            if (tRes.ok) {
              const tData = await tRes.json();
              const qs = tData.questions || [];
              if (qs.length === 0) {
                setTemplateLoadError(true);
              } else {
                setTemplateQuestions(qs);
              }
            } else {
              setTemplateLoadError(true);
            }
          } catch {
            setTemplateLoadError(true);
          } finally {
            setTemplateLoading(false);
          }
        }
      })
      .catch(() => setBriefing(null))
      .finally(() => setLoading(false));
  }, [token]);

  /** Validates all required questions in a given phase, setting error messages for incomplete fields */
  const validatePhase = (phaseIndex: number): boolean => {
    const phase = BRIEFING_QUESTIONS[phaseIndex];
    const errors: Record<string, string> = {};

    for (const q of phase.questions) {
      if (q.conditionalOn) {
        const condVal = answers[q.conditionalOn.questionId];
        if (condVal !== q.conditionalOn.value) continue;
      }

      if (!q.required) continue;

      const answer = answers[q.id];

      if (q.type === "multi-select") {
        if (!answer || !Array.isArray(answer) || answer.length === 0) {
          errors[q.id] = "Selecione pelo menos uma opção";
        }
      } else if (q.type === "color-picker") {
        if (!answer || !Array.isArray(answer) || answer.filter((c: string) => c).length === 0) {
          errors[q.id] = "Escolha pelo menos uma cor";
        }
      } else if (q.type === "radio") {
        if (!answer) {
          errors[q.id] = "Selecione uma opção";
        }
      } else if (q.type === "file-upload") {
        if (!answer || !answer.fileUrl) {
          errors[q.id] = "Envie um arquivo";
        }
      } else if (q.type === "image-upload") {
        if (!answer || !Array.isArray(answer) || answer.length === 0) {
          errors[q.id] = "Envie pelo menos 1 imagem";
        }
      } else if (q.type === "select") {
        if (!answer) {
          errors[q.id] = "Selecione uma opção";
        }
      } else {
        if (!answer || (typeof answer === "string" && answer.trim() === "")) {
          errors[q.id] = "Este campo é obrigatório";
        }
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /** Advances to the next phase after validating the current one */
  const handleNextPhase = () => {
    if (validatePhase(currentPhase)) {
      setCurrentPhase(p => Math.min(BRIEFING_QUESTIONS.length - 1, p + 1));
    } else {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
    }
  };

  /** Submits the completed standard briefing answers to the server */
  const handleSubmit = async () => {
    if (!validatePhase(currentPhase)) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/briefings/public/${token}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Erro");
      }
      setSubmitted(true);
      toast({ title: "Briefing enviado com sucesso!" });
    } catch (err: any) {
      toast({ title: err.message || "Erro ao enviar briefing", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  /** Updates an answer value and clears its validation error */
  const setAnswer = (id: string, value: any) => {
    setAnswers(prev => ({ ...prev, [id]: value }));
    setValidationErrors(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  /** Toggles an option in a multi-select answer (adds if not present, removes if present) */
  const toggleMultiSelect = (id: string, option: string) => {
    setAnswers(prev => {
      const current = prev[id] || [];
      if (current.includes(option)) {
        return { ...prev, [id]: current.filter((o: string) => o !== option) };
      }
      return { ...prev, [id]: [...current, option] };
    });
    setValidationErrors(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  /** Uploads one or more images for a question, enforcing size and count limits */
  const handleImageUpload = async (questionId: string, files: FileList | null) => {
    if (!files || files.length === 0) return;

    const currentImages = answers[questionId] || [];
    const remainingSlots = 5 - currentImages.length;

    if (remainingSlots <= 0) {
      toast({ title: "Máximo de 5 imagens atingido", variant: "destructive" });
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remainingSlots);

    for (const file of filesToUpload) {
      if (file.size > MAX_IMAGE_SIZE) {
        toast({ title: `"${file.name}" excede o limite de 2MB`, variant: "destructive" });
        return;
      }
      if (!file.type.startsWith("image/")) {
        toast({ title: `"${file.name}" não é uma imagem válida`, variant: "destructive" });
        return;
      }
    }

    setUploadingImages(true);
    try {
      const uploadedPaths: string[] = [];

      for (const file of filesToUpload) {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/uploads/briefing", {
          method: "POST",
          headers: { "X-Briefing-Token": token },
          body: formData,
        });

        if (!response.ok) throw new Error("Erro ao enviar imagem");

        const data = await response.json();
        uploadedPaths.push(data.objectPath);
      }

      setAnswer(questionId, [...currentImages, ...uploadedPaths]);
      toast({ title: `${uploadedPaths.length} imagem(ns) enviada(s)` });
    } catch (err: any) {
      toast({ title: err.message || "Erro ao enviar imagens", variant: "destructive" });
    } finally {
      setUploadingImages(false);
    }
  };

  /** Removes an uploaded image from a question's answer list by index */
  const removeImage = (questionId: string, index: number) => {
    const current = answers[questionId] || [];
    setAnswer(questionId, current.filter((_: any, i: number) => i !== index));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!briefing) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center py-12">
            <FileText className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <h2 className="text-lg font-bold mb-1">Briefing não encontrado</h2>
            <p className="text-sm text-muted-foreground text-center">
              Este link pode ter expirado ou o briefing foi removido.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center py-12">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-lg font-bold mb-1">Briefing Enviado!</h2>
            <p className="text-sm text-muted-foreground text-center">
              Obrigado por responder o briefing. A equipe irá analisar suas respostas.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  /** Uploads a single file for a custom template question (max 10MB) */
  const handleCustomFileUpload = async (questionId: string, files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Arquivo excede o limite de 10MB", variant: "destructive" });
      return;
    }
    setUploadingImages(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/uploads/briefing-file", {
        method: "POST",
        headers: { "X-Briefing-Token": token },
        body: formData,
      });
      if (!response.ok) throw new Error("Erro ao enviar arquivo");
      const data = await response.json();
      setAnswer(questionId, { fileName: data.fileName, fileUrl: data.fileUrl });
      toast({ title: "Arquivo enviado" });
    } catch (err: any) {
      toast({ title: err.message || "Erro ao enviar arquivo", variant: "destructive" });
    } finally {
      setUploadingImages(false);
    }
  };

  /** Validates all required custom template questions, returning true if all are filled */
  const validateCustomQuestions = (): boolean => {
    const errors: Record<string, string> = {};
    for (const q of templateQuestions) {
      if (!q.required) continue;
      const answer = answers[q.id];
      if (q.type === "color-picker") {
        if (!answer || !Array.isArray(answer) || answer.filter((c: string) => c).length === 0) {
          errors[q.id] = "Escolha pelo menos uma cor";
        }
      } else if (q.type === "file-upload") {
        if (!answer || !answer.fileUrl) {
          errors[q.id] = "Envie um arquivo";
        }
      } else {
        if (!answer || (typeof answer === "string" && answer.trim() === "")) {
          errors[q.id] = "Este campo é obrigatório";
        }
      }
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /** Submits the completed custom briefing answers to the server */
  const handleCustomSubmit = async () => {
    if (!validateCustomQuestions()) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/briefings/public/${token}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Erro");
      }
      setSubmitted(true);
      toast({ title: "Briefing enviado com sucesso!" });
    } catch (err: any) {
      toast({ title: err.message || "Erro ao enviar briefing", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (isCustomBriefing && templateLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isCustomBriefing && templateLoadError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center py-12">
            <AlertCircle className="w-12 h-12 text-destructive/50 mb-4" />
            <h2 className="text-lg font-bold mb-1">Erro ao carregar template</h2>
            <p className="text-sm text-muted-foreground text-center">
              Não foi possível carregar as perguntas deste briefing. Por favor, tente novamente ou entre em contato com a equipe.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isCustomBriefing && templateQuestions.length > 0) {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-40 bg-card border-b">
          <div className="max-w-3xl mx-auto px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <FileText className="w-4 h-4 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-sm font-bold leading-tight">{briefing?.title}</h1>
                <p className="text-xs text-muted-foreground">{briefing?.client?.name || briefing?.clientName}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="space-y-6">
            {templateQuestions.map((q, idx) => {
              const hasError = !!validationErrors[q.id];
              return (
                <Card key={q.id} className={hasError ? "border-destructive" : ""} data-testid={`card-question-${q.id}`}>
                  <CardContent className="pt-5 pb-5">
                    <Label className="text-sm font-medium mb-3 block">
                      <span className="text-muted-foreground mr-2">{String(idx + 1).padStart(2, '0')}.</span>
                      {q.text}
                      {q.required && <span className="text-destructive ml-1">*</span>}
                    </Label>

                    {q.type === "color-picker" ? (
                      <ColorPickerField
                        value={answers[q.id] || ["", "", ""]}
                        onChange={(colors) => setAnswer(q.id, colors)}
                        hasError={hasError}
                      />
                    ) : q.type === "file-upload" ? (
                      <CustomFileUploadField
                        value={answers[q.id]}
                        onUpload={(files) => handleCustomFileUpload(q.id, files)}
                        onRemove={() => setAnswer(q.id, null)}
                        uploading={uploadingImages}
                        hasError={hasError}
                      />
                    ) : (
                      <TextareaWithExtras
                        value={answers[q.id] || ""}
                        onChange={(val) => setAnswer(q.id, val)}
                        placeholder="Digite sua resposta..."
                        className={hasError ? "border-destructive" : ""}
                        rows={3}
                        testId={`input-${q.id}`}
                      />
                    )}

                    {hasError && (
                      <p className="text-xs text-destructive mt-1.5 flex items-center gap-1" data-testid={`error-${q.id}`}>
                        <AlertCircle className="w-3 h-3" />
                        {validationErrors[q.id]}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="flex justify-end mt-8 pb-8">
            <Button
              onClick={handleCustomSubmit}
              disabled={submitting}
              data-testid="button-submit-briefing"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Enviar Briefing
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const phase = BRIEFING_QUESTIONS[currentPhase];
  const totalPhases = BRIEFING_QUESTIONS.length;
  const progress = ((currentPhase + 1) / totalPhases) * 100;

  const visibleQuestions = phase.questions.filter(q => {
    if (!q.conditionalOn) return true;
    return answers[q.conditionalOn.questionId] === q.conditionalOn.value;
  });

  /** Renders a single briefing question card with the appropriate input type and validation state */
  const renderQuestion = (q: BriefingQuestion, idx: number) => {
    const hasError = !!validationErrors[q.id];

    return (
      <Card key={q.id} data-testid={`card-question-${q.id}`} className={hasError ? "border-destructive" : ""}>
        <CardContent className="pt-5 pb-5">
          <Label className="text-sm font-medium mb-3 block">
            <span className="text-muted-foreground mr-2">{String(idx + 1).padStart(2, '0')}.</span>
            {q.text}
            {q.required && <span className="text-destructive ml-1">*</span>}
          </Label>

          {q.type === "select" ? (
            <Select
              value={answers[q.id] || ""}
              onValueChange={(v) => setAnswer(q.id, v)}
            >
              <SelectTrigger data-testid={`select-${q.id}`} className={hasError ? "border-destructive" : ""}>
                <SelectValue placeholder="Selecione uma opção" />
              </SelectTrigger>
              <SelectContent>
                {q.options?.map((opt) => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : q.type === "multi-select" ? (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {q.options?.map((opt) => {
                const selected = (answers[q.id] || []).includes(opt);
                return (
                  <Badge
                    key={opt}
                    variant={selected ? "default" : "outline"}
                    className="cursor-pointer text-xs toggle-elevate"
                    onClick={() => toggleMultiSelect(q.id, opt)}
                    data-testid={`option-${q.id}-${opt.toLowerCase().replace(/\s/g, '-')}`}
                  >
                    {opt}
                  </Badge>
                );
              })}
            </div>
          ) : q.type === "color-picker" ? (
            <ColorPickerField
              value={answers[q.id] || ["", "", ""]}
              onChange={(colors) => setAnswer(q.id, colors)}
              hasError={hasError}
            />
          ) : q.type === "radio" ? (
            <div className="flex gap-4 mt-1">
              {q.options?.map((opt) => (
                <label
                  key={opt}
                  className="flex items-center gap-2 cursor-pointer"
                  data-testid={`radio-${q.id}-${opt.toLowerCase()}`}
                >
                  <input
                    type="radio"
                    name={q.id}
                    value={opt}
                    checked={answers[q.id] === opt}
                    onChange={() => {
                      setAnswer(q.id, opt);
                      if (opt === "Não" && q.id === "q35") {
                        setAnswer("q35_images", []);
                      }
                    }}
                    className="w-4 h-4 accent-primary"
                  />
                  <span className="text-sm">{opt}</span>
                </label>
              ))}
            </div>
          ) : q.type === "file-upload" ? (
            <CustomFileUploadField
              value={answers[q.id]}
              onUpload={(files) => handleCustomFileUpload(q.id, files)}
              onRemove={() => setAnswer(q.id, null)}
              uploading={uploadingImages}
              hasError={hasError}
            />
          ) : q.type === "image-upload" ? (
            <ImageUploadField
              value={answers[q.id] || []}
              onUpload={(files) => handleImageUpload(q.id, files)}
              onRemove={(index) => removeImage(q.id, index)}
              uploading={uploadingImages}
              hasError={hasError}
            />
          ) : (
            <TextareaWithExtras
              value={answers[q.id] || ""}
              onChange={(val) => setAnswer(q.id, val)}
              placeholder="Digite sua resposta..."
              className={hasError ? "border-destructive" : ""}
              rows={3}
              testId={`input-${q.id}`}
            />
          )}

          {hasError && (
            <p className="text-xs text-destructive mt-1.5 flex items-center gap-1" data-testid={`error-${q.id}`}>
              <AlertCircle className="w-3 h-3" />
              {validationErrors[q.id]}
            </p>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-40 bg-card border-b">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4 mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <FileText className="w-4 h-4 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-sm font-bold leading-tight">{briefing.title}</h1>
                <p className="text-xs text-muted-foreground">{briefing.client?.name || briefing.clientName}</p>
              </div>
            </div>
            <Badge variant="secondary" className="text-xs shrink-0">
              Fase {currentPhase + 1} de {totalPhases}
            </Badge>
          </div>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Badge variant="outline" className="mb-2 text-primary border-primary/30">
            FASE {phase.phase}
          </Badge>
          <h2 className="text-xl font-bold">{phase.label}</h2>
        </div>

        <div className="space-y-6">
          {visibleQuestions.map((q, idx) => renderQuestion(q, idx))}
        </div>

        <div className="flex items-center justify-between mt-8 pb-8">
          <Button
            variant="outline"
            onClick={() => {
              setValidationErrors({});
              setCurrentPhase(p => Math.max(0, p - 1));
            }}
            disabled={currentPhase === 0}
            data-testid="button-prev-phase"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Anterior
          </Button>

          {currentPhase < totalPhases - 1 ? (
            <Button
              onClick={handleNextPhase}
              data-testid="button-next-phase"
            >
              Próxima Fase
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              data-testid="button-submit-briefing"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Enviar Briefing
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * ColorPickerField - Allows selection of up to 3 brand colors via native color inputs with hex code display.
 * @param value - Array of up to 3 hex color strings
 * @param onChange - Callback when colors change
 * @param hasError - Whether to show error styling
 */
function ColorPickerField({ value, onChange, hasError }: { value: string[]; onChange: (colors: string[]) => void; hasError: boolean }) {
  const colors = [value[0] || "", value[1] || "", value[2] || ""];

  const updateColor = (index: number, color: string) => {
    const next = [...colors];
    next[index] = color;
    onChange(next);
  };

  return (
    <div className="space-y-3 mt-2">
      <div className="flex gap-6 flex-wrap">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <label className="text-xs text-muted-foreground font-medium">Cor {i + 1}{i === 0 ? " *" : ""}</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={colors[i] || "#000000"}
                onChange={(e) => updateColor(i, e.target.value)}
                className="w-10 h-10 rounded-md border cursor-pointer p-0.5"
                data-testid={`color-picker-${i}`}
              />
              <Input
                value={colors[i]}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "" || /^#[0-9a-fA-F]{0,6}$/.test(val)) {
                    updateColor(i, val);
                  }
                }}
                placeholder="#000000"
                className="w-24 font-mono text-xs"
                data-testid={`color-input-${i}`}
              />
            </div>
            {colors[i] && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => updateColor(i, "")}
                data-testid={`color-clear-${i}`}
              >
                Limpar
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * CustomFileUploadField - File upload component for custom briefing questions.
 * Shows the uploaded file name when present, or an upload button when empty.
 */
function CustomFileUploadField({ value, onUpload, onRemove, uploading, hasError }: {
  value: { fileName: string; fileUrl: string } | null;
  onUpload: (files: FileList | null) => void;
  onRemove: () => void;
  uploading: boolean;
  hasError: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-3 mt-2">
      {value?.fileUrl ? (
        <div className="flex items-center gap-2 p-2 rounded-md border">
          <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
          <span className="text-sm truncate flex-1">{value.fileName}</span>
          <Button variant="ghost" size="icon" onClick={onRemove} data-testid="button-remove-file">
            <X className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      ) : (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            onChange={(e) => onUpload(e.target.files)}
            className="hidden"
            data-testid="input-file-upload"
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            data-testid="button-upload-file"
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-2" />
            )}
            {uploading ? "Enviando..." : "Enviar arquivo"}
          </Button>
          <p className="text-xs text-muted-foreground mt-1.5">
            Máximo 10MB
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * ImageUploadField - Multi-image upload component for briefing questions.
 * Displays uploaded image previews with remove buttons and enforces a 5-image limit.
 */
function ImageUploadField({ value, onUpload, onRemove, uploading, hasError }: {
  value: string[];
  onUpload: (files: FileList | null) => void;
  onRemove: (index: number) => void;
  uploading: boolean;
  hasError: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-3 mt-2">
      <div className="flex flex-wrap gap-3">
        {value.map((path, i) => (
          <div key={i} className="relative group">
            <img
              src={path}
              className="w-24 h-24 object-cover rounded-md border"
              data-testid={`image-preview-${i}`}
            />
            <button
              onClick={() => onRemove(i)}
              className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs"
              data-testid={`button-remove-image-${i}`}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {value.length < 5 && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => onUpload(e.target.files)}
            className="hidden"
            data-testid="input-image-upload"
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            data-testid="button-upload-images"
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-2" />
            )}
            {uploading ? "Enviando..." : `Enviar imagem (${value.length}/5)`}
          </Button>
          <p className="text-xs text-muted-foreground mt-1.5">
            <ImageIcon className="w-3 h-3 inline mr-1" />
            Máximo 5 imagens, 2MB cada. Formatos: JPG, PNG, GIF, WebP
          </p>
        </div>
      )}
    </div>
  );
}
