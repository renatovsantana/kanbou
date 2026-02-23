import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { FileText, Plus, Eye, Trash2, Clock, CheckCircle2, Copy, ExternalLink, Download, Loader2, Settings2, GripVertical, X } from "lucide-react";
import type { Briefing, Client, BriefingTemplate, BriefingTemplateQuestion } from "@shared/schema";
import { isInternalRole } from "@shared/schema";

export type QuestionType = "text" | "select" | "multi-select" | "color-picker" | "radio" | "image-upload" | "file-upload";

export interface BriefingQuestion {
  id: string;
  text: string;
  type?: QuestionType;
  options?: string[];
  required?: boolean;
  conditionalOn?: { questionId: string; value: string };
  maxImages?: number;
  maxSizeMB?: number;
}

export interface BriefingPhase {
  phase: number;
  label: string;
  questions: BriefingQuestion[];
}

const BRIEFING_QUESTIONS: BriefingPhase[] = [
  { phase: 1, label: "Sobre o Contratante", questions: [
    { id: "q01", text: "Atualmente, qual sua função dentro dessa empresa?", required: true },
    { id: "q02", text: "Quais os motivos que te levaram a abrir essa empresa?", required: true },
    { id: "q03", text: "Por que a empresa tem esse nome? O que ele significa pra você?", required: true },
    { id: "q04", text: "Como você vê a empresa em 5 anos? E em 10?", required: true },
    { id: "q05", text: "A empresa pode ser outra coisa no futuro ou atuar em outro segmento? Se sim, o que seria?", required: true },
    { id: "q06", text: "O que te fez me procurar para criar um projeto de Identidade Visual. Por que isso é importante pra você e para sua empresa?", required: true },
    { id: "q07", text: "Por que você acredita que as pessoas precisam da sua empresa?", required: true },
  ]},
  { phase: 2, label: "Sobre a Empresa", questions: [
    { id: "q08", text: "Descreva resumidamente do que se trata sua empresa.", required: true },
    { id: "q09", text: "Qual o momento atual da empresa?", required: true },
    { id: "q10", text: "Há quanto tempo sua empresa existe?", required: true },
    { id: "q11", text: "Quais produtos ou serviços sua empresa oferece?", required: true },
    { id: "q12", text: "O que faz sua empresa ser especial?", required: true },
    { id: "q13", text: "Sua empresa tem algum slogan?", required: true },
    { id: "q14", text: "Sua empresa tem concorrentes? Quem são? Fale um pouco sobre eles se achar necessário. Coloque nomes e links se puder.", required: true },
    { id: "q15", text: "Seus concorrentes oferecem algo que sua empresa não oferece?", required: true },
    { id: "q16", text: "Quais missões, visões e valores da sua empresa?", required: true },
  ]},
  { phase: 3, label: "Sobre o Público Alvo", questions: [
    { id: "q17", text: "Qual a classe social?", required: true },
    { id: "q18", text: "Qual a faixa etária?", required: true },
    { id: "q19", text: "Gênero", type: "select", options: ["Totalmente masculino", "Totalmente feminino", "Masculino predominante, pouco feminino", "Feminino predominante, pouco masculino", "Ambos os gêneros"], required: true },
    { id: "q20", text: "Quem são eles? Descreva com suas palavras.", required: true },
    { id: "q21", text: "Como você gostaria que os clientes descrevessem sua empresa?", required: true },
    { id: "q22", text: "De que forma você espera que seu cliente encontre sua empresa?", required: true },
    { id: "q23", text: "Quais os locais você acredita que seu cliente mais verá o logotipo da sua empresa. Acrescente por ordem de importância.", required: true },
  ]},
  { phase: 4, label: "Personalidade da Marca", questions: [
    { id: "q24", text: "Se a sua empresa fosse uma pessoa como ela seria? Escolha quantas opções julgar necessário:", type: "multi-select", options: [
      "Séria","Extrovertida","Alegre","Brincalhona","Conservadora","Moderna","Nerd","Elegante","Discreta","Delicada","Sensível","Madura","Aventureira","Rebelde","Tradicional","Calma","Líder","Energética","Sábia","Acessível","Exclusiva","Criativa","Científica","Romântica","Técnica","Ousada","Grande","Arrogante","Complexa","Sóbria","Rústica","Formal","Futurista","Antiga","Racional","Determinada","Mente Aberta","Relaxada","Divertida","Irreverente","Emocional","Tranquila","Intuitiva","Confiável","Diferente","Curiosa","Persistente","Disciplinada","Profissional","Respeitadora","Analítica","Arrojada","Artística","Reservada","Modesta","Esperta","Deslumbrante","Atual","Padronizada","Inocente","Livre","Acadêmica","Estável","Sutil","Básica","Casual","Rigorosa","Sonhadora","Idealista","Agressiva","Pequena","Convencional","Radical","Simples","Grosseira","Atrevida","Previsível","Cotidiana","Pessimista","Multifacetada","Refinada","Promissora","Da Massa","Enigmática","Industrial","Nostálgica","Comum"
    ], required: true },
    { id: "q25", text: "Dessas palavras que você escolheu, cite 3 que você considera mais forte.", required: true },
    { id: "q26", text: "Se sua empresa fosse uma pessoa, como ela NÃO seria:", type: "multi-select", options: [
      "Séria","Extrovertida","Alegre","Brincalhona","Conservadora","Moderna","Nerd","Elegante","Discreta","Delicada","Sensível","Madura","Aventureira","Rebelde","Tradicional","Calma","Líder","Energética","Sábia","Acessível","Exclusiva","Criativa","Científica","Romântica","Técnica","Ousada","Grande","Arrogante","Complexa","Sóbria","Rústica","Formal","Futurista","Antiga","Racional","Determinada","Mente Aberta","Relaxada","Divertida","Irreverente","Emocional","Tranquila","Intuitiva","Confiável","Diferente","Curiosa","Persistente","Disciplinada","Profissional","Respeitadora","Analítica","Arrojada","Artística","Reservada","Modesta","Esperta","Deslumbrante","Atual","Padronizada","Inocente","Livre","Acadêmica","Estável","Sutil","Básica","Casual","Rigorosa","Sonhadora","Idealista","Agressiva","Pequena","Convencional","Radical","Simples","Grosseira","Atrevida","Previsível","Cotidiana","Pessimista","Multifacetada","Refinada","Promissora","Da Massa","Enigmática","Industrial","Nostálgica","Comum"
    ], required: true },
    { id: "q27", text: "Se necessário, adicione mais algumas características.", required: false },
    { id: "q28", text: "Escolha até 3 cores que você gostaria na sua marca:", type: "color-picker", required: true },
    { id: "q29", text: "Há alguma cor que você NÃO queira na sua marca?", required: true },
    { id: "q30", text: "Há algum elemento que você não queira na sua marca?", required: true },
    { id: "q31", text: "Pensando apenas em aspectos visuais, selecione alguns atributos que têm alguma relação com a sua marca.", type: "multi-select", options: [
      "Séria","Extrovertida","Conservadora","Alegre","Aconchegante","Delicada","Moderna","Orgânica","Sofisticada","Elegante","Vibrante","Tradicional","Retrô","Digital","Pesada","Leve","Rústica","Discreta","Extravagante","Nobre","Popular","Romântica","Formal","Ousada","Humana","Rebelde","Irreverente"
    ], required: true },
    { id: "q32", text: "Fique à vontade para dizer mais sobre a sua empresa ou dar considerações finais.", required: false },
    { id: "q33", text: "Você já pintou o estabelecimento e/ou já comprou a mobília?", required: true },
    { id: "q34", text: "Sua empresa ou algum produto que você comercializa possui uma história?", required: true },
    { id: "q35", text: "Você tem alguma referência visual?", type: "radio", options: ["Sim", "Não"], required: true },
    { id: "q35_images", text: "Envie suas imagens de referência (máximo 5 imagens, 2MB cada):", type: "image-upload", conditionalOn: { questionId: "q35", value: "Sim" }, maxImages: 5, maxSizeMB: 2, required: true },
  ]},
];

export { BRIEFING_QUESTIONS };

function generatePdfContent(briefing: Briefing, answers: Record<string, any>): string {
  let html = `
    <html><head><meta charset="utf-8">
    <style>
      body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #1a1a1a; max-width: 800px; margin: 0 auto; }
      h1 { color: #16a34a; font-size: 28px; border-bottom: 3px solid #16a34a; padding-bottom: 12px; margin-bottom: 8px; }
      .subtitle { color: #666; font-size: 14px; margin-bottom: 32px; }
      h2 { color: #16a34a; font-size: 18px; margin-top: 32px; padding: 8px 12px; background: #f0fdf4; border-radius: 6px; }
      .question { margin: 16px 0; padding: 12px 0; border-bottom: 1px solid #e5e7eb; }
      .question-label { font-size: 12px; color: #6b7280; font-weight: 600; margin-bottom: 6px; text-transform: uppercase; }
      .answer { font-size: 14px; line-height: 1.6; }
      .badge-list { display: flex; flex-wrap: wrap; gap: 6px; }
      .badge { display: inline-block; padding: 3px 10px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; font-size: 12px; color: #166534; }
      .color-swatch { display: inline-block; width: 28px; height: 28px; border-radius: 6px; border: 2px solid #e5e7eb; margin-right: 8px; vertical-align: middle; }
      .ref-images { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
      .ref-images img { max-width: 180px; max-height: 140px; border-radius: 6px; border: 1px solid #e5e7eb; object-fit: cover; }
      @media print { body { padding: 20px; } }
    </style>
    </head><body>
    <h1>${briefing.title}</h1>
    <div class="subtitle">Cliente: ${briefing.clientName} &mdash; Respondido em ${briefing.completedAt ? new Date(briefing.completedAt).toLocaleDateString("pt-BR") : new Date().toLocaleDateString("pt-BR")}</div>
  `;

  for (const phase of BRIEFING_QUESTIONS) {
    html += `<h2>Fase ${phase.phase} &mdash; ${phase.label}</h2>`;
    for (const q of phase.questions) {
      const answer = answers[q.id];
      if (q.conditionalOn) {
        const condVal = answers[q.conditionalOn.questionId];
        if (condVal !== q.conditionalOn.value) continue;
      }
      if (!answer || (Array.isArray(answer) && answer.length === 0)) continue;

      html += `<div class="question"><div class="question-label">${q.text}</div><div class="answer">`;

      if (q.type === "color-picker" && Array.isArray(answer)) {
        for (const c of answer) {
          if (c) html += `<span class="color-swatch" style="background:${c}"></span><span style="font-size:12px;margin-right:16px;">${c}</span>`;
        }
      } else if (q.type === "image-upload" && Array.isArray(answer)) {
        html += `<div class="ref-images">`;
        for (const url of answer) {
          html += `<img src="${window.location.origin}${url}" />`;
        }
        html += `</div>`;
      } else if (typeof answer === "object" && answer !== null && answer.fileUrl) {
        html += `<a href="${window.location.origin}${answer.fileUrl}" target="_blank">${answer.fileName || "Arquivo anexado"}</a>`;
      } else if (Array.isArray(answer)) {
        html += `<div class="badge-list">`;
        for (const a of answer) {
          html += `<span class="badge">${a}</span>`;
        }
        html += `</div>`;
      } else {
        html += answer;
      }

      html += `</div></div>`;
    }
  }

  html += `</body></html>`;
  return html;
}

export async function exportBriefingPdf(briefing: Briefing, templates?: BriefingTemplate[]) {
  if (!briefing.answers) return;
  let answers: Record<string, any>;
  try {
    answers = JSON.parse(briefing.answers);
  } catch {
    return;
  }

  let html: string;
  if (briefing.briefingType === "custom" && briefing.templateId) {
    const template = templates?.find(t => t.id === briefing.templateId);
    let questions: BriefingTemplateQuestion[] = [];
    if (template) {
      try { questions = JSON.parse(template.questions); } catch {}
    }
    html = generateCustomPdfContent(briefing, answers, questions);
  } else {
    html = generatePdfContent(briefing, answers);
  }

  const printWindow = window.open("", "_blank");
  if (!printWindow) return;
  printWindow.document.write(html);
  printWindow.document.close();
  setTimeout(() => {
    printWindow.print();
  }, 500);
}

function generateCustomPdfContent(briefing: Briefing, answers: Record<string, any>, questions: BriefingTemplateQuestion[]): string {
  let html = `
    <html><head><meta charset="utf-8">
    <style>
      body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #1a1a1a; max-width: 800px; margin: 0 auto; }
      h1 { color: #16a34a; font-size: 28px; border-bottom: 3px solid #16a34a; padding-bottom: 12px; margin-bottom: 8px; }
      .subtitle { color: #666; font-size: 14px; margin-bottom: 32px; }
      .question { margin: 16px 0; padding: 12px 0; border-bottom: 1px solid #e5e7eb; }
      .question-label { font-size: 12px; color: #6b7280; font-weight: 600; margin-bottom: 6px; text-transform: uppercase; }
      .answer { font-size: 14px; line-height: 1.6; }
      .color-swatch { display: inline-block; width: 28px; height: 28px; border-radius: 6px; border: 2px solid #e5e7eb; margin-right: 8px; vertical-align: middle; }
      @media print { body { padding: 20px; } }
    </style>
    </head><body>
    <h1>${briefing.title}</h1>
    <div class="subtitle">Cliente: ${briefing.clientName} &mdash; Respondido em ${briefing.completedAt ? new Date(briefing.completedAt).toLocaleDateString("pt-BR") : new Date().toLocaleDateString("pt-BR")}</div>
  `;

  for (const q of questions) {
    const answer = answers[q.id];
    if (!answer || (Array.isArray(answer) && answer.length === 0)) continue;

    html += `<div class="question"><div class="question-label">${q.text}</div><div class="answer">`;

    if (q.type === "color-picker" && Array.isArray(answer)) {
      for (const c of answer) {
        if (c) html += `<span class="color-swatch" style="background:${c}"></span><span style="font-size:12px;margin-right:16px;">${c}</span>`;
      }
    } else if (typeof answer === "object" && answer !== null && answer.fileUrl) {
      html += `<a href="${window.location.origin}${answer.fileUrl}" target="_blank">${answer.fileName || "Arquivo anexado"}</a>`;
    } else {
      html += String(answer);
    }

    html += `</div></div>`;
  }

  if (questions.length === 0) {
    const entries = Object.entries(answers);
    for (const [key, answer] of entries) {
      if (!answer || (Array.isArray(answer) && answer.length === 0)) continue;
      html += `<div class="question"><div class="question-label">Pergunta</div><div class="answer">`;
      if (Array.isArray(answer)) {
        for (const c of answer) {
          if (c) html += `<span class="color-swatch" style="background:${c}"></span><span style="font-size:12px;margin-right:16px;">${c}</span>`;
        }
      } else if (typeof answer === "object" && answer !== null && answer.fileUrl) {
        html += `<a href="${window.location.origin}${answer.fileUrl}" target="_blank">${answer.fileName || "Arquivo anexado"}</a>`;
      } else {
        html += String(answer);
      }
      html += `</div></div>`;
    }
  }

  html += `</body></html>`;
  return html;
}

export default function BriefingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const role = user?.role || "admin";
  const [createOpen, setCreateOpen] = useState(false);
  const [viewBriefing, setViewBriefing] = useState<Briefing | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [briefingTitle, setBriefingTitle] = useState("Briefing de Marca");
  const [briefingType, setBriefingType] = useState<"brand" | "custom">("brand");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<BriefingTemplate | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templateQuestions, setTemplateQuestions] = useState<BriefingTemplateQuestion[]>([]);

  const { data: briefingsList = [], isLoading } = useQuery<Briefing[]>({
    queryKey: ["/api/briefings"],
  });

  const { data: clientsList = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    enabled: isInternalRole(role),
  });

  const { data: templatesList = [] } = useQuery<BriefingTemplate[]>({
    queryKey: ["/api/briefing-templates"],
    enabled: isInternalRole(role),
  });

  const createMutation = useMutation({
    mutationFn: async (data: { clientId: number; clientName: string; title: string; briefingType: string; templateId?: number }) => {
      const res = await apiRequest("POST", "/api/briefings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/briefings"] });
      setCreateOpen(false);
      setSelectedClientId("");
      setBriefingTitle("Briefing de Marca");
      setBriefingType("brand");
      setSelectedTemplateId("");
      toast({ title: "Briefing criado com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao criar briefing", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/briefings/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/briefings"] });
      toast({ title: "Briefing excluído" });
    },
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (data: { name: string; description: string | null; questions: string }) => {
      const res = await apiRequest("POST", "/api/briefing-templates", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/briefing-templates"] });
      resetTemplateDialog();
      toast({ title: "Template criado com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao criar template", variant: "destructive" });
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { name: string; description: string | null; questions: string } }) => {
      const res = await apiRequest("PUT", `/api/briefing-templates/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/briefing-templates"] });
      resetTemplateDialog();
      toast({ title: "Template atualizado" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar template", variant: "destructive" });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/briefing-templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/briefing-templates"] });
      toast({ title: "Template excluído" });
    },
  });

  const resetTemplateDialog = () => {
    setTemplateDialogOpen(false);
    setEditingTemplate(null);
    setTemplateName("");
    setTemplateDescription("");
    setTemplateQuestions([]);
  };

  const openEditTemplate = (template: BriefingTemplate) => {
    setEditingTemplate(template);
    setTemplateName(template.name);
    setTemplateDescription(template.description || "");
    let parsed: BriefingTemplateQuestion[] = [];
    try { parsed = JSON.parse(template.questions); } catch {}
    setTemplateQuestions(parsed);
    setTemplateDialogOpen(true);
  };

  const addTemplateQuestion = () => {
    setTemplateQuestions(prev => [
      ...prev,
      { id: `q_${Date.now()}`, text: "", type: "text", required: true },
    ]);
  };

  const updateTemplateQuestion = (index: number, updates: Partial<BriefingTemplateQuestion>) => {
    setTemplateQuestions(prev => prev.map((q, i) => i === index ? { ...q, ...updates } : q));
  };

  const removeTemplateQuestion = (index: number) => {
    setTemplateQuestions(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveTemplate = () => {
    if (!templateName.trim() || templateQuestions.length === 0) return;
    const filteredQuestions = templateQuestions.filter(q => q.text.trim());
    if (filteredQuestions.length === 0) return;
    const data = {
      name: templateName.trim(),
      description: templateDescription.trim() || null,
      questions: JSON.stringify(filteredQuestions),
    };
    if (editingTemplate) {
      updateTemplateMutation.mutate({ id: editingTemplate.id, data });
    } else {
      createTemplateMutation.mutate(data);
    }
  };

  const handleCreate = () => {
    const client = clientsList.find(c => c.id === parseInt(selectedClientId));
    if (!client) return;
    const payload: any = {
      clientId: client.id,
      clientName: client.name,
      title: briefingTitle || (briefingType === "custom" ? "Briefing Personalizado" : "Briefing de Marca"),
      briefingType,
    };
    if (briefingType === "custom" && selectedTemplateId) {
      payload.templateId = parseInt(selectedTemplateId);
    }
    createMutation.mutate(payload);
  };

  const getBriefingUrl = (token: string) => {
    return `${window.location.origin}/briefing/${token}`;
  };

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(getBriefingUrl(token));
    toast({ title: "Link copiado!" });
  };

  const renderAnswers = (briefing: Briefing) => {
    if (!briefing.answers) return null;
    let answers: Record<string, any>;
    try {
      answers = JSON.parse(briefing.answers);
    } catch {
      return <p className="text-sm text-muted-foreground">Respostas inválidas</p>;
    }

    if (briefing.briefingType === "custom" && briefing.templateId) {
      const template = templatesList.find(t => t.id === briefing.templateId);
      let questions: BriefingTemplateQuestion[] = [];
      if (template) {
        try { questions = JSON.parse(template.questions); } catch {}
      }

      if (questions.length === 0) {
        const entries = Object.entries(answers);
        return (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            {entries.map(([key, answer]) => {
              if (!answer || (Array.isArray(answer) && answer.length === 0)) return null;
              return (
                <div key={key} className="border-b pb-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Resposta</p>
                  {renderAnswerValue(answer)}
                </div>
              );
            })}
          </div>
        );
      }

      return (
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          {questions.map((q, idx) => {
            const answer = answers[q.id];
            if (!answer || (Array.isArray(answer) && answer.length === 0)) return null;
            return (
              <div key={q.id} className="border-b pb-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  {String(idx + 1).padStart(2, '0')}. {q.text}
                </p>
                {q.type === "color-picker" && Array.isArray(answer) ? (
                  <div className="flex items-center gap-3 mt-1">
                    {answer.map((c: string, i: number) => c ? (
                      <div key={i} className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-md border" style={{ backgroundColor: c }} />
                        <span className="text-xs text-muted-foreground">{c}</span>
                      </div>
                    ) : null)}
                  </div>
                ) : typeof answer === "object" && answer !== null && answer.fileUrl ? (
                  <a href={answer.fileUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    {answer.fileName || "Arquivo anexado"}
                  </a>
                ) : (
                  <p className="text-sm">{String(answer)}</p>
                )}
              </div>
            );
          })}
        </div>
      );
    }

    return (
      <div className="space-y-8 max-h-[60vh] overflow-y-auto pr-2">
        {BRIEFING_QUESTIONS.map((phase) => (
          <div key={phase.phase}>
            <h3 className="text-sm font-bold text-primary mb-3">
              FASE {phase.phase} - {phase.label.toUpperCase()}
            </h3>
            <div className="space-y-4">
              {phase.questions.map((q) => {
                if (q.conditionalOn) {
                  const condVal = answers[q.conditionalOn.questionId];
                  if (condVal !== q.conditionalOn.value) return null;
                }
                const answer = answers[q.id];
                if (!answer || (Array.isArray(answer) && answer.length === 0)) return null;
                return (
                  <div key={q.id} className="border-b pb-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      {q.text}
                    </p>
                    {renderAnswerValue(answer, q)}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderAnswerValue = (answer: any, q?: BriefingQuestion) => {
    if (q?.type === "color-picker" && Array.isArray(answer)) {
      return (
        <div className="flex items-center gap-3 mt-1">
          {answer.map((c: string, i: number) => c ? (
            <div key={i} className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-md border" style={{ backgroundColor: c }} />
              <span className="text-xs text-muted-foreground">{c}</span>
            </div>
          ) : null)}
        </div>
      );
    }
    if (q?.type === "image-upload" && Array.isArray(answer)) {
      return (
        <div className="flex flex-wrap gap-2 mt-1">
          {answer.map((url: string, i: number) => (
            <img key={i} src={url} className="w-24 h-24 object-cover rounded-md border" />
          ))}
        </div>
      );
    }
    if (Array.isArray(answer)) {
      if (answer.every((c: any) => typeof c === "string" && c.startsWith("#"))) {
        return (
          <div className="flex items-center gap-3 mt-1">
            {answer.map((c: string, i: number) => c ? (
              <div key={i} className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-md border" style={{ backgroundColor: c }} />
                <span className="text-xs text-muted-foreground">{c}</span>
              </div>
            ) : null)}
          </div>
        );
      }
      return (
        <div className="flex flex-wrap gap-1.5 mt-1">
          {answer.map((a: string, i: number) => (
            <Badge key={i} variant="secondary" className="text-xs">
              {a}
            </Badge>
          ))}
        </div>
      );
    }
    if (typeof answer === "object" && answer !== null && answer.fileUrl) {
      return (
        <a href={answer.fileUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5" />
          {answer.fileName || "Arquivo anexado"}
        </a>
      );
    }
    return <p className="text-sm">{String(answer)}</p>;
  };

  const renderBriefingsList = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      );
    }
    if (briefingsList.length === 0) {
      return (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileText className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground text-sm">Nenhum briefing criado ainda</p>
            {isInternalRole(role) && (
              <p className="text-muted-foreground/60 text-xs mt-1">
                Clique em "Novo Briefing" para começar
              </p>
            )}
          </CardContent>
        </Card>
      );
    }
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {briefingsList.map((briefing) => (
          <Card key={briefing.id} className="hover-elevate" data-testid={`card-briefing-${briefing.id}`}>
            <CardHeader className="flex flex-row items-start justify-between gap-2 pb-3">
              <div className="min-w-0 flex-1">
                <CardTitle className="text-base truncate">{briefing.title}</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">{briefing.clientName}</p>
                {briefing.briefingType === "custom" && (
                  <Badge variant="outline" className="mt-1 text-[10px]">Personalizado</Badge>
                )}
              </div>
              <Badge
                variant={briefing.status === "Respondido" ? "default" : "secondary"}
                className="shrink-0"
                data-testid={`badge-status-${briefing.id}`}
              >
                {briefing.status === "Respondido" ? (
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                ) : (
                  <Clock className="w-3 h-3 mr-1" />
                )}
                {briefing.status}
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground mb-4">
                Criado em {briefing.createdAt ? new Date(briefing.createdAt).toLocaleDateString("pt-BR") : "—"}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyLink(briefing.token)}
                  data-testid={`button-copy-link-${briefing.id}`}
                >
                  <Copy className="w-3.5 h-3.5 mr-1.5" />
                  Copiar Link
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(getBriefingUrl(briefing.token), "_blank")}
                  data-testid={`button-open-link-${briefing.id}`}
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                  Abrir
                </Button>
                {briefing.status === "Respondido" && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setViewBriefing(briefing)}
                      data-testid={`button-view-${briefing.id}`}
                    >
                      <Eye className="w-3.5 h-3.5 mr-1.5" />
                      Ver
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportBriefingPdf(briefing, templatesList)}
                      data-testid={`button-export-pdf-${briefing.id}`}
                    >
                      <Download className="w-3.5 h-3.5 mr-1.5" />
                      PDF
                    </Button>
                  </>
                )}
                {isInternalRole(role) && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" data-testid={`button-delete-briefing-${briefing.id}`}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir briefing?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteMutation.mutate(briefing.id)}>
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-display font-bold">Briefings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie briefings e templates personalizados
          </p>
        </div>
        {isInternalRole(role) && (
          <Button onClick={() => setCreateOpen(true)} data-testid="button-create-briefing">
            <Plus className="w-4 h-4 mr-2" />
            Novo Briefing
          </Button>
        )}
      </div>

      {isInternalRole(role) ? (
        <Tabs defaultValue="briefings" className="w-full">
          <TabsList className="mb-6" data-testid="tabs-briefings">
            <TabsTrigger value="briefings" data-testid="tab-briefings">Briefings</TabsTrigger>
            <TabsTrigger value="templates" data-testid="tab-templates">Templates</TabsTrigger>
          </TabsList>
          <TabsContent value="briefings">
            {renderBriefingsList()}
          </TabsContent>
          <TabsContent value="templates">
            <div className="flex items-center justify-between mb-6">
              <p className="text-sm text-muted-foreground">
                Crie templates com perguntas personalizadas para briefings
              </p>
              <Button onClick={() => { resetTemplateDialog(); setTemplateDialogOpen(true); }} data-testid="button-create-template">
                <Plus className="w-4 h-4 mr-2" />
                Novo Template
              </Button>
            </div>
            {templatesList.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Settings2 className="w-12 h-12 text-muted-foreground/30 mb-4" />
                  <p className="text-muted-foreground text-sm">Nenhum template criado</p>
                  <p className="text-muted-foreground/60 text-xs mt-1">
                    Templates permitem criar briefings com perguntas personalizadas
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {templatesList.map((template) => {
                  let qCount = 0;
                  try { qCount = JSON.parse(template.questions).length; } catch {}
                  return (
                    <Card key={template.id} className="hover-elevate" data-testid={`card-template-${template.id}`}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">{template.name}</CardTitle>
                        {template.description && (
                          <p className="text-xs text-muted-foreground mt-1">{template.description}</p>
                        )}
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-2 mb-3">
                          <Badge variant="secondary">{qCount} pergunta{qCount !== 1 ? "s" : ""}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {template.createdAt ? new Date(template.createdAt).toLocaleDateString("pt-BR") : ""}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Button variant="outline" size="sm" onClick={() => openEditTemplate(template)} data-testid={`button-edit-template-${template.id}`}>
                            <Settings2 className="w-3.5 h-3.5 mr-1.5" />
                            Editar
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" data-testid={`button-delete-template-${template.id}`}>
                                <Trash2 className="w-3.5 h-3.5 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir template?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta ação não pode ser desfeita. Briefings que usam este template não serão afetados.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteTemplateMutation.mutate(template.id)}>
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      ) : (
        renderBriefingsList()
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Briefing</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Cliente</Label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger data-testid="select-briefing-client">
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientsList.filter(c => c.isActive).map(client => (
                    <SelectItem key={client.id} value={String(client.id)}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo de Briefing</Label>
              <Select value={briefingType} onValueChange={(v) => { setBriefingType(v as "brand" | "custom"); setSelectedTemplateId(""); }}>
                <SelectTrigger data-testid="select-briefing-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="brand">Briefing de Marca (padrão)</SelectItem>
                  <SelectItem value="custom">Briefing Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {briefingType === "custom" && (
              <div>
                <Label>Template</Label>
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger data-testid="select-briefing-template">
                    <SelectValue placeholder="Selecione um template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templatesList.map(t => (
                      <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Título</Label>
              <Input
                value={briefingTitle}
                onChange={e => setBriefingTitle(e.target.value)}
                placeholder={briefingType === "custom" ? "Briefing Personalizado" : "Briefing de Marca"}
                data-testid="input-briefing-title"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!selectedClientId || (briefingType === "custom" && !selectedTemplateId) || createMutation.isPending}
                data-testid="button-save-briefing"
              >
                Criar Briefing
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={templateDialogOpen} onOpenChange={(o) => !o && resetTemplateDialog()}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "Editar Template" : "Novo Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Nome do Template</Label>
              <Input
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
                placeholder="Ex: Briefing de Redes Sociais"
                data-testid="input-template-name"
              />
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Textarea
                value={templateDescription}
                onChange={e => setTemplateDescription(e.target.value)}
                placeholder="Descreva o objetivo deste template..."
                className="resize-none min-h-[60px]"
                data-testid="textarea-template-description"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Perguntas</Label>
                <Button variant="outline" size="sm" onClick={addTemplateQuestion} data-testid="button-add-question">
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Adicionar
                </Button>
              </div>
              {templateQuestions.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Adicione perguntas ao template
                </p>
              )}
              <div className="space-y-3">
                {templateQuestions.map((q, index) => (
                  <div key={q.id} className="border rounded-md p-3 space-y-2" data-testid={`question-item-${index}`}>
                    <div className="flex items-start gap-2">
                      <div className="flex-1 space-y-2">
                        <Input
                          value={q.text}
                          onChange={e => updateTemplateQuestion(index, { text: e.target.value })}
                          placeholder={`Pergunta ${index + 1}...`}
                          data-testid={`input-question-text-${index}`}
                        />
                        <div className="flex items-center gap-3">
                          <Select value={q.type} onValueChange={(v) => updateTemplateQuestion(index, { type: v as BriefingTemplateQuestion["type"] })}>
                            <SelectTrigger className="w-[160px]" data-testid={`select-question-type-${index}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="text">Texto</SelectItem>
                              <SelectItem value="color-picker">Seletor de Cor</SelectItem>
                              <SelectItem value="file-upload">Upload de Arquivo</SelectItem>
                            </SelectContent>
                          </Select>
                          <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                            <Checkbox
                              checked={q.required}
                              onCheckedChange={(checked) => updateTemplateQuestion(index, { required: !!checked })}
                              data-testid={`checkbox-required-${index}`}
                            />
                            Obrigatório
                          </label>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeTemplateQuestion(index)}
                        data-testid={`button-remove-question-${index}`}
                      >
                        <X className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={resetTemplateDialog}>
                Cancelar
              </Button>
              <Button
                onClick={handleSaveTemplate}
                disabled={!templateName.trim() || templateQuestions.filter(q => q.text.trim()).length === 0 || createTemplateMutation.isPending || updateTemplateMutation.isPending}
                data-testid="button-save-template"
              >
                {editingTemplate ? "Salvar Alterações" : "Criar Template"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewBriefing} onOpenChange={(open) => !open && setViewBriefing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {viewBriefing?.title} — {viewBriefing?.clientName}
            </DialogTitle>
          </DialogHeader>
          <div className="flex justify-end">
            {viewBriefing && (
              <Button variant="outline" size="sm" onClick={() => exportBriefingPdf(viewBriefing, templatesList)} data-testid="button-export-pdf-dialog">
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Exportar PDF
              </Button>
            )}
          </div>
          {viewBriefing && renderAnswers(viewBriefing)}
        </DialogContent>
      </Dialog>
    </div>
  );
}
