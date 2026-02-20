import { useState, useMemo } from "react";
import { usePosts, useDeletePost } from "@/hooks/use-posts";
import { useSearch, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Post, ApprovalPost, Client } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Plus,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  Filter,
  CalendarCheck,
  CheckCircle2,
  Loader2,
  CalendarIcon,
  Clock,
  ArrowLeft,
  Image as ImageIcon,
  Instagram,
  Facebook,
  Linkedin,
  Video,
  FileText,
  ChevronDown,
  ChevronRight,
  Download,
  Copy,
  Check,
  Users,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/status-badge";
import { PlatformIcon } from "@/components/platform-icon";
import { PostForm } from "@/components/post-form";
import { useToast } from "@/hooks/use-toast";

interface KanbanApprovedCard {
  id: number;
  title: string;
  clientId: number;
  clientName: string;
  cardType: string;
  caption: string;
  platform: string | null;
  publishDate: string | null;
  hashtags: string | null;
  imageUrl: string | null;
  attachments: any[];
  alreadyScheduled: boolean;
  createdAt: string;
}

const ALL_PLATFORMS = [
  { value: "Instagram", label: "Instagram", icon: Instagram, color: "text-pink-600" },
  { value: "Facebook", label: "Facebook", icon: Facebook, color: "text-blue-600" },
  { value: "LinkedIn", label: "LinkedIn", icon: Linkedin, color: "text-blue-700" },
  { value: "TikTok", label: "TikTok", icon: Video, color: "text-foreground" },
  { value: "Blog", label: "Blog", icon: FileText, color: "text-orange-600" },
  { value: "Twitter/X", label: "Twitter/X", icon: FileText, color: "text-foreground" },
  { value: "YouTube", label: "YouTube", icon: Video, color: "text-red-600" },
  { value: "Pinterest", label: "Pinterest", icon: ImageIcon, color: "text-red-700" },
];

function getPostMediaUrls(post: Post): string[] {
  if (post.mediaUrls && post.mediaUrls.length > 0) return post.mediaUrls;
  if (post.mediaUrl) return [post.mediaUrl];
  return [];
}

async function downloadPostImage(url: string, filename: string) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch {
    window.open(url, "_blank");
  }
}

async function downloadAllPostImages(post: Post) {
  const images = getPostMediaUrls(post);
  if (images.length === 0) return;
  const baseName = post.title.replace(/[^a-zA-Z0-9À-ú\s-]/g, "").replace(/\s+/g, "-");
  for (let i = 0; i < images.length; i++) {
    const ext = images[i].split(".").pop()?.split("?")[0] || "jpg";
    const filename = images.length === 1 ? `${baseName}.${ext}` : `${baseName}-${i + 1}.${ext}`;
    await downloadPostImage(images[i], filename);
    if (images.length > 1) await new Promise(r => setTimeout(r, 500));
  }
}

function CopyButton({ text, testId }: { text: string; testId: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
      data-testid={testId}
      title="Copiar legenda"
    >
      {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
    </Button>
  );
}

export default function PostList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | undefined>(undefined);
  const [deletingPostId, setDeletingPostId] = useState<number | null>(null);
  const [collapsedClients, setCollapsedClients] = useState<Set<string>>(new Set());

  const [scheduleStep, setScheduleStep] = useState<"closed" | "select" | "form">("closed");
  const [selectedApproval, setSelectedApproval] = useState<ApprovalPost | null>(null);
  const [selectedKanbanCard, setSelectedKanbanCard] = useState<KanbanApprovedCard | null>(null);

  const [scheduleDate, setScheduleDate] = useState<Date | undefined>(undefined);
  const [scheduleTime, setScheduleTime] = useState("10:00");
  const [schedulePlatforms, setSchedulePlatforms] = useState<string[]>([]);
  const [scheduleCaption, setScheduleCaption] = useState("");
  const [scheduleStatus, setScheduleStatus] = useState("Agendado");
  const [scheduleNotes, setScheduleNotes] = useState("");

  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const clientParam = new URLSearchParams(searchString).get("client") || undefined;

  const { data: clientsList = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });
  const activeClientName = clientParam
    ? clientsList.find(c => c.id === Number(clientParam))?.name
    : undefined;

  const { data: posts, isLoading } = usePosts({
    search: searchTerm,
    status: statusFilter !== "all" ? statusFilter : undefined,
    client: clientParam,
  });

  const { data: approvedPosts = [], isLoading: loadingApproved } = useQuery<ApprovalPost[]>({
    queryKey: ["/api/approvals/approved"],
    enabled: scheduleStep === "select",
  });

  const { data: approvedKanbanCards = [], isLoading: loadingKanbanCards } = useQuery<KanbanApprovedCard[]>({
    queryKey: ["/api/kanban/approved-cards"],
    enabled: scheduleStep === "select",
  });

  const deletePost = useDeletePost();
  const { toast } = useToast();

  const importMutation = useMutation({
    mutationFn: async (data: {
      approvalPostId: number;
      scheduledDate: string;
      platform: string[];
      content: string;
      status: string;
      notes: string;
    }) => {
      const res = await apiRequest("POST", "/api/posts/import-approval", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/approvals/approved"] });
      toast({ title: "Post agendado com sucesso!", description: "O post aprovado foi adicionado ao agendamento." });
      resetScheduleFlow();
    },
    onError: () => {
      toast({ title: "Erro ao agendar", description: "Não foi possível agendar o post.", variant: "destructive" });
    },
  });

  const importKanbanMutation = useMutation({
    mutationFn: async (data: {
      kanbanCardId: number;
      scheduledDate: string;
      platform: string[];
      content: string;
      status: string;
      notes: string;
    }) => {
      const res = await apiRequest("POST", "/api/posts/import-kanban-card", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/kanban/approved-cards"] });
      toast({ title: "Post agendado com sucesso!", description: "O card aprovado foi adicionado ao agendamento." });
      resetScheduleFlow();
    },
    onError: () => {
      toast({ title: "Erro ao agendar", description: "Não foi possível agendar o post.", variant: "destructive" });
    },
  });

  const resetScheduleFlow = () => {
    setScheduleStep("closed");
    setSelectedApproval(null);
    setSelectedKanbanCard(null);
    setScheduleDate(undefined);
    setScheduleTime("10:00");
    setSchedulePlatforms([]);
    setScheduleCaption("");
    setScheduleStatus("Agendado");
    setScheduleNotes("");
  };

  const handleSelectApproval = (ap: ApprovalPost) => {
    setSelectedApproval(ap);
    setScheduleCaption(ap.captionSuggestion || ap.caption || "");
    setSchedulePlatforms(ap.platform || []);
    if (ap.scheduledDate) {
      const d = new Date(ap.scheduledDate);
      setScheduleDate(d);
      setScheduleTime(format(d, "HH:mm"));
    } else {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setScheduleDate(tomorrow);
      setScheduleTime("10:00");
    }
    setSelectedKanbanCard(null);
    setScheduleStep("form");
  };

  const handleSelectKanbanCard = (card: KanbanApprovedCard) => {
    setSelectedKanbanCard(card);
    setScheduleCaption(card.caption || "");
    if (card.platform) {
      if (card.platform === "Todas") {
        setSchedulePlatforms(["Instagram", "Facebook", "LinkedIn", "TikTok"]);
      } else {
        setSchedulePlatforms([card.platform]);
      }
    } else {
      setSchedulePlatforms([]);
    }
    if (card.publishDate) {
      const d = new Date(card.publishDate);
      if (!isNaN(d.getTime())) {
        setScheduleDate(d);
        setScheduleTime(format(d, "HH:mm"));
      } else {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setScheduleDate(tomorrow);
        setScheduleTime("10:00");
      }
    } else {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setScheduleDate(tomorrow);
      setScheduleTime("10:00");
    }
    setSelectedApproval(null);
    setScheduleStep("form");
  };

  const handleSubmitSchedule = () => {
    if ((!selectedApproval && !selectedKanbanCard) || !scheduleDate) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }
    if (schedulePlatforms.length === 0) {
      toast({ title: "Selecione ao menos uma plataforma", variant: "destructive" });
      return;
    }

    const [hours, minutes] = scheduleTime.split(":").map(Number);
    const dateTime = new Date(scheduleDate);
    dateTime.setHours(hours, minutes, 0, 0);

    if (selectedKanbanCard) {
      importKanbanMutation.mutate({
        kanbanCardId: selectedKanbanCard.id,
        scheduledDate: dateTime.toISOString(),
        platform: schedulePlatforms,
        content: scheduleCaption,
        status: scheduleStatus,
        notes: scheduleNotes,
      });
    } else if (selectedApproval) {
      importMutation.mutate({
        approvalPostId: selectedApproval.id,
        scheduledDate: dateTime.toISOString(),
        platform: schedulePlatforms,
        content: scheduleCaption,
        status: scheduleStatus,
        notes: scheduleNotes,
      });
    }
  };

  const handleEdit = (post: Post) => {
    setEditingPost(post);
    setIsEditDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    setDeletingPostId(id);
  };

  const confirmDelete = async () => {
    if (deletingPostId) {
      await deletePost.mutateAsync(deletingPostId);
      setDeletingPostId(null);
    }
  };

  const handleCreateManual = () => {
    setEditingPost(undefined);
    setIsEditDialogOpen(true);
  };

  const togglePlatform = (platform: string) => {
    setSchedulePlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]
    );
  };

  const approvalImages = useMemo(() => {
    if (!selectedApproval) return [];
    if (selectedApproval.imageUrls && selectedApproval.imageUrls.length > 0) {
      return selectedApproval.imageUrls;
    }
    return [selectedApproval.imageUrl];
  }, [selectedApproval]);

  const groupedByClient = useMemo(() => {
    if (!posts) return [];
    const groups: Record<string, { clientName: string; clientId: number | null; posts: Post[] }> = {};
    for (const post of posts) {
      const key = post.clientName || "Sem Cliente";
      if (!groups[key]) {
        groups[key] = { clientName: key, clientId: post.clientId, posts: [] };
      }
      groups[key].posts.push(post);
    }
    return Object.values(groups).sort((a, b) => a.clientName.localeCompare(b.clientName));
  }, [posts]);

  const toggleClient = (clientName: string) => {
    setCollapsedClients((prev) => {
      const next = new Set(prev);
      if (next.has(clientName)) next.delete(clientName);
      else next.add(clientName);
      return next;
    });
  };

  return (
    <div className="space-y-8">
      <div className="page-header">
        <div>
          <h1 className="section-title" data-testid="text-page-title">Agendamentos</h1>
          <p className="section-subtitle">Agende posts aprovados e gerencie suas publicações.</p>
          {activeClientName && (
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="text-xs no-default-hover-elevate no-default-active-elevate" data-testid="badge-client-filter">
                <Users className="w-3 h-3 mr-1" />
                {activeClientName}
                <button
                  onClick={() => setLocation("/posts")}
                  className="ml-1.5 rounded-full hover-elevate"
                  data-testid="button-clear-client-filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={handleCreateManual} data-testid="button-manual-post">
            <Plus className="w-4 h-4 mr-2" /> Criar Manual
          </Button>
          <Button onClick={() => setScheduleStep("select")} data-testid="button-schedule-approved">
            <CalendarCheck className="w-4 h-4 mr-2" /> Agendar Aprovado
          </Button>
        </div>
      </div>

      <Card className="p-5">
        <div className="flex flex-col md:flex-row gap-3 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente, título..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search-posts"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-[180px]" data-testid="select-status-filter">
              <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="Rascunho">Rascunho</SelectItem>
              <SelectItem value="Agendado">Agendado</SelectItem>
              <SelectItem value="Publicado">Publicado</SelectItem>
              <SelectItem value="Cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent"></div>
        </div>
      ) : posts?.length === 0 ? (
        <Card className="p-8">
          <div className="text-center text-muted-foreground">
            <CalendarCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhum post encontrado.</p>
            <p className="text-xs mt-1">Clique em "Agendar Aprovado" para começar.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {groupedByClient.map((group) => {
            const isCollapsed = collapsedClients.has(group.clientName);
            const statusCounts = {
              Agendado: group.posts.filter(p => p.status === "Agendado").length,
              Publicado: group.posts.filter(p => p.status === "Publicado").length,
              Rascunho: group.posts.filter(p => p.status === "Rascunho").length,
            };
            return (
              <div key={group.clientName} data-testid={`group-client-${group.clientName}`}>
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-md bg-muted/50 hover-elevate"
                  onClick={() => toggleClient(group.clientName)}
                  data-testid={`button-toggle-client-${group.clientName}`}
                >
                  {isCollapsed ? (
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                  <div className="flex items-center gap-2 min-w-0">
                    <Users className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="font-semibold text-sm truncate">{group.clientName}</span>
                  </div>
                  <div className="flex items-center gap-2 ml-auto shrink-0">
                    <Badge variant="secondary" className="text-[10px] no-default-hover-elevate no-default-active-elevate">
                      {group.posts.length} {group.posts.length === 1 ? "post" : "posts"}
                    </Badge>
                    {statusCounts.Agendado > 0 && (
                      <Badge variant="outline" className="text-[10px] no-default-hover-elevate no-default-active-elevate">
                        {statusCounts.Agendado} agendado{statusCounts.Agendado > 1 ? "s" : ""}
                      </Badge>
                    )}
                    {statusCounts.Publicado > 0 && (
                      <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 no-default-hover-elevate no-default-active-elevate">
                        {statusCounts.Publicado} publicado{statusCounts.Publicado > 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>
                </button>

                {!isCollapsed && (
                  <div className="mt-2 space-y-2 pl-2">
                    {group.posts.map((post) => {
                      const images = getPostMediaUrls(post);
                      return (
                        <Card key={post.id} className="overflow-visible" data-testid={`card-post-${post.id}`}>
                          <div className="p-4">
                            <div className="flex gap-3">
                              {images.length > 0 && (
                                <div className="w-14 h-14 rounded-md overflow-hidden bg-muted shrink-0">
                                  <img
                                    src={images[0]}
                                    alt={post.title}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                    data-testid={`img-post-${post.id}`}
                                  />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="font-semibold text-sm truncate" data-testid={`text-post-title-${post.id}`}>
                                      {post.title}
                                    </p>
                                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                      <span className="text-xs text-muted-foreground flex items-center gap-1" data-testid={`text-post-date-${post.id}`}>
                                        <Clock className="w-3 h-3" />
                                        {format(new Date(post.scheduledDate), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                      </span>
                                      {images.length > 1 && (
                                        <span className="text-xs text-muted-foreground">
                                          {images.length} imagens
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <StatusBadge status={post.status} />
                                </div>

                                {(Array.isArray(post.platform) ? post.platform : [post.platform]).length > 0 && (
                                  <div className="flex gap-1 flex-wrap mt-2">
                                    {(Array.isArray(post.platform) ? post.platform : [post.platform]).map((p: string) => (
                                      <div key={p} className="flex items-center gap-1" title={p}>
                                        <PlatformIcon platform={p} />
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {post.content && (
                                  <p className="text-xs text-muted-foreground mt-1.5 line-clamp-1" data-testid={`text-post-content-${post.id}`}>
                                    {post.content}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-border">
                              <div className="flex items-center gap-1">
                                {images.length > 0 && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => downloadAllPostImages(post)}
                                    data-testid={`button-download-post-${post.id}`}
                                    title="Baixar imagens"
                                  >
                                    <Download className="w-4 h-4" />
                                  </Button>
                                )}
                                {post.content && (
                                  <CopyButton text={post.content} testId={`button-copy-post-${post.id}`} />
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEdit(post)}
                                  data-testid={`button-edit-post-${post.id}`}
                                  title="Editar"
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDelete(post.id)}
                                  data-testid={`button-delete-post-${post.id}`}
                                  title="Excluir"
                                  className="text-destructive"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPost ? "Editar Post" : "Criar Post Manual"}</DialogTitle>
            <DialogDescription>
              Preencha os detalhes da publicação abaixo.
            </DialogDescription>
          </DialogHeader>
          <PostForm
            post={editingPost}
            onSuccess={() => setIsEditDialogOpen(false)}
            onCancel={() => setIsEditDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={scheduleStep !== "closed"} onOpenChange={(open) => { if (!open) resetScheduleFlow(); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {scheduleStep === "select" && (
            <>
              <DialogHeader>
                <DialogTitle>Selecionar Material Aprovado</DialogTitle>
                <DialogDescription>
                  Escolha um material aprovado do Kanban para agendar a publicação.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 mt-2">
                {(loadingKanbanCards && loadingApproved) ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (approvedKanbanCards.length === 0 && approvedPosts.length === 0) ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Nenhum material aprovado disponível para agendamento.</p>
                    <p className="text-xs mt-1">Os materiais precisam ser aprovados no Kanban antes de serem agendados.</p>
                  </div>
                ) : (
                  <>
                    {approvedKanbanCards.map((card) => (
                      <Card
                        key={`kanban-${card.id}`}
                        className={cn(
                          "overflow-visible cursor-pointer",
                          card.alreadyScheduled ? "opacity-60" : "hover-elevate"
                        )}
                        onClick={() => !card.alreadyScheduled && handleSelectKanbanCard(card)}
                        data-testid={`card-select-kanban-${card.id}`}
                      >
                        <div className="flex gap-4 p-4">
                          {card.imageUrl ? (
                            <div className="w-20 h-20 rounded-md overflow-hidden bg-muted flex-shrink-0">
                              <img src={card.imageUrl} alt={card.title} className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className="w-20 h-20 rounded-md bg-muted flex-shrink-0 flex items-center justify-center">
                              <ImageIcon className="w-8 h-8 text-muted-foreground/30" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm truncate">{card.title}</span>
                              <StatusBadge status="Aprovado" />
                              {card.alreadyScheduled && (
                                <Badge variant="secondary" className="text-[10px] no-default-hover-elevate no-default-active-elevate">
                                  Já agendado
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">{card.clientName}</p>
                            {card.caption && (
                              <p className="text-xs text-muted-foreground line-clamp-2">{card.caption}</p>
                            )}
                            {card.platform && (
                              <div className="flex gap-1 flex-wrap">
                                <PlatformIcon platform={card.platform} />
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                    {approvedPosts.map((ap) => {
                      const images = ap.imageUrls && ap.imageUrls.length > 0 ? ap.imageUrls : [ap.imageUrl];
                      return (
                        <Card
                          key={`approval-${ap.id}`}
                          className="overflow-visible hover-elevate cursor-pointer"
                          onClick={() => handleSelectApproval(ap)}
                          data-testid={`card-select-approval-${ap.id}`}
                        >
                          <div className="flex gap-4 p-4">
                            <div className="w-20 h-20 rounded-md overflow-hidden bg-muted flex-shrink-0">
                              <img src={images[0]} alt={ap.title} className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-1 min-w-0 space-y-1.5">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm truncate">{ap.title}</span>
                                <StatusBadge status="Aprovado" />
                                {images.length > 1 && (
                                  <Badge variant="secondary" className="text-[10px] no-default-hover-elevate no-default-active-elevate">
                                    {images.length} imagens
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">{ap.clientName}</p>
                              {ap.caption && (
                                <p className="text-xs text-muted-foreground line-clamp-2">{ap.caption}</p>
                              )}
                              {ap.platform && ap.platform.length > 0 && (
                                <div className="flex gap-1 flex-wrap">
                                  {ap.platform.map((p) => (
                                    <PlatformIcon key={p} platform={p} />
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </>
                )}
              </div>
            </>
          )}

          {scheduleStep === "form" && (selectedApproval || selectedKanbanCard) && (
            <>
              <DialogHeader>
                <DialogTitle>Agendar Publicação</DialogTitle>
                <DialogDescription>
                  Configure os detalhes do agendamento para "{selectedKanbanCard?.title || selectedApproval?.title}"
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 mt-2">
                <div className="flex gap-4 p-4 rounded-md bg-muted/50">
                  {selectedKanbanCard ? (
                    selectedKanbanCard.imageUrl ? (
                      <div className="w-16 h-16 rounded-md overflow-hidden bg-muted flex-shrink-0">
                        <img src={selectedKanbanCard.imageUrl} alt={selectedKanbanCard.title} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-md bg-muted flex-shrink-0 flex items-center justify-center">
                        <ImageIcon className="w-6 h-6 text-muted-foreground/30" />
                      </div>
                    )
                  ) : selectedApproval ? (
                    <div className="w-16 h-16 rounded-md overflow-hidden bg-muted flex-shrink-0">
                      <img src={approvalImages[0]} alt={selectedApproval.title} className="w-full h-full object-cover" />
                    </div>
                  ) : null}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{selectedKanbanCard?.title || selectedApproval?.title}</p>
                    <p className="text-xs text-muted-foreground">{selectedKanbanCard?.clientName || selectedApproval?.clientName}</p>
                    {selectedApproval && approvalImages.length > 1 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {approvalImages.length} imagens no carrossel
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setScheduleStep("select")}
                    data-testid="button-change-approval"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                    Trocar
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Data de Publicação</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !scheduleDate && "text-muted-foreground"
                          )}
                          data-testid="button-schedule-date"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {scheduleDate ? format(scheduleDate, "PPP", { locale: ptBR }) : "Selecione a data"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={scheduleDate}
                          onSelect={setScheduleDate}
                          locale={ptBR}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label>Horário</Label>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <Input
                        type="time"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        className="flex-1"
                        data-testid="input-schedule-time"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Plataformas</Label>
                  <div className="flex flex-wrap gap-3">
                    {ALL_PLATFORMS.map((p) => {
                      const isChecked = schedulePlatforms.includes(p.value);
                      return (
                        <label
                          key={p.value}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() => togglePlatform(p.value)}
                            data-testid={`checkbox-schedule-platform-${p.value.toLowerCase()}`}
                          />
                          <span className="flex items-center gap-1.5 text-sm">
                            <p.icon className={cn("w-4 h-4", p.color)} />
                            {p.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {schedulePlatforms.length === 0 && (
                    <p className="text-xs text-destructive">Selecione ao menos uma plataforma</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Legenda / Copy</Label>
                  <Textarea
                    value={scheduleCaption}
                    onChange={(e) => setScheduleCaption(e.target.value)}
                    placeholder="Texto da legenda do post"
                    className="min-h-[100px] resize-none"
                    data-testid="textarea-schedule-caption"
                  />
                  <p className="text-xs text-muted-foreground">
                    A legenda aprovada foi carregada automaticamente. Edite se necessário.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={scheduleStatus} onValueChange={setScheduleStatus}>
                      <SelectTrigger data-testid="select-schedule-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Agendado">Agendado</SelectItem>
                        <SelectItem value="Rascunho">Rascunho</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Observações Internas</Label>
                    <Input
                      value={scheduleNotes}
                      onChange={(e) => setScheduleNotes(e.target.value)}
                      placeholder="Notas internas sobre o agendamento"
                      data-testid="input-schedule-notes"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button variant="outline" onClick={resetScheduleFlow} data-testid="button-cancel-schedule">
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleSubmitSchedule}
                    disabled={importMutation.isPending || importKanbanMutation.isPending || !scheduleDate || schedulePlatforms.length === 0}
                    data-testid="button-submit-schedule"
                  >
                    {(importMutation.isPending || importKanbanMutation.isPending) ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <CalendarCheck className="w-4 h-4 mr-2" />
                    )}
                    Agendar Publicação
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deletingPostId !== null} onOpenChange={(open) => !open && setDeletingPostId(null)}>
        <AlertDialogContent data-testid="dialog-confirm-delete-post">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Post</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este post? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-post"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
