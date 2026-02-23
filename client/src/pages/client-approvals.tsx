import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import type { KanbanCard } from "@shared/schema";
import { CARD_TYPE_LABELS, CARD_TYPE_COLORS, CARD_TYPES, type CardType } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  FileIcon,
  Paperclip,
  Loader2,
  Undo2,
  Eye,
  Download,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type ApprovalFilter = "all" | "Pendente" | "Aprovado" | "Reprovado" | "Revisão";

export default function ClientApprovals() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedCard, setSelectedCard] = useState<KanbanCard | null>(null);
  const [approvalNotes, setApprovalNotes] = useState("");
  const [filterStatus, setFilterStatus] = useState<ApprovalFilter>("all");
  const [filterType, setFilterType] = useState<CardType | "all">("all");

  const { data: cards = [], isLoading } = useQuery<KanbanCard[]>({
    queryKey: ["/api/client/approval-cards"],
  });

  useEffect(() => {
    if (selectedCard) {
      apiRequest("PUT", `/api/notifications/read-by-card/${selectedCard.id}`).then(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
        queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
      }).catch(() => {});
    }
  }, [selectedCard]);

  const approveMutation = useMutation({
    mutationFn: async ({ cardId, notes }: { cardId: number; notes?: string }) => {
      await apiRequest("POST", `/api/kanban/cards/${cardId}/approve`, { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client/approval-cards"] });
      setApprovalNotes("");
      setSelectedCard(null);
      toast({ title: "Material aprovado" });
    },
    onError: () => {
      toast({ title: "Erro ao aprovar", variant: "destructive" });
    },
  });

  const revisionMutation = useMutation({
    mutationFn: async ({ cardId, notes }: { cardId: number; notes?: string }) => {
      await apiRequest("POST", `/api/kanban/cards/${cardId}/revision`, { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client/approval-cards"] });
      setApprovalNotes("");
      setSelectedCard(null);
      toast({ title: "Revisão solicitada" });
    },
    onError: () => {
      toast({ title: "Erro ao solicitar revisão", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ cardId, notes }: { cardId: number; notes?: string }) => {
      await apiRequest("POST", `/api/kanban/cards/${cardId}/reject`, { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client/approval-cards"] });
      setApprovalNotes("");
      setSelectedCard(null);
      toast({ title: "Material reprovado" });
    },
    onError: () => {
      toast({ title: "Erro ao reprovar", variant: "destructive" });
    },
  });

  const undoMutation = useMutation({
    mutationFn: async (cardId: number) => {
      await apiRequest("POST", `/api/kanban/cards/${cardId}/undo-approval`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client/approval-cards"] });
      setSelectedCard(null);
      toast({ title: "Decisão desfeita" });
    },
    onError: () => {
      toast({ title: "Erro ao desfazer", variant: "destructive" });
    },
  });

  const filteredCards = useMemo(() => {
    return cards.filter(c => {
      if (filterStatus !== "all" && c.approvalStatus !== filterStatus) return false;
      if (filterType !== "all" && c.cardType !== filterType) return false;
      return true;
    });
  }, [cards, filterStatus, filterType]);

  const groupedByType = useMemo(() => {
    const groups: Record<string, KanbanCard[]> = {};
    for (const card of filteredCards) {
      const type = card.cardType || "geral";
      if (!groups[type]) groups[type] = [];
      groups[type].push(card);
    }
    return groups;
  }, [filteredCards]);

  const statusCounts = useMemo(() => {
    const counts = { all: cards.length, Pendente: 0, Aprovado: 0, Reprovado: 0, "Revisão": 0 };
    for (const c of cards) {
      if (c.approvalStatus && c.approvalStatus in counts) {
        counts[c.approvalStatus as keyof typeof counts]++;
      }
    }
    return counts;
  }, [cards]);

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "Pendente":
        return (
          <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate border-yellow-500 text-yellow-600">
            <Clock className="w-3 h-3 mr-1" /> Pendente
          </Badge>
        );
      case "Aprovado":
        return (
          <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate border-green-500 text-green-600">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Aprovado
          </Badge>
        );
      case "Reprovado":
        return (
          <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate border-red-500 text-red-600">
            <XCircle className="w-3 h-3 mr-1" /> Reprovado
          </Badge>
        );
      case "Revisão":
        return (
          <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate border-orange-500 text-orange-600">
            <ArrowRight className="w-3 h-3 mr-1" /> Em revisão
          </Badge>
        );
      default:
        return null;
    }
  };

  const getAttachments = (card: KanbanCard) => {
    if (!card.attachments) return [];
    try {
      return JSON.parse(card.attachments) as Array<{
        id: string;
        name: string;
        url: string;
        contentType: string;
        size: number;
        driveFileId?: string;
        driveUrl?: string;
        driveDownloadUrl?: string;
        thumbnailUrl?: string | null;
      }>;
    } catch {
      return [];
    }
  };

  const getTemplateData = (card: KanbanCard) => {
    if (!card.templateData) return {};
    try {
      return JSON.parse(card.templateData) as Record<string, string>;
    } catch {
      return {};
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const activeTypes = CARD_TYPES.filter(t => cards.some(c => c.cardType === t));

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold" data-testid="text-page-title">
          Aprovações
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Revise e aprove os materiais desenvolvidos pela agência
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={filterStatus === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilterStatus("all")}
          data-testid="filter-status-all"
        >
          Todos ({statusCounts.all})
        </Button>
        <Button
          variant={filterStatus === "Pendente" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilterStatus("Pendente")}
          data-testid="filter-status-pendente"
        >
          <Clock className="w-3.5 h-3.5 mr-1" />
          Pendentes ({statusCounts.Pendente})
        </Button>
        <Button
          variant={filterStatus === "Aprovado" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilterStatus("Aprovado")}
          data-testid="filter-status-aprovado"
        >
          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
          Aprovados ({statusCounts.Aprovado})
        </Button>
        <Button
          variant={filterStatus === "Revisão" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilterStatus("Revisão")}
          data-testid="filter-status-revisao"
        >
          <ArrowRight className="w-3.5 h-3.5 mr-1" />
          Em revisão ({statusCounts["Revisão"]})
        </Button>
        <Button
          variant={filterStatus === "Reprovado" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilterStatus("Reprovado")}
          data-testid="filter-status-reprovado"
        >
          <XCircle className="w-3.5 h-3.5 mr-1" />
          Reprovados ({statusCounts.Reprovado})
        </Button>
      </div>

      {activeTypes.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant={filterType === "all" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setFilterType("all")}
            data-testid="filter-type-all"
          >
            Todos os tipos
          </Button>
          {activeTypes.map(t => (
            <Button
              key={t}
              variant={filterType === t ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setFilterType(t)}
              data-testid={`filter-type-${t}`}
            >
              {CARD_TYPE_LABELS[t]}
            </Button>
          ))}
        </div>
      )}

      {Object.keys(groupedByType).length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground" data-testid="text-no-materials">
            Nenhum material para aprovação no momento
          </p>
        </Card>
      )}

      {CARD_TYPES.filter(t => groupedByType[t]).map(type => (
        <div key={type} className="space-y-3">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${CARD_TYPE_COLORS[type]}`} />
            <h2 className="font-semibold text-lg" data-testid={`text-type-header-${type}`}>
              {CARD_TYPE_LABELS[type]}
            </h2>
            <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate text-xs">
              {groupedByType[type].length}
            </Badge>
          </div>

          <div className="grid gap-3">
            {groupedByType[type].map(card => {
              const attachments = getAttachments(card);
              const imageAttachments = attachments.filter(a => a.contentType?.startsWith("image/"));

              return (
                <Card
                  key={card.id}
                  className="hover-elevate cursor-pointer"
                  onClick={() => {
                    setSelectedCard(card);
                    setApprovalNotes("");
                  }}
                  data-testid={`card-approval-${card.id}`}
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-medium truncate" data-testid={`text-card-title-${card.id}`}>
                            {card.title}
                          </h3>
                          {getStatusBadge(card.approvalStatus)}
                        </div>
                        {card.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                            {card.description}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                          {card.dueDate && (
                            <span>
                              Prazo: {format(new Date(card.dueDate), "dd/MM/yyyy", { locale: ptBR })}
                            </span>
                          )}
                          {attachments.length > 0 && (
                            <span className="flex items-center gap-1">
                              <Paperclip className="w-3 h-3" />
                              {attachments.length} anexo{attachments.length > 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                        {card.approvalNotes && (
                          <p className="text-sm text-muted-foreground mt-2 italic border-l-2 border-muted pl-2">
                            {card.approvalNotes}
                          </p>
                        )}
                      </div>
                      {imageAttachments.length > 0 && (
                        <div className="w-20 h-20 rounded-md overflow-hidden shrink-0 bg-muted">
                          <img
                            src={imageAttachments[0].thumbnailUrl || (imageAttachments[0].driveFileId ? `/api/drive-proxy/${imageAttachments[0].driveFileId}` : imageAttachments[0].url)}
                            alt={imageAttachments[0].name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ))}

      <Dialog open={!!selectedCard} onOpenChange={(open) => { if (!open) { setSelectedCard(null); setApprovalNotes(""); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
          {selectedCard && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={`${CARD_TYPE_COLORS[selectedCard.cardType as CardType] || "bg-gray-500"} text-white no-default-hover-elevate no-default-active-elevate`}>
                    {CARD_TYPE_LABELS[selectedCard.cardType as CardType] || "Geral"}
                  </Badge>
                  {getStatusBadge(selectedCard.approvalStatus)}
                </div>
                <DialogTitle className="text-xl" data-testid="text-modal-title">
                  {selectedCard.title}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 mt-2">
                {selectedCard.description && (
                  <div>
                    <h4 className="text-sm font-medium mb-1 text-muted-foreground">Descrição</h4>
                    <p className="text-sm whitespace-pre-wrap" data-testid="text-card-description">
                      {selectedCard.description}
                    </p>
                  </div>
                )}

                {selectedCard.templateData && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 text-muted-foreground">Detalhes</h4>
                    <div className="space-y-1">
                      {Object.entries(getTemplateData(selectedCard)).map(([key, value]) => (
                        value && (
                          <div key={key} className="flex gap-2 text-sm">
                            <span className="font-medium capitalize">{key.replace(/_/g, " ")}:</span>
                            <span className="text-muted-foreground">{value}</span>
                          </div>
                        )
                      ))}
                    </div>
                  </div>
                )}

                {getAttachments(selectedCard).length > 0 && (() => {
                  const atts = getAttachments(selectedCard);
                  const imageAtts = atts.filter(a => a.contentType?.startsWith("image/"));
                  const fileAtts = atts.filter(a => !a.contentType?.startsWith("image/"));
                  return (
                    <div>
                      {imageAtts.length > 0 && (
                        <div className="mb-4">
                          <h4 className="text-sm font-medium mb-2 text-muted-foreground flex items-center gap-2">
                            <Eye className="w-4 h-4" />
                            Prévia dos materiais ({imageAtts.length} {imageAtts.length === 1 ? "imagem" : "imagens"})
                          </h4>
                          <div className="space-y-3">
                            {imageAtts.map((att) => {
                              const proxyUrl = att.driveFileId ? `/api/drive-proxy/${att.driveFileId}` : att.thumbnailUrl || att.url;
                              const driveViewUrl = att.driveUrl || att.url;
                              const dlUrl = att.driveDownloadUrl || att.url;
                              return (
                                <div key={att.id} className="rounded-lg overflow-hidden border bg-muted/30" data-testid={`preview-image-${att.id}`}>
                                  <div className="w-full flex items-center justify-center bg-black/5 min-h-[200px] max-h-[500px]">
                                    <img
                                      src={proxyUrl}
                                      alt={att.name}
                                      className="max-w-full max-h-[500px] object-contain"
                                      loading="lazy"
                                    />
                                  </div>
                                  <div className="flex items-center gap-2 px-3 py-2 bg-background/80">
                                    <span className="text-xs text-muted-foreground flex-1 truncate">{att.name}</span>
                                    <a href={driveViewUrl} target="_blank" rel="noopener noreferrer" title="Ver no Drive">
                                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                                        <Eye className="w-3.5 h-3.5" /> Drive
                                      </Button>
                                    </a>
                                    <a href={dlUrl} target="_blank" rel="noopener noreferrer" title="Baixar em alta resolução">
                                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                                        <Download className="w-3.5 h-3.5" /> Baixar
                                      </Button>
                                    </a>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {fileAtts.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-2 text-muted-foreground">Outros anexos</h4>
                          <div className="space-y-1">
                            {fileAtts.map((att, idx) => {
                              const dlUrl = att.driveDownloadUrl || att.url;
                              return (
                                <a
                                  key={att.id || idx}
                                  href={dlUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 p-2 rounded-md border hover-elevate"
                                  data-testid={`link-attachment-${idx}`}
                                >
                                  <FileIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                                  <span className="text-sm truncate">{att.name}</span>
                                  <Download className="w-3.5 h-3.5 ml-auto text-muted-foreground shrink-0" />
                                </a>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {selectedCard.approvalNotes && (
                  <div className="rounded-md border p-3 bg-muted/30">
                    <h4 className="text-sm font-medium mb-1">Observações anteriores</h4>
                    <p className="text-sm text-muted-foreground" data-testid="text-previous-notes">
                      {selectedCard.approvalNotes}
                    </p>
                  </div>
                )}

                {selectedCard.approvalStatus === "Pendente" && (
                  <div className="space-y-3 pt-2 border-t">
                    <Textarea
                      value={approvalNotes}
                      onChange={(e) => setApprovalNotes(e.target.value)}
                      placeholder="Adicione observações (opcional)..."
                      className="resize-none text-sm"
                      rows={3}
                      data-testid="textarea-approval-notes"
                    />
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        size="sm"
                        onClick={() => approveMutation.mutate({ cardId: selectedCard.id, notes: approvalNotes || undefined })}
                        disabled={approveMutation.isPending}
                        data-testid="button-approve"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        Aprovar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => revisionMutation.mutate({ cardId: selectedCard.id, notes: approvalNotes || undefined })}
                        disabled={revisionMutation.isPending}
                        data-testid="button-revision"
                      >
                        <ArrowRight className="w-4 h-4 mr-1" />
                        Revisar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive"
                        onClick={() => rejectMutation.mutate({ cardId: selectedCard.id, notes: approvalNotes || undefined })}
                        disabled={rejectMutation.isPending}
                        data-testid="button-reject"
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Reprovar
                      </Button>
                    </div>
                  </div>
                )}

                {selectedCard.approvalStatus && selectedCard.approvalStatus !== "Pendente" && (
                  <div className="pt-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => undoMutation.mutate(selectedCard.id)}
                      disabled={undoMutation.isPending}
                      data-testid="button-undo"
                    >
                      <Undo2 className="w-4 h-4 mr-1" />
                      Desfazer decisão
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}