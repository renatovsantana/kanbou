import { useState, useMemo, useRef, useEffect, useCallback, type UIEvent } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { KanbanColumn, KanbanCard, Client } from "@shared/schema";
import { CARD_TYPE_LABELS, CARD_TYPE_COLORS, PROTECTED_KANBAN_COLUMNS, MANDATORY_FIRST_COLUMN, type CardType } from "@shared/schema";
import { KanbanCardModal } from "@/components/kanban-card-modal";
import { KanbanCreateCardDialog } from "@/components/kanban-create-card-dialog";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  MoreVertical,
  Trash2,
  Calendar,
  Paperclip,
  MessageSquare,
  GripVertical,
  Loader2,
  X,
  Link2,
  Lock,
  PanelLeftClose,
  PanelLeft,
  Clock,
  Kanban,
  Palette,
  ImageIcon,
  ArrowUp,
  ArrowDown,
  Settings2,
  AlertTriangle,
  CalendarCheck,
  RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useSearch } from "wouter";
import { useSidebarCollapse } from "@/components/layout";

const LABEL_COLORS: Record<string, string> = {
  verde: "bg-emerald-500",
  amarelo: "bg-yellow-400",
  laranja: "bg-orange-500",
  vermelho: "bg-red-500",
  roxo: "bg-purple-500",
  azul: "bg-blue-500",
};

function formatElapsed(totalSec: number): string {
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function useAccumulatedTimer(accumulatedSeconds: number, openSince: string | null) {
  const [elapsed, setElapsed] = useState("");
  useEffect(() => {
    const update = () => {
      let total = accumulatedSeconds;
      if (openSince) {
        const start = new Date(openSince);
        total += Math.max(0, Math.floor((Date.now() - start.getTime()) / 1000));
      }
      setElapsed(formatElapsed(total));
    };
    update();
    if (openSince) {
      const interval = setInterval(update, 1000);
      return () => clearInterval(interval);
    }
  }, [accumulatedSeconds, openSince]);
  return elapsed;
}

const CARD_TYPE_ACCENT: Record<string, string> = {
  post: "#3b82f6",
  material_offline: "#f59e0b",
  material_digital: "#a855f7",
  copy: "#10b981",
  roteiro: "#ef4444",
  identidade_visual: "#ec4899",
  geral: "#6b7280",
};

function SortableCard({
  card,
  onCardClick,
  columnTitle,
  onScheduleCard,
  columnTimeData,
}: {
  card: KanbanCard;
  onCardClick: (card: KanbanCard) => void;
  columnTitle?: string;
  onScheduleCard?: (card: KanbanCard) => void;
  columnTimeData?: { accumulatedSeconds: number; openSince: string | null };
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `card-${card.id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  let attachmentCount = 0;
  if (card.attachments) {
    try {
      const parsed = JSON.parse(card.attachments);
      attachmentCount = Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      attachmentCount = 0;
    }
  }

  const accentColor = CARD_TYPE_ACCENT[card.cardType as string] || CARD_TYPE_ACCENT.geral;
  const liveTime = useAccumulatedTimer(
    columnTimeData?.accumulatedSeconds ?? 0,
    columnTimeData?.openSince ?? null
  );
  const showTimer = !!columnTimeData && (columnTimeData.accumulatedSeconds > 0 || columnTimeData.openSince);

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <div
        className="group bg-card dark:bg-card rounded-lg shadow-sm cursor-grab transition-shadow duration-200 hover:shadow-md overflow-hidden"
        style={{ borderLeft: `3px solid ${accentColor}` }}
        onDoubleClick={() => onCardClick(card)}
        data-testid={`card-kanban-${card.id}`}
      >
        {card.coverUrl && (
          <div className="w-full h-28 overflow-hidden">
            <img
              src={card.coverUrl}
              alt={card.title}
              className="w-full h-full object-cover"
              loading="lazy"
              data-testid={`img-card-cover-${card.id}`}
            />
          </div>
        )}
        <div className="p-3">
          {card.labels && card.labels.length > 0 && (
            <div className="flex gap-1 flex-wrap mb-2">
              {card.labels.map((label, i) => (
                <span
                  key={i}
                  className={`inline-block w-8 h-1.5 rounded-full ${LABEL_COLORS[label] || "bg-muted-foreground/40"}`}
                  data-testid={`label-${card.id}-${i}`}
                />
              ))}
            </div>
          )}

          <div className="flex items-center gap-1.5 flex-wrap mb-2">
            {card.cardType && card.cardType !== "geral" && (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
                style={{
                  background: `${accentColor}18`,
                  color: accentColor,
                }}
                data-testid={`badge-card-type-${card.id}`}
              >
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full"
                  style={{ background: accentColor }}
                />
                {CARD_TYPE_LABELS[card.cardType as CardType] || card.cardType}
              </span>
            )}
            {card.approvalStatus === "Pendente" && (
              <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-600 dark:text-yellow-400" data-testid={`badge-approval-${card.id}`}>
                Pendente
              </span>
            )}
            {card.approvalStatus === "Aprovado" && (
              <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400" data-testid={`badge-approval-${card.id}`}>
                Aprovado
              </span>
            )}
            {card.approvalStatus === "Reprovado" && (
              <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-500/10 text-red-600 dark:text-red-400" data-testid={`badge-approval-${card.id}`}>
                Reprovado
              </span>
            )}
            {card.approvalStatus === "Revisão" && (
              <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-600 dark:text-orange-400" data-testid={`badge-approval-${card.id}`}>
                Revisão
              </span>
            )}
          </div>

          <div className="flex items-start gap-1.5">
            <p className="text-sm font-medium leading-snug break-words min-w-0 flex items-center gap-1 text-foreground" data-testid={`text-card-title-${card.id}`}>
              {card.approvalPostId && (
                <Link2 className="w-3.5 h-3.5 text-primary shrink-0" />
              )}
              {card.title}
            </p>
          </div>

          <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-border/50">
            <div className="flex items-center gap-2.5 flex-wrap">
              {showTimer && (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground font-mono" data-testid={`text-card-timer-${card.id}`}>
                  <Clock className="w-3 h-3" />
                  {liveTime}
                </span>
              )}
              {card.dueDate && (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground" data-testid={`text-card-due-${card.id}`}>
                  <Calendar className="w-3 h-3" />
                  {format(new Date(card.dueDate), "dd MMM", { locale: ptBR })}
                </span>
              )}
              {attachmentCount > 0 && (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground" data-testid={`text-card-attachments-${card.id}`}>
                  <Paperclip className="w-3 h-3" />
                  {attachmentCount}
                </span>
              )}
            </div>

            {card.assignedUserIds && card.assignedUserIds.length > 0 && (
              <div className="flex items-center -space-x-1.5">
                {card.assignedUserIds.slice(0, 3).map((uid) => (
                  <Avatar key={uid} className="w-5 h-5 ring-2 ring-card" data-testid={`avatar-user-${uid}-card-${card.id}`}>
                    <AvatarFallback className="text-[8px] font-bold bg-primary/20 text-primary">
                      {String(uid).slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                ))}
                {card.assignedUserIds.length > 3 && (
                  <span className="text-[10px] text-muted-foreground ml-1">
                    +{card.assignedUserIds.length - 3}
                  </span>
                )}
              </div>
            )}
          </div>

          {columnTitle === "Agendamento" && onScheduleCard && (
            <button
              className="w-full mt-2 flex items-center justify-center gap-1.5 text-xs font-semibold py-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onScheduleCard(card);
              }}
              data-testid={`button-schedule-card-${card.id}`}
            >
              <CalendarCheck className="w-3.5 h-3.5" />
              Agendar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CardPreview({ card }: { card: KanbanCard }) {
  const accentColor = CARD_TYPE_ACCENT[card.cardType as string] || CARD_TYPE_ACCENT.geral;
  return (
    <div
      className="w-[264px] shadow-xl bg-card rounded-lg rotate-2 overflow-hidden"
      style={{ borderLeft: `3px solid ${accentColor}` }}
    >
      {card.coverUrl && (
        <div className="w-full h-28 overflow-hidden">
          <img src={card.coverUrl} alt={card.title} className="w-full h-full object-cover" />
        </div>
      )}
      <div className="p-3">
        {card.labels && card.labels.length > 0 && (
          <div className="flex gap-1 flex-wrap mb-1.5">
            {card.labels.map((label, i) => (
              <span
                key={i}
                className={`inline-block w-8 h-1.5 rounded-full ${LABEL_COLORS[label] || "bg-muted-foreground/40"}`}
              />
            ))}
          </div>
        )}
        <p className="text-sm font-medium leading-snug">{card.title}</p>
      </div>
    </div>
  );
}

const OVERDUE_COLUMN = "Agendamento";

function isCardOverdue(card: KanbanCard): boolean {
  if (card.cardType !== "post") return false;
  try {
    const data = card.templateData ? JSON.parse(card.templateData) : null;
    if (!data?.publishDate) return false;
    const parts = data.publishDate.split("T")[0].split("-");
    const pubYear = parseInt(parts[0], 10);
    const pubMonth = parseInt(parts[1], 10) - 1;
    const pubDay = parseInt(parts[2], 10);
    const today = new Date();
    const todayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const pubLocal = new Date(pubYear, pubMonth, pubDay);
    return pubLocal < todayLocal;
  } catch {
    return false;
  }
}

function DroppableColumn({
  column,
  cards,
  onCardClick,
  onAddCard,
  onRenameColumn,
  onDeleteColumn,
  onScheduleCard,
  columnTimesData,
}: {
  column: KanbanColumn;
  cards: KanbanCard[];
  onCardClick: (card: KanbanCard) => void;
  onAddCard: (columnId: number, data: { title: string; cardType: string; templateData: string }) => void;
  onRenameColumn: (columnId: number, title: string) => void;
  onDeleteColumn: (column: KanbanColumn) => void;
  onScheduleCard?: (card: KanbanCard) => void;
  columnTimesData?: Record<number, { accumulatedSeconds: number; openSince: string | null }>;
}) {
  const { setNodeRef } = useDroppable({ id: `column-${column.id}` });
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(column.title);
  const [isAdding, setIsAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleRenameSubmit = () => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== column.title) {
      onRenameColumn(column.id, trimmed);
    } else {
      setEditTitle(column.title);
    }
    setIsEditing(false);
  };

  const canShowOverdue = column.title === OVERDUE_COLUMN;
  const { normalCards, overdueCards } = useMemo(() => {
    if (!canShowOverdue) return { normalCards: cards, overdueCards: [] };
    const normal: KanbanCard[] = [];
    const overdue: KanbanCard[] = [];
    for (const card of cards) {
      if (isCardOverdue(card)) {
        overdue.push(card);
      } else {
        normal.push(card);
      }
    }
    return { normalCards: normal, overdueCards: overdue };
  }, [cards, canShowOverdue]);

  const sortableIds = cards.map((c) => `card-${c.id}`);

  return (
    <div className="flex flex-col w-[280px] shrink-0 max-h-full" data-testid={`column-${column.id}`}>
      <div className="kanban-column rounded-lg flex flex-col max-h-full">
        <div className="flex items-center justify-between gap-1 px-3 pt-3 pb-2">
          {isEditing ? (
            <Input
              ref={inputRef}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRenameSubmit();
                if (e.key === "Escape") {
                  setEditTitle(column.title);
                  setIsEditing(false);
                }
              }}
              className="h-7 text-sm font-semibold px-1.5"
              data-testid={`input-rename-column-${column.id}`}
            />
          ) : (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <button
                className="text-sm font-bold uppercase tracking-wide truncate text-left flex-1 text-foreground/80"
                onClick={() => !PROTECTED_KANBAN_COLUMNS.includes(column.title) && setIsEditing(true)}
                data-testid={`button-rename-column-${column.id}`}
              >
                {column.title}
              </button>
              <span className="text-[11px] font-semibold text-muted-foreground bg-muted/80 dark:bg-muted/50 rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                {cards.length}
              </span>
            </div>
          )}
          {!PROTECTED_KANBAN_COLUMNS.includes(column.title) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" data-testid={`button-column-menu-${column.id}`}>
                  <MoreVertical className="w-3.5 h-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => setIsEditing(true)}
                  data-testid={`menu-rename-column-${column.id}`}
                >
                  Renomear
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDeleteColumn(column)}
                  className="text-destructive"
                  data-testid={`menu-delete-column-${column.id}`}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  Excluir coluna
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div
          ref={setNodeRef}
          className="flex-1 overflow-y-auto px-2 pb-2 space-y-2 min-h-[40px] kanban-scroll"
          style={{ maxHeight: "calc(100vh - 180px)" }}
        >
          <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
            {normalCards.map((card) => (
              <SortableCard key={card.id} card={card} onCardClick={onCardClick} columnTitle={column.title} onScheduleCard={onScheduleCard} columnTimeData={columnTimesData?.[card.id]} />
            ))}
            {overdueCards.length > 0 && (
              <>
                <div className="flex items-center gap-1.5 pt-2 pb-1 px-1" data-testid="overdue-section-header">
                  <div className="h-px flex-1 bg-destructive/30" />
                  <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-destructive shrink-0">
                    <AlertTriangle className="w-3 h-3" />
                    Agendamento Atrasado
                  </span>
                  <div className="h-px flex-1 bg-destructive/30" />
                </div>
                {overdueCards.map((card) => (
                  <SortableCard key={card.id} card={card} onCardClick={onCardClick} columnTitle={column.title} onScheduleCard={onScheduleCard} columnTimeData={columnTimesData?.[card.id]} />
                ))}
              </>
            )}
          </SortableContext>
        </div>

        {column.title === MANDATORY_FIRST_COLUMN && (
          <div className="px-2 pb-2">
            <Button
              variant="ghost"
              className="w-full justify-start text-muted-foreground/70 text-sm"
              onClick={() => setIsAdding(true)}
              data-testid={`button-add-card-${column.id}`}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Adicionar cartão
            </Button>
          </div>
        )}
        <KanbanCreateCardDialog
          open={isAdding}
          onClose={() => setIsAdding(false)}
          onSubmit={(data) => {
            onAddCard(column.id, data);
            setIsAdding(false);
          }}
          columnTitle={column.title}
        />
      </div>
    </div>
  );
}

function KanbanColumnManager({ clientId, columns }: { clientId: number; columns: KanbanColumn[] }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [localCols, setLocalCols] = useState<KanbanColumn[]>([]);
  const [newTitle, setNewTitle] = useState("");

  useEffect(() => {
    if (open) {
      setLocalCols([...columns].sort((a, b) => a.position - b.position));
    }
  }, [open, columns]);

  const reorderMutation = useMutation({
    mutationFn: async (columnIds: number[]) => {
      await apiRequest("PUT", `/api/kanban/${clientId}/columns/reorder`, { columnIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kanban", clientId, "columns"] });
      toast({ title: "Ordem das colunas atualizada" });
    },
    onError: () => {
      toast({ title: "Erro ao reordenar", variant: "destructive" });
    },
  });

  const addColumnMutation = useMutation({
    mutationFn: async (title: string) => {
      await apiRequest("POST", `/api/kanban/${clientId}/columns`, { title, position: localCols.length });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kanban", clientId, "columns"] });
      setNewTitle("");
      toast({ title: "Coluna adicionada" });
    },
    onError: () => {
      toast({ title: "Erro ao adicionar coluna", variant: "destructive" });
    },
  });

  const deleteColumnMutation = useMutation({
    mutationFn: async (colId: number) => {
      await apiRequest("DELETE", `/api/kanban/columns/${colId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kanban", clientId, "columns"] });
      toast({ title: "Coluna removida" });
    },
    onError: (err: any) => {
      toast({ title: err?.message || "Erro ao remover coluna", variant: "destructive" });
    },
  });

  const moveCol = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= localCols.length) return;
    const updated = [...localCols];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setLocalCols(updated);
  };

  const handleSave = () => {
    reorderMutation.mutate(localCols.map(c => c.id));
  };

  const isProtected = (title: string) => PROTECTED_KANBAN_COLUMNS.includes(title);

  return (
    <>
      <Button variant="ghost" size="icon" title="Gerenciar colunas" onClick={() => setOpen(true)} data-testid="button-manage-columns">
        <Settings2 className="w-4 h-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Gerenciar Colunas</DialogTitle>
          </DialogHeader>
          <div className="space-y-1 mt-2">
            {localCols.map((col, idx) => (
              <div
                key={col.id}
                className="flex items-center gap-2 p-2 rounded-md border bg-muted/30"
                data-testid={`column-row-${col.id}`}
              >
                <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="flex-1 text-sm font-medium truncate">{col.title}</span>
                {isProtected(col.title) && (
                  <Lock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                )}
                <div className="flex items-center gap-0.5 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => moveCol(idx, -1)}
                    disabled={idx === 0}
                    data-testid={`button-move-up-${col.id}`}
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => moveCol(idx, 1)}
                    disabled={idx === localCols.length - 1}
                    data-testid={`button-move-down-${col.id}`}
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </Button>
                  {!isProtected(col.title) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => {
                        deleteColumnMutation.mutate(col.id);
                        setLocalCols(prev => prev.filter(c => c.id !== col.id));
                      }}
                      data-testid={`button-delete-col-${col.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 mt-3">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Nova coluna..."
              className="text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newTitle.trim()) {
                  addColumnMutation.mutate(newTitle.trim());
                }
              }}
              data-testid="input-new-column-title"
            />
            <Button
              size="sm"
              onClick={() => newTitle.trim() && addColumnMutation.mutate(newTitle.trim())}
              disabled={!newTitle.trim() || addColumnMutation.isPending}
              data-testid="button-add-column"
            >
              <Plus className="w-4 h-4 mr-1" />
              Adicionar
            </Button>
          </div>

          <div className="flex justify-end gap-2 mt-4 pt-3 border-t">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={reorderMutation.isPending}
              data-testid="button-save-column-order"
            >
              Salvar ordem
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

const PRESET_COLORS = [
  "#1e293b", "#0f172a", "#1a1a2e", "#16213e", "#0d1b2a",
  "#1b4332", "#064e3b", "#14532d", "#365314", "#3f6212",
  "#7c2d12", "#78350f", "#713f12", "#92400e", "#9a3412",
  "#4c1d95", "#5b21b6", "#6d28d9", "#581c87", "#3b0764",
  "#831843", "#9d174d", "#be185d", "#be123c", "#881337",
];

function KanbanBgSettings({ client }: { client: Client }) {
  const { toast } = useToast();
  const [bgColor, setBgColor] = useState(client.kanbanBgColor || "");
  const [bgImage, setBgImage] = useState(client.kanbanBgImage || "");

  useEffect(() => {
    setBgColor(client.kanbanBgColor || "");
    setBgImage(client.kanbanBgImage || "");
  }, [client.id, client.kanbanBgColor, client.kanbanBgImage]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", `/api/clients/${client.id}/kanban-bg`, {
        kanbanBgColor: bgColor || null,
        kanbanBgImage: bgImage || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Fundo do quadro atualizado" });
    },
    onError: () => {
      toast({ title: "Erro ao salvar fundo", variant: "destructive" });
    },
  });

  const clearBg = () => {
    setBgColor("");
    setBgImage("");
    apiRequest("PUT", `/api/clients/${client.id}/kanban-bg`, {
      kanbanBgColor: null,
      kanbanBgImage: null,
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Fundo resetado" });
    });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" title="Personalizar fundo" data-testid="button-kanban-bg">
          <Palette className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Fundo do Quadro</h3>

          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Cor de fundo</Label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  className={`w-7 h-7 rounded-md border-2 transition-all ${bgColor === color ? "border-primary scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: color }}
                  onClick={() => { setBgColor(color); setBgImage(""); }}
                  data-testid={`bg-color-${color}`}
                />
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Input
                type="color"
                value={bgColor || "#1e293b"}
                onChange={(e) => { setBgColor(e.target.value); setBgImage(""); }}
                className="w-9 h-9 p-1 cursor-pointer"
                data-testid="input-bg-color-picker"
              />
              <span className="text-xs text-muted-foreground">Cor personalizada</span>
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">URL da imagem de fundo</Label>
            <Input
              value={bgImage}
              onChange={(e) => { setBgImage(e.target.value); if (e.target.value) setBgColor(""); }}
              placeholder="https://exemplo.com/imagem.jpg"
              className="text-xs"
              data-testid="input-bg-image-url"
            />
          </div>

          {(bgColor || bgImage) && (
            <div className="h-16 rounded-md overflow-hidden border">
              <div
                className="w-full h-full"
                style={bgImage ? { backgroundImage: `url(${bgImage})`, backgroundSize: "cover", backgroundPosition: "center" } : { backgroundColor: bgColor }}
              />
            </div>
          )}

          <div className="flex gap-2">
            <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="button-save-bg">
              Salvar
            </Button>
            <Button variant="ghost" size="sm" onClick={clearBg} data-testid="button-clear-bg">
              Resetar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function KanbanScrollArea({ children, client }: { children: React.ReactNode; client?: Client }) {
  const mainRef = useRef<HTMLDivElement>(null);
  const topBarRef = useRef<HTMLDivElement>(null);
  const topInnerRef = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);

  const syncTopWidth = useCallback(() => {
    if (mainRef.current && topInnerRef.current) {
      topInnerRef.current.style.width = `${mainRef.current.scrollWidth}px`;
    }
  }, []);

  useEffect(() => {
    syncTopWidth();
    const observer = new ResizeObserver(syncTopWidth);
    if (mainRef.current) observer.observe(mainRef.current);
    return () => observer.disconnect();
  }, [syncTopWidth, children]);

  const handleMainScroll = useCallback(() => {
    if (syncing.current) return;
    syncing.current = true;
    if (topBarRef.current && mainRef.current) {
      topBarRef.current.scrollLeft = mainRef.current.scrollLeft;
    }
    syncing.current = false;
  }, []);

  const handleTopScroll = useCallback(() => {
    if (syncing.current) return;
    syncing.current = true;
    if (mainRef.current && topBarRef.current) {
      mainRef.current.scrollLeft = topBarRef.current.scrollLeft;
    }
    syncing.current = false;
  }, []);

  const hasCustomBg = !!(client?.kanbanBgColor || client?.kanbanBgImage);
  const bgStyle: React.CSSProperties = {};
  if (client?.kanbanBgImage) {
    bgStyle.backgroundImage = `url(${client.kanbanBgImage})`;
    bgStyle.backgroundSize = "cover";
    bgStyle.backgroundPosition = "center";
  } else if (client?.kanbanBgColor) {
    bgStyle.background = client.kanbanBgColor;
  }

  return (
    <div className={`flex-1 flex flex-col overflow-hidden ${hasCustomBg ? '' : 'kanban-board-bg'}`} style={bgStyle} data-testid="kanban-scroll-area">
      {client?.kanbanBgImage && (
        <div className="absolute inset-0 bg-black/30 pointer-events-none" style={{ position: 'absolute' }} />
      )}
      <div
        ref={topBarRef}
        className="overflow-x-auto overflow-y-hidden shrink-0 kanban-top-scrollbar"
        onScroll={handleTopScroll}
        data-testid="kanban-top-scrollbar"
      >
        <div ref={topInnerRef} style={{ height: 1 }} />
      </div>
      <div
        ref={mainRef}
        className="flex-1 overflow-x-auto overflow-y-hidden relative"
        onScroll={handleMainScroll}
      >
        {children}
      </div>
    </div>
  );
}

export default function KanbanBoard() {
  const { toast } = useToast();
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const initialClientId = urlParams.get("clientId") || "";
  const [selectedClientId, setSelectedClientId] = useState<string>(initialClientId);

  useEffect(() => {
    if (initialClientId && initialClientId !== selectedClientId) {
      setSelectedClientId(initialClientId);
    }
  }, [initialClientId]);

  useEffect(() => {
    if (selectedClientId) {
      apiRequest("PUT", "/api/notifications/read-kanban", { clientId: Number(selectedClientId) }).then(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
        queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
      }).catch(() => {});
    }
  }, [selectedClientId]);

  const [activeCard, setActiveCard] = useState<KanbanCard | null>(null);
  const [deletingColumn, setDeletingColumn] = useState<KanbanColumn | null>(null);
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState("");
  const newColRef = useRef<HTMLInputElement>(null);
  const [pendingApprovalMove, setPendingApprovalMove] = useState<{ cardId: number; toColumnId: number; newPosition: number } | null>(null);
  const [scheduleConfirmCard, setScheduleConfirmCard] = useState<KanbanCard | null>(null);
  const { collapsed, setCollapsed } = useSidebarCollapse();

  const { data: clients = [], isLoading: loadingClients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const clientId = selectedClientId ? Number(selectedClientId) : null;

  const { data: columns = [], isLoading: loadingColumns } = useQuery<KanbanColumn[]>({
    queryKey: ["/api/kanban", clientId, "columns"],
    enabled: !!clientId,
    refetchInterval: 15000,
  });

  const { data: cards = [], isLoading: loadingCards } = useQuery<KanbanCard[]>({
    queryKey: ["/api/kanban", clientId, "cards"],
    enabled: !!clientId,
    refetchInterval: 15000,
  });

  const { data: columnTimesData } = useQuery<Record<number, { accumulatedSeconds: number; openSince: string | null }>>({
    queryKey: ["/api/kanban/client", clientId, "column-times"],
    enabled: !!clientId,
    refetchInterval: 60000,
  });

  const sortedColumns = useMemo(
    () => [...columns].sort((a, b) => a.position - b.position),
    [columns]
  );

  const cardsByColumn = useMemo(() => {
    const map: Record<number, KanbanCard[]> = {};
    for (const col of columns) {
      map[col.id] = [];
    }
    for (const card of cards) {
      if (map[card.columnId]) {
        map[card.columnId].push(card);
      }
    }
    for (const key of Object.keys(map)) {
      map[Number(key)].sort((a, b) => a.position - b.position);
    }
    return map;
  }, [columns, cards]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const createCardMutation = useMutation({
    mutationFn: async (data: { columnId: number; clientId: number; title: string; position: number; cardType?: string; templateData?: string }) => {
      await apiRequest("POST", "/api/kanban/cards", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kanban", clientId, "cards"] });
    },
    onError: () => {
      toast({ title: "Erro ao criar cartão", variant: "destructive" });
    },
  });

  const moveCardMutation = useMutation({
    mutationFn: async ({ cardId, toColumnId, newPosition }: { cardId: number; toColumnId: number; newPosition: number }) => {
      await apiRequest("PUT", `/api/kanban/cards/${cardId}/move`, { toColumnId, newPosition });
    },
    onMutate: async ({ cardId, toColumnId, newPosition }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/kanban", clientId, "cards"] });
      const previousCards = queryClient.getQueryData<KanbanCard[]>(["/api/kanban", clientId, "cards"]);
      queryClient.setQueryData<KanbanCard[]>(["/api/kanban", clientId, "cards"], (old) => {
        if (!old) return old;
        return old.map(c => c.id === cardId ? { ...c, columnId: toColumnId, position: newPosition } : c);
      });
      return { previousCards };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kanban", clientId, "cards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/kanban/client", clientId, "column-times"] });
    },
    onError: (error: any, _vars, context) => {
      if (context?.previousCards) {
        queryClient.setQueryData(["/api/kanban", clientId, "cards"], context.previousCards);
      }
      let msg = "Erro ao mover cartão";
      try {
        const raw = error?.message || "";
        const jsonPart = raw.includes("{") ? raw.substring(raw.indexOf("{")) : "";
        if (jsonPart) {
          const parsed = JSON.parse(jsonPart);
          msg = parsed.message || msg;
        }
      } catch {}
      toast({ title: msg, variant: "destructive" });
      queryClient.invalidateQueries({ queryKey: ["/api/kanban", clientId, "cards"] });
    },
  });

  const renameColumnMutation = useMutation({
    mutationFn: async ({ columnId, title }: { columnId: number; title: string }) => {
      await apiRequest("PUT", `/api/kanban/columns/${columnId}`, { title });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kanban", clientId, "columns"] });
    },
    onError: () => {
      toast({ title: "Erro ao renomear coluna", variant: "destructive" });
    },
  });

  const deleteColumnMutation = useMutation({
    mutationFn: async (columnId: number) => {
      await apiRequest("DELETE", `/api/kanban/columns/${columnId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kanban", clientId, "columns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/kanban", clientId, "cards"] });
      setDeletingColumn(null);
    },
    onError: () => {
      toast({ title: "Erro ao excluir coluna", variant: "destructive" });
    },
  });

  const createColumnMutation = useMutation({
    mutationFn: async (data: { title: string; position: number }) => {
      if (!clientId) return;
      await apiRequest("POST", `/api/kanban/${clientId}/columns`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kanban", clientId, "columns"] });
      setNewColumnTitle("");
      setAddingColumn(false);
    },
    onError: () => {
      toast({ title: "Erro ao criar coluna", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (addingColumn && newColRef.current) {
      newColRef.current.focus();
    }
  }, [addingColumn]);

  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);

  const onCardClick = useCallback((card: KanbanCard) => {
    setSelectedCardId(card.id);
  }, []);

  const handleAddCard = useCallback(
    (columnId: number, data: { title: string; cardType: string; templateData: string }) => {
      if (!clientId) return;
      const colCards = cardsByColumn[columnId] || [];
      const maxPos = colCards.length > 0 ? Math.max(...colCards.map((c) => c.position)) + 1 : 0;
      createCardMutation.mutate({
        columnId,
        clientId,
        title: data.title,
        position: maxPos,
        cardType: data.cardType,
        templateData: data.templateData,
      });
    },
    [clientId, cardsByColumn, createCardMutation]
  );

  const handleRenameColumn = useCallback(
    (columnId: number, title: string) => {
      renameColumnMutation.mutate({ columnId, title });
    },
    [renameColumnMutation]
  );

  const handleDeleteColumn = useCallback((column: KanbanColumn) => {
    setDeletingColumn(column);
  }, []);

  const handleAddColumn = () => {
    const trimmed = newColumnTitle.trim();
    if (!trimmed) return;
    const maxPos = sortedColumns.length > 0 ? Math.max(...sortedColumns.map((c) => c.position)) + 1 : 0;
    createColumnMutation.mutate({ title: trimmed, position: maxPos });
  };

  const handleConfirmSchedule = () => {
    if (!scheduleConfirmCard) return;
    const agendadosCol = columns.find(c => c.title === "Agendados");
    if (!agendadosCol) {
      toast({ title: "Erro", description: "Coluna 'Agendados' não encontrada.", variant: "destructive" });
      setScheduleConfirmCard(null);
      return;
    }
    const cardsInTarget = cardsByColumn[agendadosCol.id] || [];
    moveCardMutation.mutate({
      cardId: scheduleConfirmCard.id,
      toColumnId: agendadosCol.id,
      newPosition: cardsInTarget.length,
    });
    setScheduleConfirmCard(null);
  };

  const findColumnIdFromCardId = (id: string): number | null => {
    const numId = Number(id.replace("card-", ""));
    const card = cards.find((c) => c.id === numId);
    return card ? card.columnId : null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const cardId = Number(String(active.id).replace("card-", ""));
    const card = cards.find((c) => c.id === cardId);
    if (card) setActiveCard(card);
  };

  const handleDragOver = (_event: DragOverEvent) => {};

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCard(null);

    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    if (activeId === overId) return;

    const activeCardId = Number(activeId.replace("card-", ""));
    const activeColumnId = findColumnIdFromCardId(activeId);
    if (!activeColumnId) return;

    let targetColumnId: number;
    let targetPosition: number;

    if (overId.startsWith("column-")) {
      targetColumnId = Number(overId.replace("column-", ""));
      const colCards = cardsByColumn[targetColumnId] || [];
      targetPosition = colCards.length;
    } else if (overId.startsWith("card-")) {
      const overCardId = Number(overId.replace("card-", ""));
      const overCard = cards.find((c) => c.id === overCardId);
      if (!overCard) return;
      targetColumnId = overCard.columnId;
      targetPosition = overCard.position;
    } else {
      return;
    }

    const targetCol = sortedColumns.find(c => c.id === targetColumnId);
    if (targetCol && targetCol.title === "Em Aprovação" && activeColumnId !== targetColumnId) {
      setPendingApprovalMove({ cardId: activeCardId, toColumnId: targetColumnId, newPosition: targetPosition });
      return;
    }

    moveCardMutation.mutate({
      cardId: activeCardId,
      toColumnId: targetColumnId,
      newPosition: targetPosition,
    });
  };

  const isLoading = loadingClients || (clientId && (loadingColumns || loadingCards));
  const selectedClient = clients.find(c => String(c.id) === selectedClientId);

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] lg:h-screen">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border/50 bg-background flex-wrap">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex"
          data-testid="button-toggle-sidebar"
        >
          {collapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </Button>

        <div className="flex items-center gap-2.5">
          <h1 className="text-lg font-bold font-display" data-testid="text-kanban-title">Kanban</h1>
          {selectedClient && (
            <span className="text-sm text-muted-foreground font-medium">/ {selectedClient.name}</span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ["/api/kanban", clientId, "columns"] });
              queryClient.invalidateQueries({ queryKey: ["/api/kanban", clientId, "cards"] });
            }}
            title="Atualizar"
            data-testid="button-refresh-kanban"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          {selectedClient && clientId && <KanbanColumnManager clientId={clientId} columns={columns} />}
          {selectedClient && <KanbanBgSettings client={selectedClient} />}
          <Select
            value={selectedClientId}
            onValueChange={setSelectedClientId}
          >
            <SelectTrigger className="w-[220px]" data-testid="select-client">
              <SelectValue placeholder="Selecionar cliente..." />
            </SelectTrigger>
            <SelectContent>
              {clients
                .filter((c) => c.isActive !== false)
                .map((c) => (
                  <SelectItem key={c.id} value={String(c.id)} data-testid={`option-client-${c.id}`}>
                    {c.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!clientId ? (
        <div className="flex-1 flex items-center justify-center kanban-board-bg">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mx-auto">
              <Kanban className="w-8 h-8 text-white/40" />
            </div>
            <p className="text-white/60 text-sm font-medium" data-testid="text-no-client">
              Selecione um cliente para visualizar o quadro.
            </p>
          </div>
        </div>
      ) : isLoading ? (
        <div className="flex-1 flex items-center justify-center kanban-board-bg">
          <Loader2 className="w-6 h-6 animate-spin text-white/60" />
        </div>
      ) : (
        <KanbanScrollArea client={selectedClient}>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-4 p-5 items-start h-full min-w-max">
              {sortedColumns.map((col) => (
                <DroppableColumn
                  key={col.id}
                  column={col}
                  cards={cardsByColumn[col.id] || []}
                  onCardClick={onCardClick}
                  onAddCard={handleAddCard}
                  onRenameColumn={handleRenameColumn}
                  onDeleteColumn={handleDeleteColumn}
                  onScheduleCard={setScheduleConfirmCard}
                  columnTimesData={columnTimesData}
                />
              ))}

              <div className="w-[280px] shrink-0">
                {addingColumn ? (
                  <div className="kanban-column rounded-lg p-3 space-y-2">
                    <Input
                      ref={newColRef}
                      value={newColumnTitle}
                      onChange={(e) => setNewColumnTitle(e.target.value)}
                      placeholder="Titulo da coluna..."
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddColumn();
                        if (e.key === "Escape") {
                          setNewColumnTitle("");
                          setAddingColumn(false);
                        }
                      }}
                      className="text-sm"
                      data-testid="input-new-column"
                    />
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        onClick={handleAddColumn}
                        disabled={!newColumnTitle.trim()}
                        data-testid="button-submit-column"
                      >
                        Adicionar
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setNewColumnTitle("");
                          setAddingColumn(false);
                        }}
                        data-testid="button-cancel-column"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="w-full flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium text-white/60 hover:text-white/90 bg-white/5 hover:bg-white/10 border border-dashed border-white/15 hover:border-white/25 transition-all duration-200"
                    onClick={() => setAddingColumn(true)}
                    data-testid="button-add-column"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar coluna
                  </button>
                )}
              </div>
            </div>

            <DragOverlay>
              {activeCard ? <CardPreview card={activeCard} /> : null}
            </DragOverlay>
          </DndContext>
        </KanbanScrollArea>
      )}

      <AlertDialog open={!!deletingColumn} onOpenChange={(open) => { if (!open) setDeletingColumn(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir coluna</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a coluna "{deletingColumn?.title}"? Todos os cartões nela serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-column">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingColumn && deleteColumnMutation.mutate(deletingColumn.id)}
              data-testid="button-confirm-delete-column"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!pendingApprovalMove} onOpenChange={(open) => { if (!open) setPendingApprovalMove(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enviar para aprovação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja enviar este cartão para aprovação do cliente? Uma vez em aprovação, somente o cliente poderá aprovar, reprovar ou solicitar revisão.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-approval-move">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingApprovalMove) {
                  moveCardMutation.mutate(pendingApprovalMove);
                  setPendingApprovalMove(null);
                }
              }}
              data-testid="button-confirm-approval-move"
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!scheduleConfirmCard} onOpenChange={(open) => { if (!open) setScheduleConfirmCard(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-primary" />
              Confirmar Agendamento
            </DialogTitle>
          </DialogHeader>
          {scheduleConfirmCard && (() => {
            let tplData: Record<string, any> = {};
            try { tplData = scheduleConfirmCard.templateData ? JSON.parse(scheduleConfirmCard.templateData) : {}; } catch {}
            const caption = tplData.caption || "";
            const publishDate = tplData.publishDate || "";
            const platforms: string[] = (() => {
              try {
                if (tplData.platform) {
                  const p = typeof tplData.platform === "string" ? JSON.parse(tplData.platform) : tplData.platform;
                  return Array.isArray(p) ? p : [];
                }
              } catch {}
              return [];
            })();
            const formattedDate = publishDate ? (() => {
              try {
                const parts = publishDate.split("T")[0].split("-");
                return `${parts[2]}/${parts[1]}/${parts[0]}`;
              } catch { return publishDate; }
            })() : null;

            return (
              <div className="space-y-4" data-testid="schedule-confirm-details">
                <div className="text-sm font-semibold text-foreground">{scheduleConfirmCard.title}</div>

                {scheduleConfirmCard.coverUrl && (
                  <div className="rounded-lg overflow-hidden border bg-muted">
                    <img
                      src={scheduleConfirmCard.coverUrl}
                      alt={scheduleConfirmCard.title}
                      className="w-full max-h-52 object-contain"
                      data-testid="schedule-confirm-image"
                    />
                  </div>
                )}

                {caption && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Legenda</label>
                    <div className="text-sm bg-muted/50 rounded-md p-3 whitespace-pre-wrap max-h-32 overflow-y-auto" data-testid="schedule-confirm-caption">
                      {caption}
                    </div>
                  </div>
                )}

                <div className="flex gap-4 flex-wrap">
                  {formattedDate && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Data da Postagem</label>
                      <div className="flex items-center gap-1.5 text-sm font-medium" data-testid="schedule-confirm-date">
                        <Calendar className="w-4 h-4 text-primary" />
                        {formattedDate}
                      </div>
                    </div>
                  )}
                  {platforms.length > 0 && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Plataformas</label>
                      <div className="flex gap-1 flex-wrap" data-testid="schedule-confirm-platforms">
                        {platforms.map((p) => (
                          <Badge key={p} variant="secondary" className="text-xs">{p}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md p-3 text-sm text-amber-800 dark:text-amber-200" data-testid="schedule-confirm-warning">
                  Tem certeza que este post foi agendado corretamente?
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    variant="outline"
                    onClick={() => setScheduleConfirmCard(null)}
                    data-testid="button-cancel-schedule"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleConfirmSchedule}
                    data-testid="button-confirm-schedule"
                  >
                    <CalendarCheck className="w-4 h-4 mr-1.5" />
                    Sim, já agendei
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {clientId && (
        <KanbanCardModal
          cardId={selectedCardId}
          clientId={clientId}
          open={selectedCardId !== null}
          onClose={() => setSelectedCardId(null)}
          columnTitle={(() => {
            if (!selectedCardId) return undefined;
            const selectedCard = cards.find(c => c.id === selectedCardId);
            if (!selectedCard) return undefined;
            const col = columns.find(c => c.id === selectedCard.columnId);
            return col?.title;
          })()}
        />
      )}
    </div>
  );
}
