import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { useSearch } from "wouter";
import type { Client } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RichTextEditor, RichTextDisplay } from "@/components/rich-text-editor";
import {
  Loader2,
  Lightbulb,
  Trash2,
  Send,
  MessageCircle,
  Filter,
  Sparkles,
  PenLine,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface EnrichedInsight {
  id: number;
  clientId: number;
  userId: number;
  message: string;
  userName: string;
  clientName: string;
  createdAt: string;
}

export default function InsightsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const urlClientId = urlParams.get("clientId");
  const isClient = user?.role === "client";
  const clientAutoId = isClient && user?.clientId ? String(user.clientId) : null;
  const initialClientId = urlClientId || clientAutoId || "all";
  const [selectedClientId, setSelectedClientId] = useState<string>(initialClientId);
  const [message, setMessage] = useState("");
  const [insightToDelete, setInsightToDelete] = useState<number | null>(null);
  const [showComposer, setShowComposer] = useState(false);

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: insights = [], isLoading } = useQuery<EnrichedInsight[]>({
    queryKey: ["/api/insights/all"],
  });

  const activeClients = clients.filter(c => c.isActive !== false);

  const filteredInsights = selectedClientId === "all"
    ? insights
    : insights.filter(i => i.clientId === Number(selectedClientId));

  const createMutation = useMutation({
    mutationFn: (data: { clientId: number; message: string }) =>
      apiRequest("POST", `/api/onboarding/${data.clientId}/insights`, { message: data.message }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/insights/all"] });
      setMessage("");
      setShowComposer(false);
      toast({ title: "Insight publicado com sucesso" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/onboarding/insights/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/insights/all"] });
      toast({ title: "Insight removido" });
      setInsightToDelete(null);
    },
  });

  const canDelete = user?.role === "admin" || user?.role === "designer";
  const postClientId = isClient
    ? (user?.clientId || null)
    : (selectedClientId !== "all" ? Number(selectedClientId) : null);

  const groupedByDate = filteredInsights.reduce<Record<string, EnrichedInsight[]>>((acc, insight) => {
    const dateKey = format(new Date(insight.createdAt), "yyyy-MM-dd");
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(insight);
    return acc;
  }, {});

  const sortedDates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const selectedClientName = postClientId
    ? activeClients.find(c => c.id === postClientId)?.name || ""
    : "";

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div className="rounded-xl overflow-hidden bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-yellow-500/10 dark:from-amber-500/15 dark:via-orange-500/10 dark:to-yellow-500/5 p-6 md:p-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 dark:bg-amber-500/30 flex items-center justify-center shrink-0">
              <Lightbulb className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-insights-title">Insights</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {isClient
                  ? "Compartilhe ideias e observações com a agência"
                  : "Compartilhe ideias e observações com sua equipe"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {!isClient && (
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger className="w-[200px]" data-testid="select-insights-client">
                    <SelectValue placeholder="Filtrar por cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os clientes</SelectItem>
                    {activeClients.map(c => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {postClientId && !showComposer && (
              <Button
                onClick={() => setShowComposer(true)}
                data-testid="button-new-insight"
              >
                <PenLine className="w-4 h-4 mr-2" />
                Novo Insight
              </Button>
            )}
          </div>
        </div>
      </div>

      {showComposer && postClientId && (
        <Card className="p-5 border-amber-500/20" data-testid="section-new-insight">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-semibold">Novo Insight</span>
            {selectedClientName && (
              <Badge variant="secondary" className="text-xs no-default-hover-elevate no-default-active-elevate">
                {selectedClientName}
              </Badge>
            )}
          </div>
          <div className="space-y-3">
            <RichTextEditor
              content={message}
              onChange={setMessage}
              placeholder="Compartilhe uma ideia, observação de mercado, tendência..."
            />
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => { setShowComposer(false); setMessage(""); }}
                data-testid="button-cancel-insight"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => message.trim() && createMutation.mutate({ clientId: postClientId, message: message.trim() })}
                disabled={!message.trim() || createMutation.isPending}
                data-testid="button-send-insight"
              >
                {createMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Publicar
              </Button>
            </div>
          </div>
        </Card>
      )}

      {!postClientId && !isClient && (
        <Card className="p-5 bg-muted/30 border-dashed">
          <div className="flex items-center gap-3 text-muted-foreground">
            <MessageCircle className="w-5 h-5" />
            <p className="text-sm">Selecione um cliente no filtro acima para publicar um novo insight.</p>
          </div>
        </Card>
      )}

      {filteredInsights.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-20 h-20 rounded-3xl bg-amber-500/10 dark:bg-amber-500/15 flex items-center justify-center mb-5">
            <Lightbulb className="w-10 h-10 text-amber-500/40" />
          </div>
          <p className="text-lg font-medium text-muted-foreground" data-testid="text-no-insights">
            Nenhum insight publicado ainda
          </p>
          <p className="text-sm text-muted-foreground/60 mt-2 max-w-sm">
            {isClient
              ? "Compartilhe suas ideias, observações e sugestões com a agência clicando em \"Novo Insight\"."
              : "Selecione um cliente e compartilhe ideias e observações de mercado."}
          </p>
          {postClientId && !showComposer && (
            <Button
              className="mt-6"
              onClick={() => setShowComposer(true)}
              data-testid="button-new-insight-empty"
            >
              <PenLine className="w-4 h-4 mr-2" />
              Criar primeiro insight
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {sortedDates.map(dateKey => (
            <div key={dateKey}>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-2">
                  {format(new Date(dateKey + "T12:00:00"), "dd 'de' MMMM, yyyy", { locale: ptBR })}
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="space-y-3">
                {groupedByDate[dateKey].map(insight => (
                  <Card key={insight.id} className="p-4 group hover-elevate" data-testid={`insight-card-${insight.id}`}>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400/20 to-orange-400/20 dark:from-amber-400/30 dark:to-orange-400/30 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                            {insight.userName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold leading-tight">{insight.userName}</span>
                          <div className="flex items-center gap-1.5">
                            {!isClient && (
                              <Badge variant="outline" className="text-[10px] no-default-hover-elevate no-default-active-elevate">
                                {insight.clientName}
                              </Badge>
                            )}
                            <span className="text-[10px] text-muted-foreground">
                              {format(new Date(insight.createdAt), "HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                        </div>
                      </div>
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive invisible group-hover:visible shrink-0"
                          onClick={() => setInsightToDelete(insight.id)}
                          data-testid={`button-delete-insight-${insight.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                    <div className="pl-10">
                      <RichTextDisplay content={insight.message} />
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={insightToDelete !== null} onOpenChange={(open) => !open && setInsightToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover insight?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O insight será permanentemente removido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => insightToDelete && deleteMutation.mutate(insightToDelete)}
              data-testid="button-confirm-delete-insight"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
