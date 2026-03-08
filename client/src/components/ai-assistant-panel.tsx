import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Client } from "@shared/schema";
import { isInternalRole } from "@shared/schema";
import {
  BarChart3,
  Target,
  Lightbulb,
  Sparkles,
  FileText,
  ClipboardList,
  Timer,
  Bug,
  X,
  Copy,
  Check,
  Loader2,
} from "lucide-react";

type AgentAction = {
  id: string;
  label: string;
  icon: typeof BarChart3;
  endpoint: string;
  requiresClient: boolean;
  adminOnly?: boolean;
  designerOrAdmin?: boolean;
  hasPeriodSelector?: boolean;
};

const AGENT_ACTIONS: AgentAction[] = [
  {
    id: "client-overview",
    label: "Overview do Cliente",
    icon: BarChart3,
    endpoint: "/api/ai/client-overview",
    requiresClient: true,
  },
  {
    id: "analyze-competitors",
    label: "Análise de Concorrentes",
    icon: Target,
    endpoint: "/api/ai/analyze-competitors",
    requiresClient: true,
  },
  {
    id: "suggest-content",
    label: "Ideias de Conteúdo",
    icon: Lightbulb,
    endpoint: "/api/ai/suggest-content",
    requiresClient: true,
  },
  {
    id: "generate-insight",
    label: "Gerar Insight",
    icon: Sparkles,
    endpoint: "/api/ai/generate-insight",
    requiresClient: true,
  },
  {
    id: "weekly-report",
    label: "Relatório Semanal",
    icon: FileText,
    endpoint: "/api/ai/weekly-report",
    requiresClient: true,
  },
  {
    id: "activity-report",
    label: "Relatório de Acontecimentos",
    icon: ClipboardList,
    endpoint: "/api/ai/activity-report",
    requiresClient: true,
    hasPeriodSelector: true,
  },
  {
    id: "analyze-productivity",
    label: "Análise de Produtividade",
    icon: Timer,
    endpoint: "/api/ai/analyze-productivity",
    requiresClient: false,
    designerOrAdmin: true,
  },
  {
    id: "analyze-errors",
    label: "Análise de Erros",
    icon: Bug,
    endpoint: "/api/ai/analyze-errors",
    requiresClient: false,
    adminOnly: true,
  },
];

type AIResponse = {
  actionLabel: string;
  text: string;
  timestamp: Date;
};

function renderMarkdown(text: string) {
  const lines = text.split("\n");
  const elements: JSX.Element[] = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    if (line.startsWith("### ")) {
      elements.push(
        <h3 key={i} className="text-sm font-bold mt-3 mb-1 text-foreground">
          {processInline(line.slice(4))}
        </h3>
      );
    } else if (line.startsWith("## ")) {
      elements.push(
        <h2 key={i} className="text-base font-bold mt-4 mb-1.5 text-foreground">
          {processInline(line.slice(3))}
        </h2>
      );
    } else if (line.startsWith("# ")) {
      elements.push(
        <h1 key={i} className="text-lg font-bold mt-4 mb-2 text-foreground">
          {processInline(line.slice(2))}
        </h1>
      );
    } else if (line.match(/^[-*]\s/)) {
      elements.push(
        <li key={i} className="text-sm text-foreground/80 ml-4 list-disc">
          {processInline(line.slice(2))}
        </li>
      );
    } else if (line.match(/^\d+\.\s/)) {
      const content = line.replace(/^\d+\.\s/, "");
      elements.push(
        <li key={i} className="text-sm text-foreground/80 ml-4 list-decimal">
          {processInline(content)}
        </li>
      );
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="h-2" />);
    } else {
      elements.push(
        <p key={i} className="text-sm text-foreground/80">
          {processInline(line)}
        </p>
      );
    }
  }

  return elements;
}

function processInline(text: string): (string | JSX.Element)[] {
  const parts: (string | JSX.Element)[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <strong key={match.index} className="font-semibold text-foreground">
        {match[1]}
      </strong>
    );
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 py-3" data-testid="loading-indicator">
      <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0ms" }} />
      <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "150ms" }} />
      <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "300ms" }} />
      <span className="text-xs text-muted-foreground ml-2">Analisando...</span>
    </div>
  );
}

function ResponseCard({ response, index }: { response: AIResponse; index: number }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(response.text);
      setCopied(true);
      toast({ title: "Copiado!" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Erro ao copiar", variant: "destructive" });
    }
  }, [response.text, toast]);

  return (
    <div className="border rounded-md p-3 bg-muted/30" data-testid={`ai-response-${index}`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-semibold text-primary">{response.actionLabel}</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">
            {response.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleCopy}
            data-testid={`button-copy-response-${index}`}
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          </Button>
        </div>
      </div>
      <div className="space-y-0.5">{renderMarkdown(response.text)}</div>
    </div>
  );
}

type AIAssistantPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultClientId?: number;
};

export function AIAssistantPanel({ open, onOpenChange, defaultClientId }: AIAssistantPanelProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const role = user?.role || "client";
  const isInternal = isInternalRole(role);
  const isAdmin = role === "admin";
  const isDesignerOrAdmin = role === "admin" || role === "designer";

  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [responses, setResponses] = useState<AIResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingPeriodAction, setPendingPeriodAction] = useState<AgentAction | null>(null);
  const responsesEndRef = useRef<HTMLDivElement>(null);

  const { data: clientsList = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    enabled: isInternal,
  });

  useEffect(() => {
    if (defaultClientId && open) {
      setSelectedClientId(String(defaultClientId));
    }
  }, [defaultClientId, open]);

  useEffect(() => {
    if (!isInternal && user?.clientId) {
      setSelectedClientId(String(user.clientId));
    }
  }, [isInternal, user?.clientId]);

  useEffect(() => {
    if (responsesEndRef.current) {
      responsesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [responses, loading]);

  const executeAction = useCallback(async (action: AgentAction, period?: string) => {
    if (action.requiresClient && !selectedClientId) {
      toast({ title: "Selecione um cliente", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const body: Record<string, unknown> = {};
      if (action.requiresClient || action.id === "analyze-productivity") {
        body.clientId = parseInt(selectedClientId);
      }
      if (period) {
        body.period = period;
      }

      const res = await apiRequest("POST", action.endpoint, body);
      const data = await res.json();
      const text = data.result || data.message || JSON.stringify(data);

      setResponses((prev) => [
        ...prev,
        {
          actionLabel: action.label,
          text,
          timestamp: new Date(),
        },
      ]);

      if (action.id === "generate-insight") {
        queryClient.invalidateQueries({ queryKey: ["/api/insights/all"] });
        queryClient.invalidateQueries({ queryKey: ["/api/insights/overview"] });
        queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
        queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
        toast({ title: "Insight gerado e salvo!" });
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message.includes("API key") || err.message.includes("OpenAI")
            ? "Chave da OpenAI não configurada"
            : `Erro: ${err.message}`
          : "Erro ao processar solicitação";
      setResponses((prev) => [
        ...prev,
        {
          actionLabel: action.label,
          text: message,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [selectedClientId, toast]);

  const handleActionClick = useCallback((action: AgentAction) => {
    if (action.hasPeriodSelector) {
      setPendingPeriodAction(action);
      return;
    }
    executeAction(action);
  }, [executeAction]);

  const handlePeriodSelect = useCallback((period: string) => {
    if (pendingPeriodAction) {
      executeAction(pendingPeriodAction, period);
      setPendingPeriodAction(null);
    }
  }, [pendingPeriodAction, executeAction]);

  const visibleActions = AGENT_ACTIONS.filter((action) => {
    if (action.adminOnly && !isAdmin) return false;
    if (action.designerOrAdmin && !isDesignerOrAdmin) return false;
    if (!isInternal && (action.adminOnly || action.designerOrAdmin)) return false;
    return true;
  });

  const activeClients = clientsList.filter((c) => c.isActive !== false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[450px] p-0 flex flex-col"
        data-testid="ai-assistant-panel"
      >
        <SheetHeader className="px-4 pt-4 pb-3 border-b shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <SheetTitle className="text-base">Assistente IA</SheetTitle>
            </div>
          </div>
          <SheetDescription className="text-xs">
            Análises e relatórios inteligentes para seus clientes
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 py-3 border-b shrink-0">
          {isInternal ? (
            <Select
              value={selectedClientId}
              onValueChange={setSelectedClientId}
            >
              <SelectTrigger data-testid="select-ai-client">
                <SelectValue placeholder="Selecione um cliente" />
              </SelectTrigger>
              <SelectContent>
                {activeClients.map((client) => (
                  <SelectItem key={client.id} value={String(client.id)} data-testid={`select-ai-client-${client.id}`}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="text-sm text-muted-foreground" data-testid="text-ai-client-auto">
              Cliente selecionado automaticamente
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {pendingPeriodAction ? (
            <div className="space-y-2" data-testid="period-selector">
              <p className="text-sm font-medium text-foreground">
                Selecione o período para o relatório:
              </p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: "7d", label: "7 dias" },
                  { value: "15d", label: "15 dias" },
                  { value: "30d", label: "30 dias" },
                ].map((p) => (
                  <Button
                    key={p.value}
                    variant="outline"
                    onClick={() => handlePeriodSelect(p.value)}
                    disabled={loading}
                    data-testid={`button-period-${p.value}`}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPendingPeriodAction(null)}
                className="text-xs text-muted-foreground"
                data-testid="button-cancel-period"
              >
                Cancelar
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2" data-testid="ai-actions-grid">
              {visibleActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Card
                    key={action.id}
                    className="hover-elevate cursor-pointer overflow-visible"
                    onClick={() => !loading && handleActionClick(action)}
                    data-testid={`button-ai-${action.id}`}
                  >
                    <div className="p-3 flex flex-col items-center gap-2 text-center">
                      <Icon className="w-5 h-5 text-primary" />
                      <span className="text-xs font-medium leading-tight text-foreground">
                        {action.label}
                      </span>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {responses.length > 0 && (
            <div className="space-y-3 pt-2 border-t" data-testid="ai-responses-area">
              {responses.map((response, index) => (
                <ResponseCard key={index} response={response} index={index} />
              ))}
            </div>
          )}

          {loading && <TypingIndicator />}

          <div ref={responsesEndRef} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
