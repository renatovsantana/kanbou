/**
 * @module error-reports
 * Error-reports page for tracking and resolving application bugs.
 * Users can submit new error reports with severity and type classifications,
 * and admins can update status or mark them as resolved.
 */
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertTriangle, Bug, CheckCircle, Clock, Plus, MessageSquare, XCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

/** Shape of an error report record from the API. */
interface ErrorReport {
  id: number;
  reporterUserId: number | null;
  route: string | null;
  menu: string | null;
  description: string;
  severity: string | null;
  errorType: string | null;
  stack: string | null;
  userAgent: string | null;
  status: string | null;
  resolvedBy: number | null;
  resolvedAt: string | null;
  resolution: string | null;
  createdAt: string;
}

/** Badge variant and label mapping for each severity level. */
const SEVERITY_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  low: { label: "Baixa", variant: "secondary" },
  medium: { label: "Média", variant: "default" },
  high: { label: "Alta", variant: "destructive" },
  critical: { label: "Crítica", variant: "destructive" },
};

/** Icon and label mapping for each error-report status. */
const STATUS_CONFIG: Record<string, { label: string; icon: any }> = {
  aberto: { label: "Aberto", icon: AlertTriangle },
  em_andamento: { label: "Em Andamento", icon: Clock },
  resolvido: { label: "Resolvido", icon: CheckCircle },
  ignorado: { label: "Ignorado", icon: XCircle },
};

/**
 * Page component for viewing, creating, and managing error reports.
 * Displays a filterable list of reports with severity badges and status icons.
 */
export default function ErrorReportsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newReport, setNewReport] = useState({
    description: "",
    route: "",
    menu: "",
    severity: "medium",
    errorType: "user_report",
  });

  const errorReportsUrl = statusFilter !== "all" ? `/api/error-reports?status=${statusFilter}` : "/api/error-reports";
  const { data: reports = [], isLoading } = useQuery<ErrorReport[]>({
    queryKey: [errorReportsUrl],
  });

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/error-reports", newReport),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [errorReportsUrl] });
      setDialogOpen(false);
      setNewReport({ description: "", route: "", menu: "", severity: "medium", errorType: "user_report" });
      toast({ title: "Relatório de erro criado com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao criar relatório", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: number; updates: any }) => apiRequest("PATCH", `/api/error-reports/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [errorReportsUrl] });
      toast({ title: "Relatório atualizado" });
    },
  });

  const openCount = reports.filter((r) => r.status === "aberto").length;
  const inProgressCount = reports.filter((r) => r.status === "em_andamento").length;
  const resolvedCount = reports.filter((r) => r.status === "resolvido").length;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h1 className="text-3xl font-bold text-foreground" data-testid="text-page-title">
                Relatórios de Erro
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Acompanhe e gerencie problemas reportados no sistema
              </p>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-new-error-report">
                  <Plus className="w-4 h-4 mr-2" />
                  Reportar Problema
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Reportar um Problema</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-2">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Descrição do problema *</label>
                    <Textarea
                      value={newReport.description}
                      onChange={(e) => setNewReport({ ...newReport, description: e.target.value })}
                      placeholder="Descreva o problema encontrado..."
                      data-testid="input-error-description"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium mb-1 block">Menu / Página</label>
                      <Input
                        value={newReport.menu}
                        onChange={(e) => setNewReport({ ...newReport, menu: e.target.value })}
                        placeholder="Ex: Kanban, Dashboard"
                        data-testid="input-error-menu"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Severidade</label>
                      <Select value={newReport.severity} onValueChange={(v) => setNewReport({ ...newReport, severity: v })}>
                        <SelectTrigger data-testid="select-error-severity">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Baixa</SelectItem>
                          <SelectItem value="medium">Média</SelectItem>
                          <SelectItem value="high">Alta</SelectItem>
                          <SelectItem value="critical">Crítica</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button
                    onClick={() => createMutation.mutate()}
                    disabled={!newReport.description || createMutation.isPending}
                    className="w-full"
                    data-testid="button-submit-error-report"
                  >
                    {createMutation.isPending ? "Enviando..." : "Enviar Relatório"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card data-testid="card-open-errors">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">Abertos</CardTitle>
                <AlertTriangle className="w-4 h-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600">{openCount}</div>
              </CardContent>
            </Card>
            <Card data-testid="card-progress-errors">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">Em Andamento</CardTitle>
                <Clock className="w-4 h-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{inProgressCount}</div>
              </CardContent>
            </Card>
            <Card data-testid="card-resolved-errors">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">Resolvidos</CardTitle>
                <CheckCircle className="w-4 h-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{resolvedCount}</div>
              </CardContent>
            </Card>
          </div>

          <div className="flex items-center gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]" data-testid="select-status-filter">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="aberto">Abertos</SelectItem>
                <SelectItem value="em_andamento">Em Andamento</SelectItem>
                <SelectItem value="resolvido">Resolvidos</SelectItem>
                <SelectItem value="ignorado">Ignorados</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">Carregando...</p>
            </div>
          ) : reports.length === 0 ? (
            <Card className="p-12 text-center">
              <Bug className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">Nenhum relatório de erro encontrado</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => {
                const severity = SEVERITY_CONFIG[report.severity || "medium"] || SEVERITY_CONFIG.medium;
                const status = STATUS_CONFIG[report.status || "aberto"] || STATUS_CONFIG.aberto;
                const StatusIcon = status.icon;

                return (
                  <Card key={report.id} data-testid={`error-report-${report.id}`}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <Badge variant={severity.variant}>{severity.label}</Badge>
                            <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate">
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {status.label}
                            </Badge>
                            {report.menu && (
                              <Badge variant="outline" className="text-xs no-default-hover-elevate no-default-active-elevate">
                                {report.menu}
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              #{report.id} - {format(new Date(report.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                          <p className="text-sm" data-testid={`text-error-desc-${report.id}`}>{report.description}</p>
                          {report.resolution && (
                            <div className="mt-2 p-2 rounded-md bg-green-50 dark:bg-green-950/30 text-sm">
                              <p className="font-medium text-green-700 dark:text-green-400 text-xs mb-1">Resolução:</p>
                              <p className="text-green-600 dark:text-green-300">{report.resolution}</p>
                            </div>
                          )}
                        </div>
                        {user?.role === "admin" && report.status !== "resolvido" && (
                          <div className="flex flex-col gap-1 shrink-0">
                            {report.status === "aberto" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => updateMutation.mutate({ id: report.id, updates: { status: "em_andamento" } })}
                                data-testid={`button-progress-${report.id}`}
                              >
                                Em Andamento
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const resolution = window.prompt("Descreva a resolução:");
                                if (resolution) {
                                  updateMutation.mutate({ id: report.id, updates: { status: "resolvido", resolution } });
                                }
                              }}
                              data-testid={`button-resolve-${report.id}`}
                            >
                              Resolver
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
