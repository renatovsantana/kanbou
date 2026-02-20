import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import type { KanbanCard, KanbanComment, KanbanActivity, KanbanTimeEntry } from "@shared/schema";
import type { User } from "@shared/schema";
import { CARD_TYPE_LABELS, CARD_TYPE_COLORS, CARD_TYPE_FIELDS, type CardType } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RichTextEditor } from "@/components/rich-text-editor";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle as AlertTitle,
} from "@/components/ui/alert-dialog";
import {
  X,
  Users,
  Tag,
  CalendarDays,
  Image,
  Trash2,
  Plus,
  Activity,
  Clock,
  MessageSquare,
  CheckSquare,
  ArrowRight,
  Link2,
  Paperclip,
  FileIcon,
  Download,
  Upload,
  Loader2,
  Send,
  CheckCircle2,
  XCircle,
  Save,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface KanbanCardModalProps {
  cardId: number | null;
  clientId: number;
  open: boolean;
  onClose: () => void;
}

interface ChecklistItem {
  text: string;
  checked: boolean;
}

interface Attachment {
  id: string;
  name: string;
  url: string;
  contentType: string;
  size: number;
  driveFileId?: string;
  driveUrl?: string;
  driveDownloadUrl?: string;
  extensionFolder?: string;
  thumbnailUrl?: string | null;
  createdAt: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const LABEL_COLORS: Record<string, string> = {
  red: "bg-red-500",
  blue: "bg-blue-500",
  green: "bg-green-500",
  yellow: "bg-yellow-500",
  purple: "bg-purple-500",
  orange: "bg-orange-500",
  pink: "bg-pink-500",
  cyan: "bg-cyan-500",
};

function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m ${seconds}s`;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function KanbanCardModal({ cardId, clientId, open, onClose }: KanbanCardModalProps) {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [descriptionValue, setDescriptionValue] = useState("");
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [newComment, setNewComment] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [showCoverInput, setShowCoverInput] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showApprovalConfirm, setShowApprovalConfirm] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isCoverUploading, setIsCoverUploading] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverFileInputRef = useRef<HTMLInputElement>(null);

  const { data: card } = useQuery<KanbanCard>({
    queryKey: ["/api/kanban/cards", cardId],
    enabled: !!cardId && open,
  });

  const { data: comments = [] } = useQuery<KanbanComment[]>({
    queryKey: ["/api/kanban/cards", cardId, "comments"],
    enabled: !!cardId && open,
  });

  const { data: activity = [] } = useQuery<KanbanActivity[]>({
    queryKey: ["/api/kanban/cards", cardId, "activity"],
    enabled: !!cardId && open,
  });

  const { data: timeEntries = [] } = useQuery<KanbanTimeEntry[]>({
    queryKey: ["/api/kanban/cards", cardId, "time-entries"],
    enabled: !!cardId && open,
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: open,
  });

  useEffect(() => {
    if (card) {
      setTitleValue(card.title);
      setDescriptionValue(card.description || "");
      setCoverUrl(card.coverUrl || "");
    }
  }, [card]);

  useEffect(() => {
    if (editingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [editingTitle]);

  const updateCardMutation = useMutation({
    mutationFn: async (data: Partial<KanbanCard>) => {
      await apiRequest("PUT", `/api/kanban/cards/${cardId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kanban/cards", cardId] });
      queryClient.invalidateQueries({ queryKey: ["/api/kanban", clientId, "cards"] });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar cartao", variant: "destructive" });
    },
  });

  const deleteCardMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/kanban/cards/${cardId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kanban", clientId, "cards"] });
      setShowDeleteDialog(false);
      onClose();
    },
    onError: () => {
      toast({ title: "Erro ao excluir cartao", variant: "destructive" });
    },
  });

  const sendApprovalMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/kanban/cards/${cardId}/send-approval`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kanban/cards", cardId] });
      queryClient.invalidateQueries({ queryKey: ["/api/kanban", clientId, "cards"] });
      toast({ title: "Enviado para aprovação do cliente" });
    },
    onError: () => {
      toast({ title: "Erro ao enviar para aprovação", variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (notes?: string) => {
      await apiRequest("POST", `/api/kanban/cards/${cardId}/approve`, { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kanban/cards", cardId] });
      queryClient.invalidateQueries({ queryKey: ["/api/kanban", clientId, "cards"] });
      setApprovalNotes("");
      toast({ title: "Material aprovado!" });
    },
    onError: () => {
      toast({ title: "Erro ao aprovar", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (notes?: string) => {
      await apiRequest("POST", `/api/kanban/cards/${cardId}/reject`, { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kanban/cards", cardId] });
      queryClient.invalidateQueries({ queryKey: ["/api/kanban", clientId, "cards"] });
      setApprovalNotes("");
      toast({ title: "Material reprovado" });
    },
    onError: () => {
      toast({ title: "Erro ao reprovar", variant: "destructive" });
    },
  });

  const revisionMutation = useMutation({
    mutationFn: async (notes?: string) => {
      await apiRequest("POST", `/api/kanban/cards/${cardId}/revision`, { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kanban/cards", cardId] });
      queryClient.invalidateQueries({ queryKey: ["/api/kanban", clientId, "cards"] });
      setApprovalNotes("");
      toast({ title: "Revisão solicitada" });
    },
    onError: () => {
      toast({ title: "Erro ao solicitar revisão", variant: "destructive" });
    },
  });

  const undoApprovalMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/kanban/cards/${cardId}/undo-approval`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kanban/cards", cardId] });
      queryClient.invalidateQueries({ queryKey: ["/api/kanban", clientId, "cards"] });
      toast({ title: "Decisão desfeita, cartão voltou para aprovação" });
    },
    onError: () => {
      toast({ title: "Erro ao desfazer decisão", variant: "destructive" });
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      await apiRequest("POST", `/api/kanban/cards/${cardId}/comments`, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kanban/cards", cardId, "comments"] });
      setNewComment("");
    },
    onError: () => {
      toast({ title: "Erro ao adicionar comentario", variant: "destructive" });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: number) => {
      await apiRequest("DELETE", `/api/kanban/comments/${commentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kanban/cards", cardId, "comments"] });
    },
    onError: () => {
      toast({ title: "Erro ao excluir comentario", variant: "destructive" });
    },
  });

  const deleteAttachmentMutation = useMutation({
    mutationFn: async (attachmentId: string) => {
      await apiRequest("DELETE", `/api/kanban/cards/${cardId}/attachments/${attachmentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kanban/cards", cardId] });
      queryClient.invalidateQueries({ queryKey: ["/api/kanban", clientId, "cards"] });
    },
    onError: () => {
      toast({ title: "Erro ao remover anexo", variant: "destructive" });
    },
  });

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/kanban/cards/${cardId}/attachments`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Upload falhou");
      }

      queryClient.invalidateQueries({ queryKey: ["/api/kanban/cards", cardId] });
      queryClient.invalidateQueries({ queryKey: ["/api/kanban", clientId, "cards"] });
      toast({ title: "Arquivo enviado ao Google Drive" });
    } catch (e: any) {
      toast({
        title: e?.message || "Erro ao enviar arquivo",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const attachments: Attachment[] = (() => {
    if (!card?.attachments) return [];
    try {
      const parsed = JSON.parse(card.attachments);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  const imageAttachments = attachments.filter((a) => a.contentType.startsWith("image/"));
  const fileAttachments = attachments.filter((a) => !a.contentType.startsWith("image/"));

  const checklist: ChecklistItem[] = (() => {
    if (!card?.checklist) return [];
    try {
      return JSON.parse(card.checklist);
    } catch {
      return [];
    }
  })();

  const checklistProgress =
    checklist.length > 0
      ? Math.round((checklist.filter((i) => i.checked).length / checklist.length) * 100)
      : 0;

  const handleTitleSave = () => {
    const trimmed = titleValue.trim();
    if (trimmed && trimmed !== card?.title) {
      updateCardMutation.mutate({ title: trimmed });
    } else {
      setTitleValue(card?.title || "");
    }
    setEditingTitle(false);
  };

  const handleDescriptionSave = () => {
    if (descriptionValue !== (card?.description || "")) {
      updateCardMutation.mutate({ description: descriptionValue });
    }
  };

  const handleChecklistToggle = (index: number) => {
    const updated = checklist.map((item, i) =>
      i === index ? { ...item, checked: !item.checked } : item
    );
    updateCardMutation.mutate({ checklist: JSON.stringify(updated) });
  };

  const handleChecklistAdd = () => {
    const trimmed = newChecklistItem.trim();
    if (!trimmed) return;
    const updated = [...checklist, { text: trimmed, checked: false }];
    updateCardMutation.mutate({ checklist: JSON.stringify(updated) });
    setNewChecklistItem("");
  };

  const handleChecklistRemove = (index: number) => {
    const updated = checklist.filter((_, i) => i !== index);
    updateCardMutation.mutate({ checklist: JSON.stringify(updated) });
  };

  const handleLabelToggle = (color: string) => {
    const current = card?.labels || [];
    const updated = current.includes(color)
      ? current.filter((l) => l !== color)
      : [...current, color];
    updateCardMutation.mutate({ labels: updated });
  };

  const handleMemberToggle = (userId: number) => {
    const current = card?.assignedUserIds || [];
    const updated = current.includes(userId)
      ? current.filter((id) => id !== userId)
      : [...current, userId];
    updateCardMutation.mutate({ assignedUserIds: updated });
  };

  const handleDueDateChange = (value: string) => {
    updateCardMutation.mutate({ dueDate: value ? new Date(value) : null });
  };

  const handleCoverSave = () => {
    updateCardMutation.mutate({ coverUrl: coverUrl || null });
    setShowCoverInput(false);
  };

  const handleCoverUpload = async (file: File) => {
    setIsCoverUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/kanban/cards/${cardId}/cover-upload`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Upload falhou");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/kanban/cards", cardId] });
      queryClient.invalidateQueries({ queryKey: ["/api/kanban", clientId, "cards"] });
      setShowCoverInput(false);
      toast({ title: "Capa enviada com sucesso" });
    } catch (e: any) {
      toast({ title: e?.message || "Erro ao enviar capa", variant: "destructive" });
    } finally {
      setIsCoverUploading(false);
      if (coverFileInputRef.current) coverFileInputRef.current.value = "";
    }
  };

  const getUserName = (userId: number | null): string => {
    if (!userId) return "Sistema";
    const user = users.find((u) => u.id === userId);
    return user?.name || `Usuario ${userId}`;
  };

  if (!cardId) return null;

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileUpload(file);
        }}
        data-testid="input-file-upload"
      />
      <input
        type="file"
        ref={coverFileInputRef}
        className="hidden"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleCoverUpload(file);
        }}
        data-testid="input-cover-file-upload"
      />
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent
          className="max-w-[800px] max-h-[80vh] overflow-y-auto p-0"
          data-testid="modal-card-detail"
          aria-describedby={undefined}
        >
          {card?.coverUrl && (
            <div className="w-full h-32 overflow-hidden rounded-t-md">
              <img
                src={card.coverUrl}
                alt={card.title}
                className="w-full h-full object-cover"
                data-testid="img-card-cover"
              />
            </div>
          )}

          <div className="p-6">
            <DialogHeader className="mb-4">
              <div className="flex items-start justify-between gap-2">
                {editingTitle ? (
                  <Input
                    ref={titleInputRef}
                    value={titleValue}
                    onChange={(e) => setTitleValue(e.target.value)}
                    onBlur={handleTitleSave}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleTitleSave();
                      if (e.key === "Escape") {
                        setTitleValue(card?.title || "");
                        setEditingTitle(false);
                      }
                    }}
                    className="text-lg font-semibold"
                    data-testid="input-card-title"
                  />
                ) : (
                  <DialogTitle
                    className="text-lg font-semibold cursor-pointer flex-1"
                    onClick={() => setEditingTitle(true)}
                    data-testid="text-card-title"
                  >
                    {card?.title || "Carregando..."}
                  </DialogTitle>
                )}
              </div>
            </DialogHeader>

            {card?.approvalPostId && (
              <div className="flex items-center gap-1.5 mb-3 text-xs text-muted-foreground" data-testid="text-approval-link">
                <Link2 className="w-3.5 h-3.5 text-primary" />
                <span>Vinculado ao post de aprovação #{card.approvalPostId}</span>
              </div>
            )}

            {card?.labels && card.labels.length > 0 && (
              <div className="flex gap-1.5 flex-wrap mb-4">
                {card.labels.map((label) => (
                  <span
                    key={label}
                    className={`inline-block w-10 h-3 rounded-sm ${LABEL_COLORS[label] || "bg-muted-foreground/40"}`}
                    data-testid={`label-badge-${label}`}
                  />
                ))}
              </div>
            )}

            {card?.assignedUserIds && card.assignedUserIds.length > 0 && (
              <div className="flex items-center gap-1.5 mb-4">
                <span className="text-xs text-muted-foreground mr-1">Membros:</span>
                {card.assignedUserIds.map((uid) => (
                  <Avatar key={uid} className="w-7 h-7" data-testid={`avatar-member-${uid}`}>
                    <AvatarFallback className="text-[10px]">
                      {getInitials(getUserName(uid))}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
            )}

            <div className="flex gap-6">
              <div className="flex-1 min-w-0 space-y-6">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h3 className="text-sm font-semibold" data-testid="text-section-description">
                      Descrição
                    </h3>
                    {descriptionValue !== (card?.description || "") && (
                      <Button size="sm" variant="default" onClick={handleDescriptionSave} data-testid="button-save-description">
                        <Save className="w-3.5 h-3.5 mr-1" /> Salvar
                      </Button>
                    )}
                  </div>
                  <RichTextEditor
                    content={descriptionValue}
                    onChange={(html) => {
                      setDescriptionValue(html);
                    }}
                    placeholder="Adicionar uma descrição..."
                    minimal
                  />
                </div>

                {card?.cardType && card.cardType !== "geral" && (
                  <div data-testid="section-card-template">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate" data-testid="badge-modal-card-type">
                        <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${CARD_TYPE_COLORS[card.cardType as CardType] || "bg-gray-500"}`} />
                        {CARD_TYPE_LABELS[card.cardType as CardType] || card.cardType}
                      </Badge>
                    </div>
                    {(() => {
                      const fields = CARD_TYPE_FIELDS[card.cardType as CardType] || [];
                      let templateObj: Record<string, any> = {};
                      try {
                        if (card.templateData) templateObj = JSON.parse(card.templateData);
                      } catch {}
                      const filledFields = fields.filter(f => {
                        const val = templateObj[f.key];
                        if (Array.isArray(val)) return val.length > 0;
                        return !!val;
                      });
                      if (filledFields.length === 0) return null;
                      return (
                        <div className="space-y-2 mt-2">
                          {filledFields.map((field) => {
                            const val = templateObj[field.key];
                            return (
                              <div key={field.key} data-testid={`template-field-${field.key}`}>
                                <span className="text-xs text-muted-foreground font-medium">{field.label}</span>
                                <p className="text-sm mt-0.5">
                                  {Array.isArray(val) ? val.join(", ") : String(val)}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {card?.approvalStatus && (
                  <div className="rounded-md border p-3" data-testid="section-approval-status">
                    <div className="flex items-center gap-2 mb-2">
                      {card.approvalStatus === "Pendente" && (
                        <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate border-yellow-500 text-yellow-600" data-testid="badge-approval-status">
                          <Clock className="w-3 h-3 mr-1" /> Aguardando aprovação
                        </Badge>
                      )}
                      {card.approvalStatus === "Aprovado" && (
                        <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate border-green-500 text-green-600" data-testid="badge-approval-status">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Aprovado
                        </Badge>
                      )}
                      {card.approvalStatus === "Reprovado" && (
                        <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate border-red-500 text-red-600" data-testid="badge-approval-status">
                          <XCircle className="w-3 h-3 mr-1" /> Reprovado
                        </Badge>
                      )}
                      {card.approvalStatus === "Revisão" && (
                        <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate border-orange-500 text-orange-600" data-testid="badge-approval-status">
                          <ArrowRight className="w-3 h-3 mr-1" /> Em revisão
                        </Badge>
                      )}
                    </div>
                    {card.approvalNotes && (
                      <p className="text-sm text-muted-foreground mt-1" data-testid="text-approval-notes">
                        {card.approvalNotes}
                      </p>
                    )}
                    {card.approvalStatus === "Pendente" && (currentUser?.role === "client" || currentUser?.role === "admin") && (
                      <div className="mt-3 space-y-2">
                        <Textarea
                          value={approvalNotes}
                          onChange={(e) => setApprovalNotes(e.target.value)}
                          placeholder="Observações (opcional)..."
                          className="text-sm resize-none"
                          rows={2}
                          data-testid="textarea-approval-notes"
                        />
                        <div className="flex gap-2 flex-wrap">
                          <Button
                            size="sm"
                            onClick={() => approveMutation.mutate(approvalNotes || undefined)}
                            disabled={approveMutation.isPending}
                            data-testid="button-approve-card"
                          >
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            Aprovar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => revisionMutation.mutate(approvalNotes || undefined)}
                            disabled={revisionMutation.isPending}
                            data-testid="button-revision-card"
                          >
                            <ArrowRight className="w-4 h-4 mr-1" />
                            Revisar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive"
                            onClick={() => rejectMutation.mutate(approvalNotes || undefined)}
                            disabled={rejectMutation.isPending}
                            data-testid="button-reject-card"
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Reprovar
                          </Button>
                        </div>
                      </div>
                    )}
                    {card.approvalStatus && card.approvalStatus !== "Pendente" && (currentUser?.role === "client" || currentUser?.role === "admin") && (
                      <div className="mt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => undoApprovalMutation.mutate()}
                          disabled={undoApprovalMutation.isPending}
                          data-testid="button-undo-approval"
                        >
                          Desfazer decisão
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <CheckSquare className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold" data-testid="text-section-checklist">
                      Checklist
                    </h3>
                  </div>
                  {checklist.length > 0 && (
                    <div className="mb-2">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-muted-foreground">{checklistProgress}%</span>
                        <Progress value={checklistProgress} className="flex-1 h-1.5" data-testid="progress-checklist" />
                      </div>
                      <div className="space-y-1">
                        {checklist.map((item, i) => (
                          <div key={i} className="flex items-center gap-2 group">
                            <Checkbox
                              checked={item.checked}
                              onCheckedChange={() => handleChecklistToggle(i)}
                              data-testid={`checkbox-checklist-${i}`}
                            />
                            <span
                              className={`text-sm flex-1 ${item.checked ? "line-through text-muted-foreground" : ""}`}
                              data-testid={`text-checklist-${i}`}
                            >
                              {item.text}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="invisible group-hover:visible"
                              onClick={() => handleChecklistRemove(i)}
                              data-testid={`button-remove-checklist-${i}`}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Input
                      value={newChecklistItem}
                      onChange={(e) => setNewChecklistItem(e.target.value)}
                      placeholder="Adicionar item..."
                      className="text-sm"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleChecklistAdd();
                      }}
                      data-testid="input-new-checklist"
                    />
                    <Button
                      size="sm"
                      onClick={handleChecklistAdd}
                      disabled={!newChecklistItem.trim()}
                      data-testid="button-add-checklist"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {(attachments.length > 0 || isUploading) && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Paperclip className="w-4 h-4 text-muted-foreground" />
                      <h3 className="text-sm font-semibold" data-testid="text-section-attachments">
                        Anexos
                      </h3>
                    </div>
                    {isUploading && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2" data-testid="text-uploading">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Enviando...
                      </div>
                    )}
                    {imageAttachments.length > 0 && (
                      <div className="grid grid-cols-3 gap-2 mb-2">
                        {imageAttachments.map((att) => {
                          const viewUrl = att.driveUrl || att.url;
                          const thumbSrc = att.thumbnailUrl || null;
                          return (
                            <div key={att.id} className="relative group" data-testid={`attachment-image-${att.id}`}>
                              <a href={viewUrl} target="_blank" rel="noopener noreferrer" className="block">
                                {thumbSrc ? (
                                  <div className="w-full h-20 rounded-md overflow-hidden bg-muted">
                                    <img src={thumbSrc} alt={att.name} className="w-full h-full object-cover" />
                                  </div>
                                ) : (
                                  <div className="w-full h-20 rounded-md bg-muted flex flex-col items-center justify-center gap-1 text-muted-foreground">
                                    <Image className="w-5 h-5" />
                                    <span className="text-[10px] truncate max-w-full px-1">{att.name}</span>
                                  </div>
                                )}
                              </a>
                              <span className="absolute bottom-1 left-1 text-[9px] bg-black/60 text-white px-1 rounded truncate max-w-[90%]">
                                {att.name}
                              </span>
                              <Button
                                variant="destructive"
                                size="icon"
                                className="absolute top-1 right-1 invisible group-hover:visible h-6 w-6"
                                onClick={() => deleteAttachmentMutation.mutate(att.id)}
                                data-testid={`button-delete-attachment-${att.id}`}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {fileAttachments.length > 0 && (
                      <div className="space-y-1">
                        {fileAttachments.map((att) => {
                          const viewUrl = att.driveUrl || att.url;
                          const dlUrl = att.driveDownloadUrl || att.url;
                          return (
                          <div key={att.id} className="flex items-center gap-2 group text-sm" data-testid={`attachment-file-${att.id}`}>
                            <FileIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                            <a
                              href={viewUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 truncate hover:underline"
                              data-testid={`link-attachment-${att.id}`}
                            >
                              {att.name}
                            </a>
                            {att.extensionFolder && (
                              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                                {att.extensionFolder}
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground shrink-0">
                              {formatFileSize(att.size)}
                            </span>
                            <a href={dlUrl} target="_blank" rel="noopener noreferrer" data-testid={`button-download-attachment-${att.id}`}>
                              <Download className="w-3.5 h-3.5 text-muted-foreground" />
                            </a>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="invisible group-hover:visible h-6 w-6"
                              onClick={() => deleteAttachmentMutation.mutate(att.id)}
                              data-testid={`button-delete-attachment-${att.id}`}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold" data-testid="text-section-comments">
                      Comentarios
                    </h3>
                  </div>
                  <div className="space-y-3 mb-3">
                    {comments.map((comment) => (
                      <div key={comment.id} className="flex gap-2" data-testid={`comment-${comment.id}`}>
                        <Avatar className="w-7 h-7 shrink-0">
                          <AvatarFallback className="text-[10px]">
                            {getInitials(getUserName(comment.userId))}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium" data-testid={`text-comment-user-${comment.id}`}>
                              {getUserName(comment.userId)}
                            </span>
                            <span className="text-xs text-muted-foreground" data-testid={`text-comment-time-${comment.id}`}>
                              {comment.createdAt
                                ? formatDistanceToNow(new Date(comment.createdAt), {
                                    addSuffix: true,
                                    locale: ptBR,
                                  })
                                : ""}
                            </span>
                          </div>
                          <p className="text-sm mt-0.5" data-testid={`text-comment-content-${comment.id}`}>
                            {comment.content}
                          </p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-muted-foreground mt-0.5"
                            onClick={() => deleteCommentMutation.mutate(comment.id)}
                            data-testid={`button-delete-comment-${comment.id}`}
                          >
                            Excluir
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Escrever um comentario..."
                      className="text-sm min-h-[60px] resize-none"
                      data-testid="textarea-new-comment"
                    />
                  </div>
                  <Button
                    size="sm"
                    className="mt-2"
                    onClick={() => {
                      if (newComment.trim()) addCommentMutation.mutate(newComment.trim());
                    }}
                    disabled={!newComment.trim() || addCommentMutation.isPending}
                    data-testid="button-add-comment"
                  >
                    Comentar
                  </Button>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold" data-testid="text-section-activity">
                      Atividade
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {activity.map((act) => (
                      <div key={act.id} className="flex items-start gap-2 text-sm" data-testid={`activity-${act.id}`}>
                        <ArrowRight className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-muted-foreground">
                            <span className="font-medium text-foreground">{getUserName(act.userId)}</span>
                            {" "}{act.action}
                            {act.details && ` - ${act.details}`}
                          </span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {act.createdAt
                              ? formatDistanceToNow(new Date(act.createdAt), {
                                  addSuffix: true,
                                  locale: ptBR,
                                })
                              : ""}
                          </span>
                        </div>
                      </div>
                    ))}
                    {activity.length === 0 && (
                      <p className="text-sm text-muted-foreground">Nenhuma atividade registrada.</p>
                    )}
                  </div>
                </div>

                {timeEntries.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <h3 className="text-sm font-semibold" data-testid="text-section-time-entries">
                        Registro de Tempo
                      </h3>
                    </div>
                    <div className="space-y-1.5">
                      {timeEntries.map((entry) => (
                        <div key={entry.id} className="flex items-center gap-2 text-sm" data-testid={`time-entry-${entry.id}`}>
                          <span className="font-medium">{getUserName(entry.userId)}</span>
                          <span className="text-muted-foreground">
                            {entry.totalSeconds != null ? formatDuration(entry.totalSeconds) : "em andamento"}
                          </span>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {entry.startedAt
                              ? format(new Date(entry.startedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })
                              : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="w-[200px] shrink-0 space-y-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="secondary" className="w-full justify-start" data-testid="button-members">
                      <Users className="w-4 h-4 mr-2" />
                      Membros
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56" align="start">
                    <div className="space-y-1">
                      <p className="text-sm font-medium mb-2">Selecionar membros</p>
                      {users.map((user) => {
                        const isAssigned = card?.assignedUserIds?.includes(user.id) ?? false;
                        return (
                          <button
                            key={user.id}
                            className="flex items-center gap-2 w-full text-left text-sm rounded-md p-1.5 hover-elevate"
                            onClick={() => handleMemberToggle(user.id)}
                            data-testid={`button-toggle-member-${user.id}`}
                          >
                            <Avatar className="w-6 h-6">
                              <AvatarFallback className="text-[9px]">
                                {getInitials(user.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="flex-1 truncate">{user.name}</span>
                            {isAssigned && (
                              <Badge variant="secondary" className="text-[10px] no-default-hover-elevate no-default-active-elevate">
                                ativo
                              </Badge>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="secondary" className="w-full justify-start" data-testid="button-labels">
                      <Tag className="w-4 h-4 mr-2" />
                      Etiquetas
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56" align="start">
                    <p className="text-sm font-medium mb-2">Selecionar etiquetas</p>
                    <div className="grid grid-cols-4 gap-2">
                      {Object.entries(LABEL_COLORS).map(([color, cls]) => {
                        const isActive = card?.labels?.includes(color) ?? false;
                        return (
                          <button
                            key={color}
                            className={`w-full h-7 rounded-md ${cls} ${isActive ? "ring-2 ring-foreground ring-offset-2 ring-offset-background" : ""}`}
                            onClick={() => handleLabelToggle(color)}
                            data-testid={`button-label-${color}`}
                          />
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="secondary" className="w-full justify-start" data-testid="button-due-date">
                      <CalendarDays className="w-4 h-4 mr-2" />
                      Data de Entrega
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56" align="start">
                    <p className="text-sm font-medium mb-2">Data de entrega</p>
                    <Input
                      type="date"
                      value={card?.dueDate ? format(new Date(card.dueDate), "yyyy-MM-dd") : ""}
                      onChange={(e) => handleDueDateChange(e.target.value)}
                      data-testid="input-due-date"
                    />
                    {card?.dueDate && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full mt-2 text-destructive"
                        onClick={() => handleDueDateChange("")}
                        data-testid="button-remove-due-date"
                      >
                        Remover data
                      </Button>
                    )}
                  </PopoverContent>
                </Popover>

                <Popover open={showCoverInput} onOpenChange={setShowCoverInput}>
                  <PopoverTrigger asChild>
                    <Button variant="secondary" className="w-full justify-start" data-testid="button-cover">
                      <Image className="w-4 h-4 mr-2" />
                      Capa
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72" align="start">
                    <div className="mb-3">
                      <p className="text-sm font-medium mb-2">Enviar imagem de capa</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => coverFileInputRef.current?.click()}
                        disabled={isCoverUploading}
                        data-testid="button-upload-cover-file"
                      >
                        {isCoverUploading ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4 mr-2" />
                        )}
                        {isCoverUploading ? "Enviando..." : "Escolher arquivo"}
                      </Button>
                    </div>
                    {imageAttachments.length > 0 && (
                      <div className="mb-3">
                        <p className="text-sm font-medium mb-2">Selecionar dos anexos</p>
                        <div className="grid grid-cols-3 gap-1.5 max-h-40 overflow-y-auto">
                          {imageAttachments.map((att) => {
                            const thumbSrc = att.thumbnailUrl || att.driveDownloadUrl || att.url;
                            return (
                              <button
                                key={att.id}
                                className={`relative rounded-md overflow-hidden h-16 border-2 transition-colors ${card?.coverUrl === (att.thumbnailUrl || att.driveDownloadUrl || att.url) ? "border-primary" : "border-transparent hover:border-muted-foreground/30"}`}
                                onClick={() => {
                                  const imgUrl = att.thumbnailUrl || att.driveDownloadUrl || att.url;
                                  setCoverUrl(imgUrl);
                                  updateCardMutation.mutate({ coverUrl: imgUrl });
                                  setShowCoverInput(false);
                                }}
                                data-testid={`button-cover-attachment-${att.id}`}
                              >
                                <img
                                  src={thumbSrc}
                                  alt={att.name}
                                  className="w-full h-full object-cover"
                                />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <p className="text-sm font-medium mb-2">URL da imagem de capa</p>
                    <Input
                      value={coverUrl}
                      onChange={(e) => setCoverUrl(e.target.value)}
                      placeholder="https://..."
                      className="text-sm mb-2"
                      data-testid="input-cover-url"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleCoverSave} data-testid="button-save-cover">
                        Salvar
                      </Button>
                      {card?.coverUrl && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => {
                            setCoverUrl("");
                            updateCardMutation.mutate({ coverUrl: null });
                            setShowCoverInput(false);
                          }}
                          data-testid="button-remove-cover"
                        >
                          Remover
                        </Button>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>

                <Button
                  variant="secondary"
                  className="w-full justify-start"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  data-testid="button-attachments"
                >
                  {isUploading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Paperclip className="w-4 h-4 mr-2" />
                  )}
                  {isUploading ? "Enviando..." : "Anexos"}
                </Button>

                {(currentUser?.role === "admin" || currentUser?.role === "designer") && !card?.approvalPostId && (!card?.approvalStatus || card?.approvalStatus === "Revisão") && (
                  <Button
                    variant="secondary"
                    className="w-full justify-start text-xs"
                    onClick={() => setShowApprovalConfirm(true)}
                    disabled={sendApprovalMutation.isPending}
                    data-testid="button-send-approval"
                  >
                    <Send className="w-4 h-4 mr-2 shrink-0" />
                    <span className="truncate">{card?.approvalStatus === "Revisão" ? "Reenviar p/ aprovação" : "Enviar p/ aprovação"}</span>
                  </Button>
                )}

                {currentUser?.role !== "client" && (
                  <Button
                    variant="secondary"
                    className="w-full justify-start text-destructive"
                    onClick={() => setShowDeleteDialog(true)}
                    data-testid="button-delete-card"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Excluir
                  </Button>
                )}

                {card?.dueDate && (
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground">Entrega</p>
                    <p className="text-sm font-medium" data-testid="text-due-date">
                      {format(new Date(card.dueDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertTitle>Excluir cartao</AlertTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este cartao? Esta acao nao pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteCardMutation.mutate()}
              data-testid="button-confirm-delete"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showApprovalConfirm} onOpenChange={setShowApprovalConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertTitle>Enviar para aprovação</AlertTitle>
            <AlertDialogDescription>
              Tem certeza que deseja enviar este cartão para aprovação do cliente? Uma vez em aprovação, somente o cliente poderá aprovar, reprovar ou solicitar revisão.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-send-approval">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                sendApprovalMutation.mutate();
                setShowApprovalConfirm(false);
              }}
              data-testid="button-confirm-send-approval"
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
