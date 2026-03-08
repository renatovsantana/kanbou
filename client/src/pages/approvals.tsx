import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useUpload } from "@/hooks/use-upload";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSearch } from "wouter";
import { insertApprovalPostSchema } from "@shared/schema";
import type { ApprovalPost, Client } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Label } from "@/components/ui/label";
import {
  Plus,
  CheckCircle2,
  CheckSquare,
  Clock,
  AlertCircle,
  Eye,
  Trash2,
  Pencil,
  Undo2,
  X as XIcon,
  Upload,
  Loader2,
  Search,
  ChevronDown,
  ChevronRight,
  Users,
  Type,
  MessageSquare,
  History,
  RefreshCw,
  CheckCheck,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Move,
  ArrowLeft,
  CalendarDays,
  Download,
  Copy,
  Check,
} from "lucide-react";

/** Available social media platform options for approval posts */
const PLATFORM_OPTIONS = [
  { value: "Instagram", label: "Instagram" },
  { value: "Facebook", label: "Facebook" },
  { value: "LinkedIn", label: "LinkedIn" },
  { value: "TikTok", label: "TikTok" },
  { value: "Blog", label: "Blog" },
  { value: "Twitter/X", label: "Twitter/X" },
  { value: "YouTube", label: "YouTube" },
  { value: "Pinterest", label: "Pinterest" },
];

/** Zod schema for validating the approval post creation/edit form */
const approvalFormSchema = insertApprovalPostSchema.extend({
  clientId: z.coerce.number().min(1, "Selecione um cliente"),
  title: z.string().min(1, "Título é obrigatório"),
  imageUrl: z.string().min(1, "Imagem é obrigatória"),
  imageUrls: z.array(z.string()).optional().nullable(),
  platform: z.array(z.string()).optional().nullable(),
  scheduledDate: z.coerce.date().nullable().optional(),
});

/** Inferred type from the approval form validation schema */
type ApprovalFormValues = z.infer<typeof approvalFormSchema>;

/** Available drawing tools for the annotation canvas */
type AnnotationTool = "pencil" | "arrow" | "circle" | "text";

/** A 2D point used in annotation drawings */
interface DrawPoint {
  x: number;
  y: number;
}

/** A single annotation drawn on the canvas (path, shape, or text) */
interface Annotation {
  tool: AnnotationTool;
  color: string;
  points: DrawPoint[];
  width: number;
  text?: string;
}

/** V2 annotation data format that stores original image dimensions for scale-independent annotations */
interface AnnotationDataV2 {
  v: 2;
  imgW: number;
  imgH: number;
  data: Annotation[];
}

/**
 * Parses raw annotation JSON into structured annotation data.
 * Supports both V1 (plain array) and V2 (with image dimensions) formats.
 */
function parseAnnotations(raw: string | null | undefined): { annotations: Annotation[]; imgW: number; imgH: number; isV2: boolean } {
  if (!raw) return { annotations: [], imgW: 0, imgH: 0, isV2: false };
  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.v === 2 && Array.isArray(parsed.data)) {
      return { annotations: parsed.data, imgW: parsed.imgW, imgH: parsed.imgH, isV2: true };
    }
    if (Array.isArray(parsed)) {
      return { annotations: parsed, imgW: 0, imgH: 0, isV2: false };
    }
    return { annotations: [], imgW: 0, imgH: 0, isV2: false };
  } catch {
    return { annotations: [], imgW: 0, imgH: 0, isV2: false };
  }
}

/** Converts annotation points from canvas coordinates to original image coordinates */
function toImageSpace(ann: Annotation, canvasW: number, canvasH: number, imgW: number, imgH: number): Annotation {
  const scale = Math.min(canvasW / imgW, canvasH / imgH);
  const offsetX = (canvasW - imgW * scale) / 2;
  const offsetY = (canvasH - imgH * scale) / 2;
  return {
    ...ann,
    points: ann.points.map(p => ({
      x: (p.x - offsetX) / scale,
      y: (p.y - offsetY) / scale,
    })),
  };
}

/** Converts annotation points from original image coordinates to canvas coordinates */
function fromImageSpace(ann: Annotation, canvasW: number, canvasH: number, imgW: number, imgH: number): Annotation {
  const scale = Math.min(canvasW / imgW, canvasH / imgH);
  const offsetX = (canvasW - imgW * scale) / 2;
  const offsetY = (canvasH - imgH * scale) / 2;
  return {
    ...ann,
    points: ann.points.map(p => ({
      x: p.x * scale + offsetX,
      y: p.y * scale + offsetY,
    })),
  };
}

/** Renders a single annotation (pencil, arrow, circle, or text) onto a canvas 2D context */
function drawAnnotationOnCtx(ctx: CanvasRenderingContext2D, ann: Annotation) {
  ctx.strokeStyle = ann.color;
  ctx.fillStyle = ann.color;
  ctx.lineWidth = ann.width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (ann.tool === "text" && ann.text && ann.points.length >= 1) {
    const pos = ann.points[0];
    ctx.font = "bold 16px Inter, sans-serif";
    const padding = 6;
    const metrics = ctx.measureText(ann.text);
    const textHeight = 18;
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.beginPath();
    ctx.roundRect(
      pos.x - padding,
      pos.y - textHeight - padding,
      metrics.width + padding * 2,
      textHeight + padding * 2,
      4
    );
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.fillText(ann.text, pos.x, pos.y);
  } else if (ann.tool === "pencil" && ann.points.length > 1) {
    ctx.beginPath();
    ctx.moveTo(ann.points[0].x, ann.points[0].y);
    for (let i = 1; i < ann.points.length; i++) {
      ctx.lineTo(ann.points[i].x, ann.points[i].y);
    }
    ctx.stroke();
  } else if (ann.tool === "arrow" && ann.points.length === 2) {
    const [start, end] = ann.points;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const headLen = 15;
    ctx.beginPath();
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(end.x - headLen * Math.cos(angle - Math.PI / 6), end.y - headLen * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(end.x - headLen * Math.cos(angle + Math.PI / 6), end.y - headLen * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
  } else if (ann.tool === "circle" && ann.points.length === 2) {
    const [start, end] = ann.points;
    const rx = Math.abs(end.x - start.x) / 2;
    const ry = Math.abs(end.y - start.y) / 2;
    const cx = (start.x + end.x) / 2;
    const cy = (start.y + end.y) / 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/**
 * AnnotationOverlay - Renders an image with annotation drawings overlaid on a canvas.
 * Used for displaying client annotations on approval post images.
 */
function AnnotationOverlay({
  imageUrl,
  annotations,
}: {
  imageUrl: string;
  annotations: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  const parsed = useMemo(() => parseAnnotations(annotations), [annotations]);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      setImageLoaded(true);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const ctx = canvas?.getContext("2d");
    const img = imgRef.current;
    if (!canvas || !container || !ctx || !img) return;

    canvas.width = container.offsetWidth;
    canvas.height = container.offsetHeight;

    const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
    const x = (canvas.width - img.width * scale) / 2;
    const y = (canvas.height - img.height * scale) / 2;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

    parsed.annotations.forEach((ann) => {
      if (parsed.isV2) {
        const transformed = fromImageSpace(ann, canvas.width, canvas.height, img.width, img.height);
        drawAnnotationOnCtx(ctx, transformed);
      } else {
        drawAnnotationOnCtx(ctx, ann);
      }
    });
  }, [parsed, imageLoaded]);

  useEffect(() => {
    if (imageLoaded) redraw();
  }, [imageLoaded, redraw]);

  useEffect(() => {
    const handleResize = () => { if (imageLoaded) redraw(); };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [imageLoaded, redraw]);

  if (parsed.annotations.length === 0) {
    return (
      <img
        src={imageUrl}
        alt="Post"
        className="w-full max-h-96 object-contain bg-muted"
        data-testid="img-view-full"
      />
    );
  }

  return (
    <div ref={containerRef} className="relative bg-muted" style={{ minHeight: 400 }} data-testid="annotation-overlay">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />
    </div>
  );
}

/**
 * ImageLightbox - Full-screen image viewer with zoom/pan controls and annotation overlay.
 * Supports keyboard shortcuts (+/- for zoom, 0 for reset, Escape to close) and mouse wheel zoom.
 */
function ImageLightbox({
  imageUrl,
  annotations,
  title,
  open,
  onClose,
}: {
  imageUrl: string;
  annotations?: string | null;
  title: string;
  open: boolean;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const parsed = useMemo(() => parseAnnotations(annotations), [annotations]);

  useEffect(() => {
    if (!open) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setImageLoaded(false);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      setImageLoaded(true);
    };
    img.src = imageUrl;
  }, [imageUrl, open]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const ctx = canvas?.getContext("2d");
    const img = imgRef.current;
    if (!canvas || !container || !ctx || !img) return;

    canvas.width = container.offsetWidth;
    canvas.height = container.offsetHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width / 2 + pan.x, canvas.height / 2 + pan.y);
    ctx.scale(zoom, zoom);

    const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
    const drawW = img.width * scale;
    const drawH = img.height * scale;

    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);

    if (parsed.annotations.length > 0) {
      const offsetX = -drawW / 2;
      const offsetY = -drawH / 2;
      parsed.annotations.forEach((ann) => {
        let scaledAnn: Annotation;
        if (parsed.isV2) {
          scaledAnn = {
            ...ann,
            points: ann.points.map((p) => ({
              x: offsetX + p.x * scale,
              y: offsetY + p.y * scale,
            })),
          };
        } else {
          scaledAnn = {
            ...ann,
            points: ann.points.map((p) => ({
              x: offsetX + p.x * scale,
              y: offsetY + p.y * scale,
            })),
          };
        }
        drawAnnotationOnCtx(ctx, scaledAnn);
      });
    }

    ctx.restore();
  }, [parsed, imageLoaded, zoom, pan]);

  useEffect(() => {
    if (imageLoaded && open) redraw();
  }, [imageLoaded, redraw, open]);

  useEffect(() => {
    const handleResize = () => { if (imageLoaded && open) redraw(); };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [imageLoaded, redraw, open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(z + 0.25, 5));
      if (e.key === "-") setZoom((z) => Math.max(z - 0.25, 0.25));
      if (e.key === "0") { setZoom(1); setPan({ x: 0, y: 0 }); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    setZoom((z) => Math.max(0.25, Math.min(5, z + delta)));
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    setIsPanning(true);
    panStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [pan]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPanning) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    setPan({ x: panStartRef.current.panX + dx, y: panStartRef.current.panY + dy });
  }, [isPanning]);

  const handlePointerUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black/90"
      data-testid="lightbox-overlay"
    >
      <div className="flex items-center justify-between gap-2 p-3 bg-black/60">
        <span className="text-white text-sm font-medium truncate">{title}</span>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="text-white hover:bg-white/20 no-default-hover-elevate"
            onClick={() => setZoom((z) => Math.max(z - 0.25, 0.25))}
            data-testid="button-zoom-out"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-white text-xs min-w-[3rem] text-center">{Math.round(zoom * 100)}%</span>
          <Button
            size="icon"
            variant="ghost"
            className="text-white hover:bg-white/20 no-default-hover-elevate"
            onClick={() => setZoom((z) => Math.min(z + 0.25, 5))}
            data-testid="button-zoom-in"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="text-white hover:bg-white/20 no-default-hover-elevate"
            onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
            data-testid="button-zoom-reset"
          >
            <Move className="w-4 h-4" />
          </Button>
          <div className="w-px h-5 bg-white/30 mx-1" />
          <Button
            size="icon"
            variant="ghost"
            className="text-white hover:bg-white/20 no-default-hover-elevate"
            onClick={onClose}
            data-testid="button-lightbox-close"
          >
            <XIcon className="w-4 h-4" />
          </Button>
        </div>
      </div>
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden"
        style={{ cursor: isPanning ? "grabbing" : "grab" }}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
        />
      </div>
      {parsed.annotations.length > 0 && (
        <div className="p-2 bg-black/60 text-center">
          <span className="text-white/70 text-xs">
            {parsed.annotations.length} anotação(ões) do cliente visível(is)
          </span>
        </div>
      )}
    </div>
  );
}

/** Renders a colored status badge (Aprovado, Revisão, Revisado, or Pendente) for approval posts */
function ApprovalStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "Aprovado":
      return (
        <Badge variant="default" className="bg-emerald-100 text-emerald-800 border-emerald-200 no-default-hover-elevate no-default-active-elevate" data-testid="badge-status-aprovado">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Aprovado
        </Badge>
      );
    case "Revisão":
      return (
        <Badge variant="default" className="bg-primary/15 text-foreground border-primary/25 no-default-hover-elevate no-default-active-elevate" data-testid="badge-status-revisao">
          <AlertCircle className="w-3 h-3 mr-1" />
          Revisão
        </Badge>
      );
    case "Revisado":
      return (
        <Badge variant="default" className="bg-muted text-muted-foreground border-border no-default-hover-elevate no-default-active-elevate" data-testid="badge-status-revisado">
          <CheckCheck className="w-3 h-3 mr-1" />
          Revisado
        </Badge>
      );
    default:
      return (
        <Badge variant="default" className="bg-muted text-muted-foreground border-border no-default-hover-elevate no-default-active-elevate" data-testid="badge-status-pendente">
          <Clock className="w-3 h-3 mr-1" />
          Pendente
        </Badge>
      );
  }
}

/**
 * AnnotationCanvas - Interactive drawing canvas for creating annotations on post images.
 * Provides pencil, arrow, circle, and text tools with color selection, undo, and clear actions.
 * Saves annotations in V2 format with original image dimensions for resolution independence.
 */
function AnnotationCanvas({
  imageUrl,
  existingAnnotations,
  onSave,
  onClose,
}: {
  imageUrl: string;
  existingAnnotations: string | null;
  onSave: (annotations: string) => void;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [tool, setTool] = useState<AnnotationTool>("pencil");
  const [color, setColor] = useState("#ef4444");
  const [lineWidth] = useState(3);
  const [isDrawing, setIsDrawing] = useState(false);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [currentPoints, setCurrentPoints] = useState<DrawPoint[]>([]);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [textPosition, setTextPosition] = useState<DrawPoint | null>(null);
  const [showTextInput, setShowTextInput] = useState(false);

  const existingParsed = useMemo(() => parseAnnotations(existingAnnotations), [existingAnnotations]);
  const existingLoadedRef = useRef(false);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      setImageLoaded(true);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  useEffect(() => {
    if (!imageLoaded || existingLoadedRef.current) return;
    existingLoadedRef.current = true;
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (existingParsed.annotations.length > 0 && canvas && img) {
      if (existingParsed.isV2) {
        const canvasW = canvas.offsetWidth;
        const canvasH = canvas.offsetHeight;
        const converted = existingParsed.annotations.map(ann =>
          fromImageSpace(ann, canvasW, canvasH, img.width, img.height)
        );
        setAnnotations(converted);
      } else {
        setAnnotations(existingParsed.annotations);
      }
    }
  }, [imageLoaded, existingParsed]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const img = imgRef.current;
    if (!canvas || !ctx || !img) return;

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
    const x = (canvas.width - img.width * scale) / 2;
    const y = (canvas.height - img.height * scale) / 2;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

    annotations.forEach((ann) => drawAnnotationOnCtx(ctx, ann));

    if (currentPoints.length > 0 && tool !== "text") {
      drawAnnotationOnCtx(ctx, { tool, color, points: currentPoints, width: lineWidth });
    }
  }, [annotations, currentPoints, tool, color, lineWidth, imageLoaded]);

  useEffect(() => {
    if (imageLoaded) redraw();
  }, [imageLoaded, redraw]);

  const getPos = (e: React.MouseEvent<HTMLCanvasElement>): DrawPoint => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool === "text") {
      const pos = getPos(e);
      setTextPosition(pos);
      setShowTextInput(true);
      setTextInput("");
      return;
    }
    setIsDrawing(true);
    setCurrentPoints([getPos(e)]);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const pos = getPos(e);
    if (tool === "pencil") {
      setCurrentPoints((prev) => [...prev, pos]);
    } else {
      setCurrentPoints((prev) => [prev[0], pos]);
    }
    redraw();
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentPoints.length > 0) {
      setAnnotations((prev) => [...prev, { tool, color, points: currentPoints, width: lineWidth }]);
      setCurrentPoints([]);
    }
  };

  const handleTextSubmit = () => {
    if (textInput.trim() && textPosition) {
      setAnnotations((prev) => [
        ...prev,
        { tool: "text" as AnnotationTool, color, points: [textPosition], width: lineWidth, text: textInput.trim() },
      ]);
      setShowTextInput(false);
      setTextInput("");
      setTextPosition(null);
    }
  };

  const handleUndo = () => {
    setAnnotations((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setAnnotations([]);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (canvas && img) {
      const normalized = annotations.map(ann =>
        toImageSpace(ann, canvas.offsetWidth, canvas.offsetHeight, img.width, img.height)
      );
      const v2Data: AnnotationDataV2 = { v: 2, imgW: img.width, imgH: img.height, data: normalized };
      onSave(JSON.stringify(v2Data));
    } else {
      onSave(JSON.stringify(annotations));
    }
  };

  const colors = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#000000"];

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1">
          <Button
            variant={tool === "pencil" ? "default" : "outline"}
            size="sm"
            onClick={() => setTool("pencil")}
            data-testid="button-tool-pencil"
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            variant={tool === "arrow" ? "default" : "outline"}
            size="sm"
            onClick={() => setTool("arrow")}
            data-testid="button-tool-arrow"
          >
            &#8599;
          </Button>
          <Button
            variant={tool === "circle" ? "default" : "outline"}
            size="sm"
            onClick={() => setTool("circle")}
            data-testid="button-tool-circle"
          >
            &#9675;
          </Button>
          <Button
            variant={tool === "text" ? "default" : "outline"}
            size="sm"
            onClick={() => setTool("text")}
            data-testid="button-tool-text"
          >
            <Type className="w-4 h-4" />
          </Button>
        </div>

        <div className="h-6 w-px bg-border" />

        <div className="flex gap-1">
          {colors.map((c) => (
            <button
              key={c}
              className={`w-6 h-6 rounded-md border-2 ${color === c ? "border-foreground scale-110" : "border-border"}`}
              style={{ backgroundColor: c }}
              onClick={() => setColor(c)}
              data-testid={`button-color-${c.replace("#", "")}`}
            />
          ))}
        </div>

        <div className="h-6 w-px bg-border" />

        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={handleUndo} data-testid="button-undo">
            <Undo2 className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleClear} data-testid="button-clear">
            <XIcon className="w-4 h-4" />
          </Button>
        </div>

        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={onClose} data-testid="button-annotation-cancel">
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSave} data-testid="button-annotation-save">
            Salvar Anotações
          </Button>
        </div>
      </div>

      {tool === "text" && (
        <p className="text-xs text-muted-foreground">
          Clique na imagem para posicionar o texto
        </p>
      )}

      <div ref={containerRef} className="flex-1 relative bg-muted rounded-md overflow-hidden" style={{ minHeight: 400 }}>
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 w-full h-full ${tool === "text" ? "cursor-text" : "cursor-crosshair"}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          data-testid="canvas-annotation"
        />
        {showTextInput && textPosition && (
          <div
            className="absolute z-10"
            style={{ left: textPosition.x, top: textPosition.y - 40 }}
          >
            <div className="flex gap-1 bg-card border border-border rounded-lg shadow-lg p-2">
              <Input
                autoFocus
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Digite seu texto..."
                className="h-8 text-sm w-48"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleTextSubmit();
                  if (e.key === "Escape") { setShowTextInput(false); setTextInput(""); }
                }}
                data-testid="input-annotation-text"
              />
              <Button size="sm" onClick={handleTextSubmit} data-testid="button-add-text">
                OK
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Returns the array of image URLs for a post, falling back to the single imageUrl */
function getPostImages(post: ApprovalPost): string[] {
  if (post.imageUrls && post.imageUrls.length > 0) {
    return post.imageUrls;
  }
  return [post.imageUrl];
}

/** Downloads a single image by fetching it as a blob and triggering a download */
async function downloadImage(url: string, filename: string) {
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

/** Downloads all images from a post, naming them sequentially for carousel posts */
async function downloadAllImages(post: ApprovalPost) {
  const images = getPostImages(post);
  const baseName = post.title.replace(/[^a-zA-Z0-9À-ú\s-]/g, "").replace(/\s+/g, "-");
  for (let i = 0; i < images.length; i++) {
    const ext = images[i].split(".").pop()?.split("?")[0] || "jpg";
    const filename = images.length === 1
      ? `${baseName}.${ext}`
      : `${baseName}-${i + 1}.${ext}`;
    await downloadImage(images[i], filename);
    if (images.length > 1) await new Promise(r => setTimeout(r, 500));
  }
}

/** Button that copies text to clipboard and shows a check icon briefly upon success */
function CopyButton({ text, testId }: { text: string; testId: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => {
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

/**
 * ApprovalCard - Card component displaying an approval post with thumbnail, status, platforms, and action buttons.
 * Shows different actions based on user role (client vs admin/designer).
 */
function ApprovalCard({
  post,
  onView,
  onAnnotate,
  onReview,
  onResubmit,
  onStatusChange,
  onDelete,
  userRole,
}: {
  post: ApprovalPost;
  onView: (post: ApprovalPost) => void;
  onAnnotate: (post: ApprovalPost) => void;
  onReview: (post: ApprovalPost) => void;
  onResubmit: (post: ApprovalPost) => void;
  onStatusChange: (id: number, status: string) => void;
  onDelete: (id: number) => void;
  userRole: string;
}) {
  const images = getPostImages(post);
  const hasObservations = !!post.observations;

  return (
    <Card className="overflow-visible" data-testid={`card-approval-${post.id}`}>
      <div className="p-4">
        <div className="flex gap-3">
          <div
            className="w-14 h-14 rounded-md overflow-hidden bg-muted shrink-0 cursor-pointer"
            onClick={() => onView(post)}
          >
            <img
              src={images[0]}
              alt={post.title}
              className="w-full h-full object-cover"
              loading="lazy"
              data-testid={`img-approval-${post.id}`}
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate" data-testid={`text-title-${post.id}`}>
                  {post.title}
                </p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {post.scheduledDate && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1" data-testid={`text-date-${post.id}`}>
                      <Clock className="w-3 h-3" />
                      {new Date(post.scheduledDate).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                  {images.length > 1 && (
                    <span className="text-xs text-muted-foreground">
                      {images.length} imagens
                    </span>
                  )}
                  {post.version && post.version > 1 && (
                    <span className="text-xs text-muted-foreground">
                      v{post.version}
                    </span>
                  )}
                </div>
              </div>
              <ApprovalStatusBadge status={post.status} />
            </div>

            {post.platform && post.platform.length > 0 && (
              <div className="flex gap-1 flex-wrap mt-2">
                {post.platform.map((p) => (
                  <Badge key={p} variant="outline" className="text-[10px] no-default-hover-elevate no-default-active-elevate" data-testid={`badge-card-platform-${post.id}-${p}`}>
                    {p}
                  </Badge>
                ))}
              </div>
            )}

            {post.caption && (
              <p className="text-xs text-muted-foreground mt-1.5 line-clamp-1" data-testid={`text-caption-${post.id}`}>
                {post.caption}
              </p>
            )}

            {hasObservations && userRole !== "client" && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-primary">
                <MessageSquare className="w-3 h-3" />
                <span className="truncate">{post.observations}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-border">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onView(post)}
              data-testid={`button-view-${post.id}`}
              title="Visualizar"
            >
              <Eye className="w-4 h-4" />
            </Button>
            {post.status === "Aprovado" && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => downloadAllImages(post)}
                data-testid={`button-download-${post.id}`}
                title="Baixar imagens"
              >
                <Download className="w-4 h-4" />
              </Button>
            )}
            {post.status === "Aprovado" && post.caption && (
              <CopyButton text={post.caption} testId={`button-copy-caption-${post.id}`} />
            )}
            {userRole === "client" && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onAnnotate(post)}
                data-testid={`button-annotate-${post.id}`}
                title="Anotar imagem"
              >
                <Pencil className="w-4 h-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(post.id)}
              data-testid={`button-delete-card-${post.id}`}
              title="Excluir postagem"
              className="text-destructive"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex gap-1.5 items-center">
            {userRole === "client" ? (
              post.status === "Pendente" && (
                <>
                  <Button
                    size="sm"
                    onClick={() => onStatusChange(post.id, "Aprovado")}
                    data-testid={`button-approve-${post.id}`}
                  >
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Aprovar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onReview(post)}
                    data-testid={`button-revision-${post.id}`}
                  >
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Revisão
                  </Button>
                </>
              )
            ) : (
              post.status === "Revisão" && (
                <Button
                  size="sm"
                  onClick={() => onResubmit(post)}
                  data-testid={`button-resubmit-card-${post.id}`}
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Reenviar
                </Button>
              )
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

/**
 * ReviewDialog - Modal for submitting a revision request with observations and caption suggestions.
 * Shows the current image and caption for reference while writing feedback.
 */
function ReviewDialog({
  post,
  open,
  onClose,
  onSubmit,
  isPending,
}: {
  post: ApprovalPost;
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { observations: string; captionSuggestion: string }) => void;
  isPending: boolean;
}) {
  const [observations, setObservations] = useState(post.observations || "");
  const [captionSuggestion, setCaptionSuggestion] = useState(post.captionSuggestion || "");

  useEffect(() => {
    if (open) {
      setObservations(post.observations || "");
      setCaptionSuggestion(post.captionSuggestion || "");
    }
  }, [open, post]);

  const handleSubmit = () => {
    onSubmit({ observations, captionSuggestion });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Solicitar Revisão</DialogTitle>
          <DialogDescription>
            Descreva os ajustes necessários para a postagem "{post.title}"
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="rounded-md overflow-hidden border border-border">
            <img
              src={post.imageUrl}
              alt={post.title}
              className="w-full h-48 object-cover bg-muted"
            />
          </div>

          {post.caption && (
            <div className="rounded-md bg-muted/40 p-3">
              <Label className="text-xs text-muted-foreground mb-1 block">Legenda atual</Label>
              <p className="text-sm">{post.caption}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="review-caption-suggestion" className="flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" />
              Sugestão de ajuste da legenda
            </Label>
            <Textarea
              id="review-caption-suggestion"
              value={captionSuggestion}
              onChange={(e) => setCaptionSuggestion(e.target.value)}
              placeholder="Sugira alterações na legenda do post..."
              rows={3}
              data-testid="input-caption-suggestion"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="review-observations" className="flex items-center gap-1.5">
              <Pencil className="w-3.5 h-3.5" />
              Observações sobre a imagem/conteúdo
            </Label>
            <Textarea
              id="review-observations"
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Descreva os ajustes necessários na imagem ou conteúdo..."
              rows={3}
              data-testid="input-review-observations"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Dica: Você também pode usar o botão de anotação (lápis) no card da postagem para desenhar e marcar ajustes diretamente na imagem.
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} data-testid="button-cancel-review">
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isPending} data-testid="button-submit-review">
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <AlertCircle className="w-4 h-4 mr-2" />
              Enviar para Revisão
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Approvals - Main approval management page for internal users and clients.
 * Internal users see a client overview grid and can create, view, annotate, review, and resubmit posts.
 * Clients see their posts organized by period with approve/revision actions.
 * Supports version history, period-based grouping, status filtering, and search.
 */
export default function Approvals() {
  const { user } = useAuth();
  const { toast } = useToast();
  const searchString = useSearch();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [viewPost, setViewPost] = useState<ApprovalPost | null>(null);
  const [annotatingPost, setAnnotatingPost] = useState<ApprovalPost | null>(null);
  const [reviewingPost, setReviewingPost] = useState<ApprovalPost | null>(null);
  const [resubmitPost, setResubmitPost] = useState<ApprovalPost | null>(null);
  const [lightboxPost, setLightboxPost] = useState<ApprovalPost | null>(null);
  const [viewImageIndex, setViewImageIndex] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [collapsedPeriods, setCollapsedPeriods] = useState<Set<string>>(new Set());
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [deletingApprovalId, setDeletingApprovalId] = useState<number | null>(null);
  const prevSearchRef = useRef(searchString);

  const userRole = user?.role || "admin";

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const clientParam = params.get("client");
    if (clientParam) {
      const clientId = Number(clientParam);
      if (clientId !== selectedClientId || searchString !== prevSearchRef.current) {
        setSelectedClientId(clientId);
      }
    }
    prevSearchRef.current = searchString;
  }, [searchString]);

  useEffect(() => {
    if (userRole === "client" && user?.clientId) {
      setSelectedClientId(user.clientId);
    }
  }, [userRole, user?.clientId]);

  const form = useForm<ApprovalFormValues>({
    resolver: zodResolver(approvalFormSchema),
    defaultValues: {
      clientId: 0,
      clientName: "",
      title: "",
      caption: "",
      imageUrl: "",
      imageUrls: [],
      platform: [],
      observations: "",
      status: "Pendente",
      annotations: "",
      scheduledDate: null,
    },
  });

  const resubmitForm = useForm<ApprovalFormValues>({
    resolver: zodResolver(approvalFormSchema),
    defaultValues: {
      clientId: 0,
      clientName: "",
      title: "",
      caption: "",
      imageUrl: "",
      observations: "",
      status: "Pendente",
      annotations: "",
    },
  });

  const { uploadFile, isUploading } = useUpload({
    onSuccess: (response) => {
      const currentUrls = form.getValues("imageUrls") || [];
      const newUrls = [...currentUrls, response.objectPath];
      form.setValue("imageUrls", newUrls);
      if (!form.getValues("imageUrl")) {
        form.setValue("imageUrl", response.objectPath, { shouldValidate: true });
      }
      toast({ title: "Imagem enviada com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao enviar imagem", variant: "destructive" });
    },
  });

  const { uploadFile: uploadResubmitFile, isUploading: isResubmitUploading } = useUpload({
    onSuccess: (response) => {
      resubmitForm.setValue("imageUrl", response.objectPath, { shouldValidate: true });
      toast({ title: "Imagem enviada com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao enviar imagem", variant: "destructive" });
    },
  });

  const { data: approvals = [], isLoading } = useQuery<ApprovalPost[]>({
    queryKey: ["/api/approvals"],
  });

  const { data: clientsList = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: ApprovalFormValues) => {
      const res = await apiRequest("POST", "/api/approvals", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/approvals"] });
      form.reset();
      setShowCreateDialog(false);
      toast({ title: "Postagem criada para aprovação!" });
    },
    onError: () => {
      toast({ title: "Erro ao criar postagem", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<ApprovalPost> }) => {
      const res = await apiRequest("PUT", `/api/approvals/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/approvals"] });
      toast({ title: "Postagem atualizada!" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar postagem", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/approvals/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/approvals"] });
      setViewPost(null);
      toast({ title: "Postagem removida!" });
    },
    onError: () => {
      toast({ title: "Erro ao remover postagem", variant: "destructive" });
    },
  });

  /** Processes the create form submission, resolving client name and normalizing image URLs */
  const onSubmit = (values: ApprovalFormValues) => {
    const client = clientsList.find((c) => c.id === values.clientId);
    const imageUrls = values.imageUrls && values.imageUrls.length > 0 ? values.imageUrls : [values.imageUrl];
    createMutation.mutate({
      ...values,
      clientName: client?.name || "",
      imageUrl: imageUrls[0],
      imageUrls,
      platform: values.platform && values.platform.length > 0 ? values.platform : null,
    });
  };

  /** Handles file input change for multi-image upload in the create form */
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      for (const file of Array.from(files)) {
        await uploadFile(file);
      }
    }
  };

  /** Updates a post's approval status (Aprovado, Revisão, etc.) */
  const handleStatusChange = (id: number, newStatus: string) => {
    updateMutation.mutate({ id, data: { status: newStatus } });
  };

  /** Saves annotation data for the currently annotated post */
  const handleAnnotationSave = (annotations: string) => {
    if (annotatingPost) {
      updateMutation.mutate({ id: annotatingPost.id, data: { annotations } });
      setAnnotatingPost(null);
    }
  };

  /** Submits a review with observations and caption suggestions, updating the post status to Revisão */
  const handleReviewSubmit = (data: { observations: string; captionSuggestion: string }) => {
    if (reviewingPost) {
      updateMutation.mutate({
        id: reviewingPost.id,
        data: {
          status: "Revisão",
          observations: data.observations,
          captionSuggestion: data.captionSuggestion,
        },
      }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/approvals"] });
          setReviewingPost(null);
          toast({ title: "Revisão enviada com sucesso!" });
        },
      });
    }
  };

  const resubmitMutation = useMutation({
    mutationFn: async ({ originalPost, newData }: { originalPost: ApprovalPost; newData: ApprovalFormValues }) => {
      const newPost = await apiRequest("POST", "/api/approvals", {
        clientId: originalPost.clientId,
        clientName: originalPost.clientName,
        title: newData.title,
        caption: newData.caption,
        imageUrl: newData.imageUrl,
        status: "Pendente",
        parentId: originalPost.id,
        version: (originalPost.version || 1) + 1,
        observations: "",
        annotations: "",
        captionSuggestion: "",
      });
      await apiRequest("PUT", `/api/approvals/${originalPost.id}`, {
        status: "Revisado",
      });
      return newPost.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/approvals"] });
      resubmitForm.reset();
      setResubmitPost(null);
      setViewPost(null);
      toast({ title: "Nova versão enviada com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao reenviar postagem", variant: "destructive" });
    },
  });

  /** Opens the resubmit dialog pre-filled with the original post's data */
  const handleOpenResubmit = (post: ApprovalPost) => {
    setResubmitPost(post);
    resubmitForm.reset({
      clientId: post.clientId || 0,
      clientName: post.clientName,
      title: post.title,
      caption: post.caption || "",
      imageUrl: "",
      observations: "",
      status: "Pendente",
      annotations: "",
    });
  };

  /** Handles file input change for the resubmit form image upload */
  const handleResubmitFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadResubmitFile(file);
    }
  };

  /** Processes the resubmit form, creating a new version and marking the original as Revisado */
  const onResubmitSubmit = (values: ApprovalFormValues) => {
    if (resubmitPost) {
      resubmitMutation.mutate({ originalPost: resubmitPost, newData: values });
    }
  };

  /** Builds the full version history chain for a post by traversing parent/child relationships */
  const getVersionHistory = useCallback((post: ApprovalPost) => {
    const versions: ApprovalPost[] = [];
    let current: ApprovalPost | undefined = post;
    while (current?.parentId) {
      const parent = approvals.find((a) => a.id === current!.parentId);
      if (parent) {
        versions.unshift(parent);
        current = parent;
      } else {
        break;
      }
    }
    versions.push(post);
    const children = approvals.filter((a) => a.parentId === post.id);
    children.sort((a, b) => (a.version || 1) - (b.version || 1));
    versions.push(...children);
    const unique = versions.filter((v, i, arr) => arr.findIndex((a) => a.id === v.id) === i);
    return unique;
  }, [approvals]);

  const resubmitImageUrl = resubmitForm.watch("imageUrl");

  /** Filters approvals by selected client, status, and search term */
  const clientPosts = useMemo(() => {
    if (!selectedClientId) return [];
    let result = approvals.filter((a) => a.clientId === selectedClientId);
    if (statusFilter !== "all") {
      result = result.filter((a) => a.status === statusFilter);
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (a) =>
          a.title.toLowerCase().includes(term) ||
          (a.caption && a.caption.toLowerCase().includes(term))
      );
    }
    return result;
  }, [approvals, selectedClientId, statusFilter, searchTerm]);

  /** Computes status counts for the currently selected client's posts */
  const clientStatusCounts = useMemo(() => {
    const posts = selectedClientId ? approvals.filter((a) => a.clientId === selectedClientId) : approvals;
    return {
      all: posts.length,
      Pendente: posts.filter((a) => a.status === "Pendente").length,
      Aprovado: posts.filter((a) => a.status === "Aprovado").length,
      "Revisão": posts.filter((a) => a.status === "Revisão").length,
      Revisado: posts.filter((a) => a.status === "Revisado").length,
    };
  }, [approvals, selectedClientId]);

  const MONTH_NAMES_PT = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  /** Groups client posts by month/year period and sorts them by status priority */
  const groupedByPeriod = useMemo(() => {
    const groups: Record<string, { label: string; sortKey: string; posts: ApprovalPost[] }> = {};
    for (const post of clientPosts) {
      const date = post.scheduledDate ? new Date(post.scheduledDate) : (post.createdAt ? new Date(post.createdAt) : new Date());
      const year = date.getFullYear();
      const month = date.getMonth();
      const key = `${year}-${String(month).padStart(2, "0")}`;
      if (!groups[key]) {
        groups[key] = {
          label: `${MONTH_NAMES_PT[month]} ${year}`,
          sortKey: key,
          posts: [],
        };
      }
      groups[key].posts.push(post);
    }
    const statusPriority: Record<string, number> = {
      "Pendente": 0,
      "Revisão": 1,
      "Revisado": 2,
      "Aprovado": 3,
    };
    const periods = Object.values(groups).sort((a, b) => b.sortKey.localeCompare(a.sortKey));
    for (const period of periods) {
      period.posts.sort((a, b) => {
        const pa = statusPriority[a.status] ?? 99;
        const pb = statusPriority[b.status] ?? 99;
        return pa - pb;
      });
    }
    return periods;
  }, [clientPosts]);

  /** Aggregates approval data by client for the overview grid (counts, latest dates) */
  const clientOverviewData = useMemo(() => {
    const groups: Record<number, { clientId: number; clientName: string; total: number; pending: number; approved: number; revision: number; latestDate: Date | null }> = {};
    for (const post of approvals) {
      const cid = post.clientId || 0;
      if (!groups[cid]) {
        groups[cid] = { clientId: cid, clientName: post.clientName, total: 0, pending: 0, approved: 0, revision: 0, latestDate: null };
      }
      groups[cid].total++;
      if (post.status === "Pendente") groups[cid].pending++;
      if (post.status === "Aprovado") groups[cid].approved++;
      if (post.status === "Revisão") groups[cid].revision++;
      const d = post.scheduledDate ? new Date(post.scheduledDate) : (post.createdAt ? new Date(post.createdAt) : null);
      if (d && (!groups[cid].latestDate || d > groups[cid].latestDate)) {
        groups[cid].latestDate = d;
      }
    }
    return Object.values(groups).sort((a, b) => a.clientName.localeCompare(b.clientName));
  }, [approvals]);

  /** Resolves the display name for the currently selected client */
  const selectedClientName = useMemo(() => {
    if (!selectedClientId) return "";
    const found = clientsList.find((c) => c.id === selectedClientId);
    if (found) return found.name;
    const fromApprovals = approvals.find((a) => a.clientId === selectedClientId);
    return fromApprovals?.clientName || "";
  }, [selectedClientId, clientsList, approvals]);

  /** Toggles the collapsed state of a period group in the list view */
  const togglePeriodCollapse = (key: string) => {
    setCollapsedPeriods((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const imageUrl = form.watch("imageUrl");
  const imageUrls = form.watch("imageUrls") || [];
  const selectedPlatforms = form.watch("platform") || [];
  const viewImages = viewPost ? getPostImages(viewPost) : [];

  if (annotatingPost) {
    return (
      <div className="h-[calc(100vh-2rem)]">
        <AnnotationCanvas
          imageUrl={annotatingPost.imageUrl}
          existingAnnotations={annotatingPost.annotations}
          onSave={handleAnnotationSave}
          onClose={() => setAnnotatingPost(null)}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          {selectedClientId && userRole !== "client" && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => { setSelectedClientId(null); setStatusFilter("all"); setSearchTerm(""); }}
              data-testid="button-back-clients"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
          )}
          <div>
            <h1 className="section-title" data-testid="text-page-title">
              {selectedClientId ? selectedClientName : "Aprovações"}
            </h1>
            <p className="section-subtitle">
              {selectedClientId
                ? "Postagens organizadas por período"
                : userRole === "client"
                  ? "Revise e aprove as postagens da sua marca"
                  : "Selecione um cliente para ver suas postagens"}
            </p>
          </div>
        </div>
        {(userRole === "admin" || userRole === "designer") && (
          <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-approval">
            <Plus className="w-4 h-4 mr-2" />
            Nova Postagem
          </Button>
        )}
      </div>

      {selectedClientId ? (
        <>
          <Card className="p-4 mb-6">
            <div className="flex flex-col gap-4">
              <div className="flex gap-2 flex-wrap items-center">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por título ou legenda..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                    data-testid="input-search-approvals"
                  />
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {(["all", "Pendente", "Aprovado", "Revisão", "Revisado"] as const).map((s) => (
                  <Button
                    key={s}
                    variant={statusFilter === s ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter(s)}
                    data-testid={`button-filter-${s}`}
                  >
                    {s === "all" ? "Todas" : s}
                    <span className="ml-1.5 text-xs opacity-70">({clientStatusCounts[s]})</span>
                  </Button>
                ))}
              </div>
            </div>
          </Card>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : clientPosts.length === 0 ? (
            <Card className="p-12 text-center">
              <CheckSquare className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-lg font-medium">Nenhuma postagem encontrada</p>
              <p className="text-muted-foreground/70 text-sm mt-1">
                {searchTerm || statusFilter !== "all"
                  ? "Tente ajustar os filtros"
                  : 'Clique em "Nova Postagem" para começar'}
              </p>
            </Card>
          ) : (
            <div className="space-y-6">
              {groupedByPeriod.map((period) => {
                const isCollapsed = collapsedPeriods.has(period.sortKey);
                const pendingCount = period.posts.filter((p) => p.status === "Pendente").length;
                return (
                  <div key={period.sortKey} data-testid={`group-period-${period.sortKey}`}>
                    <button
                      className="flex items-center gap-3 w-full text-left mb-3"
                      onClick={() => togglePeriodCollapse(period.sortKey)}
                      data-testid={`button-toggle-period-${period.sortKey}`}
                    >
                      {isCollapsed ? (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                      <CalendarDays className="w-4 h-4 text-muted-foreground" />
                      <h2 className="font-display font-semibold text-lg">{period.label}</h2>
                      <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate">
                        {period.posts.length} {period.posts.length === 1 ? "post" : "posts"}
                      </Badge>
                      {pendingCount > 0 && (
                        <Badge variant="default" className="bg-primary/15 text-foreground border-primary/25 no-default-hover-elevate no-default-active-elevate">
                          {pendingCount} pendente{pendingCount > 1 ? "s" : ""}
                        </Badge>
                      )}
                    </button>
                    {!isCollapsed && (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        {period.posts.map((post) => (
                          <ApprovalCard
                            key={post.id}
                            post={post}
                            onView={setViewPost}
                            onAnnotate={setAnnotatingPost}
                            onReview={setReviewingPost}
                            onResubmit={handleOpenResubmit}
                            onStatusChange={handleStatusChange}
                            onDelete={setDeletingApprovalId}
                            userRole={userRole}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : clientOverviewData.length === 0 ? (
        <Card className="p-12 text-center">
          <CheckSquare className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-lg font-medium">Nenhuma postagem encontrada</p>
          <p className="text-muted-foreground/70 text-sm mt-1">
            Clique em "Nova Postagem" para começar
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clientOverviewData.map((client) => {
            const clientData = clientsList.find((c) => c.id === client.clientId);
            const logoUrl = clientData?.logoUrl;
            return (
              <Card
                key={client.clientId}
                className="overflow-visible hover-elevate cursor-pointer"
                onClick={() => setSelectedClientId(client.clientId)}
                data-testid={`card-client-overview-${client.clientId}`}
              >
                <div className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt={client.clientName}
                        className="w-10 h-10 rounded-md object-cover"
                        loading="lazy"
                        data-testid={`img-client-logo-${client.clientId}`}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                        <Users className="w-5 h-5 text-primary" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display font-semibold truncate" data-testid={`text-client-name-${client.clientId}`}>
                        {client.clientName}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {client.total} {client.total === 1 ? "postagem" : "postagens"}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-md bg-muted/50 py-1.5">
                      <p className="text-lg font-semibold">{client.pending}</p>
                      <p className="text-[10px] text-muted-foreground">Pendentes</p>
                    </div>
                    <div className="rounded-md bg-muted/50 py-1.5">
                      <p className="text-lg font-semibold text-green-600 dark:text-green-400">{client.approved}</p>
                      <p className="text-[10px] text-muted-foreground">Aprovados</p>
                    </div>
                    <div className="rounded-md bg-muted/50 py-1.5">
                      <p className="text-lg font-semibold text-amber-600 dark:text-amber-400">{client.revision}</p>
                      <p className="text-[10px] text-muted-foreground">Revisão</p>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showCreateDialog} onOpenChange={(open) => { if (!open) { form.reset(); } setShowCreateDialog(open); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova Postagem para Aprovação</DialogTitle>
            <DialogDescription>
              Envie uma imagem e informações para o cliente aprovar
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="clientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cliente *</FormLabel>
                    <Select
                      value={field.value ? String(field.value) : ""}
                      onValueChange={(v) => {
                        field.onChange(Number(v));
                        const client = clientsList.find((c) => c.id === Number(v));
                        if (client) form.setValue("clientName", client.name);
                      }}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-client">
                          <SelectValue placeholder="Selecione o cliente" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {clientsList.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Título *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Ex: Post Instagram - Promoção Verão"
                        data-testid="input-title"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="caption"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Legenda</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        value={field.value || ""}
                        placeholder="Texto da legenda do post"
                        rows={3}
                        data-testid="input-caption"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="scheduledDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Publicação</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        value={field.value ? new Date(field.value).toISOString().split("T")[0] : ""}
                        onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : null)}
                        data-testid="input-scheduled-date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="platform"
                render={() => (
                  <FormItem>
                    <FormLabel>Rede Social</FormLabel>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {PLATFORM_OPTIONS.map((opt) => {
                        const isSelected = selectedPlatforms.includes(opt.value);
                        return (
                          <Badge
                            key={opt.value}
                            variant={isSelected ? "default" : "outline"}
                            className={`cursor-pointer toggle-elevate ${isSelected ? "toggle-elevated" : ""}`}
                            onClick={() => {
                              const current = form.getValues("platform") || [];
                              const next = isSelected
                                ? current.filter((p) => p !== opt.value)
                                : [...current, opt.value];
                              form.setValue("platform", next);
                            }}
                            data-testid={`badge-platform-${opt.value.toLowerCase().replace(/\//g, "-")}`}
                          >
                            {opt.label}
                          </Badge>
                        );
                      })}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="imageUrl"
                render={() => (
                  <FormItem>
                    <FormLabel>Imagens * {imageUrls.length > 1 && <span className="text-muted-foreground font-normal">({imageUrls.length} imagens - carrossel)</span>}</FormLabel>
                    <div className="mt-1 space-y-2">
                      {imageUrls.length > 0 && (
                        <div className="grid grid-cols-3 gap-2">
                          {imageUrls.map((url, idx) => (
                            <div key={idx} className="relative rounded-md overflow-hidden border border-border aspect-square">
                              <img
                                src={url}
                                alt={`Imagem ${idx + 1}`}
                                className="w-full h-full object-cover"
                                data-testid={`img-preview-${idx}`}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="absolute top-1 right-1 bg-card/90 h-6 w-6"
                                onClick={() => {
                                  const newUrls = imageUrls.filter((_, i) => i !== idx);
                                  form.setValue("imageUrls", newUrls);
                                  form.setValue("imageUrl", newUrls[0] || "", { shouldValidate: true });
                                }}
                                data-testid={`button-remove-image-${idx}`}
                              >
                                <XIcon className="w-3 h-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                      <label
                        className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-border rounded-md cursor-pointer hover:border-primary/50 transition-colors"
                        data-testid="label-upload"
                      >
                        {isUploading ? (
                          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        ) : (
                          <>
                            <Upload className="w-6 h-6 text-muted-foreground mb-1" />
                            <span className="text-sm text-muted-foreground">
                              {imageUrls.length > 0 ? "Adicionar mais imagens" : "Clique para enviar imagens"}
                            </span>
                            <span className="text-xs text-muted-foreground/70 mt-0.5">PNG, JPG até 10MB · Envie várias para carrossel</span>
                          </>
                        )}
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          multiple
                          onChange={handleFileChange}
                          disabled={isUploading}
                          data-testid="input-file"
                        />
                      </label>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="observations"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        value={field.value || ""}
                        placeholder="Notas internas sobre o post"
                        rows={2}
                        data-testid="input-observations"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => { form.reset(); setShowCreateDialog(false); }} data-testid="button-cancel-create">
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  data-testid="button-submit-create"
                >
                  {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Criar Postagem
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewPost} onOpenChange={(open) => { if (!open) { setViewPost(null); setViewImageIndex(0); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {viewPost && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <span className="flex-1">{viewPost.title}</span>
                  <ApprovalStatusBadge status={viewPost.status} />
                </DialogTitle>
                <DialogDescription className="flex items-center gap-2 flex-wrap">
                  <span>{viewPost.clientName}</span>
                  {viewPost.version && viewPost.version > 1 && (
                    <Badge variant="secondary" className="text-[10px] no-default-hover-elevate no-default-active-elevate" data-testid="badge-version">
                      v{viewPost.version}
                    </Badge>
                  )}
                  {viewPost.scheduledDate && (
                    <span className="flex items-center gap-1 text-xs">
                      <Clock className="w-3 h-3" />
                      {new Date(viewPost.scheduledDate).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                  <span className="text-xs">
                    {viewPost.createdAt ? `Criado em ${new Date(viewPost.createdAt).toLocaleDateString("pt-BR")}` : ""}
                  </span>
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="rounded-md overflow-hidden border border-border relative group">
                  {viewPost.annotations && viewImageIndex === 0 ? (
                    <AnnotationOverlay
                      imageUrl={viewImages[viewImageIndex]}
                      annotations={viewPost.annotations}
                    />
                  ) : (
                    <img
                      src={viewImages[viewImageIndex]}
                      alt={viewPost.title}
                      className="w-full max-h-96 object-contain bg-muted"
                      data-testid="img-view-full"
                    />
                  )}
                  <Button
                    size="icon"
                    variant="secondary"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ visibility: "visible" }}
                    onClick={() => setLightboxPost(viewPost)}
                    data-testid="button-expand-image"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </Button>
                  {viewImages.length > 1 && (
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-7 w-7 bg-black/60 text-white border-0"
                        onClick={() => setViewImageIndex((i) => Math.max(0, i - 1))}
                        disabled={viewImageIndex === 0}
                        data-testid="button-view-prev-image"
                      >
                        <ArrowLeft className="w-3 h-3" />
                      </Button>
                      <Badge variant="secondary" className="bg-black/60 text-white border-0 no-default-hover-elevate no-default-active-elevate">
                        {viewImageIndex + 1}/{viewImages.length}
                      </Badge>
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-7 w-7 bg-black/60 text-white border-0"
                        onClick={() => setViewImageIndex((i) => Math.min(viewImages.length - 1, i + 1))}
                        disabled={viewImageIndex === viewImages.length - 1}
                        data-testid="button-view-next-image"
                      >
                        <ChevronRight className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>

                {viewPost.platform && viewPost.platform.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {viewPost.platform.map((p) => (
                      <Badge key={p} variant="outline" className="no-default-hover-elevate no-default-active-elevate" data-testid={`badge-view-platform-${p}`}>
                        {p}
                      </Badge>
                    ))}
                  </div>
                )}

                {(() => {
                  const versionHistory = getVersionHistory(viewPost);
                  const hasHistory = versionHistory.length > 1;
                  if (!hasHistory) return null;
                  const parentPost = viewPost.parentId ? approvals.find((a) => a.id === viewPost.parentId) : null;
                  const childPost = approvals.find((a) => a.parentId === viewPost.id);
                  return (
                    <div className="rounded-md border border-border p-3 space-y-2" data-testid="version-history">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <History className="w-4 h-4 text-muted-foreground" />
                        Histórico de Versões
                      </div>
                      <div className="flex flex-col gap-1">
                        {versionHistory.map((v) => (
                          <button
                            key={v.id}
                            className={`text-left text-sm px-2 py-1 rounded-md flex items-center gap-2 ${v.id === viewPost.id ? "bg-muted font-medium" : "hover-elevate"}`}
                            onClick={() => { if (v.id !== viewPost.id) setViewPost(v); }}
                            data-testid={`button-version-${v.id}`}
                          >
                            <span>Versão {v.version || 1}</span>
                            <ApprovalStatusBadge status={v.status} />
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {parentPost && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setViewPost(parentPost)}
                            data-testid="button-view-previous-version"
                          >
                            Ver versão anterior
                          </Button>
                        )}
                        {childPost && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setViewPost(childPost)}
                            data-testid="button-view-next-version"
                          >
                            Ver versão mais recente
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {(viewPost.observations || viewPost.captionSuggestion) && userRole !== "client" && (
                  <div className="rounded-md border border-primary/20 bg-primary/5 p-4 space-y-3" data-testid="section-client-feedback">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-primary" />
                      Feedback do Cliente
                    </Label>
                    {viewPost.observations && (
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1">Observações</Label>
                        <p className="text-sm" data-testid="text-view-observations">{viewPost.observations}</p>
                      </div>
                    )}
                    {viewPost.captionSuggestion && (
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1">Sugestão de ajuste da legenda</Label>
                        <p className="text-sm" data-testid="text-view-caption-suggestion">{viewPost.captionSuggestion}</p>
                      </div>
                    )}
                  </div>
                )}

                {userRole === "client" && viewPost.observations && (
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1">Observações</Label>
                    <p className="text-sm" data-testid="text-view-observations">{viewPost.observations}</p>
                  </div>
                )}

                {userRole === "client" && viewPost.captionSuggestion && (
                  <div className="rounded-md bg-primary/5 border border-primary/15 p-3">
                    <Label className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
                      <MessageSquare className="w-3 h-3" />
                      Sugestão de ajuste da legenda
                    </Label>
                    <p className="text-sm" data-testid="text-view-caption-suggestion">{viewPost.captionSuggestion}</p>
                  </div>
                )}

                {viewPost.caption && (
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1">Legenda</Label>
                    <p className="text-sm" data-testid="text-view-caption">{viewPost.caption}</p>
                  </div>
                )}

                {viewPost.status === "Aprovado" && (
                  <div className="flex items-center gap-2 pt-2 border-t border-border flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadAllImages(viewPost)}
                      data-testid="button-view-download-images"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      {getPostImages(viewPost).length > 1
                        ? `Baixar ${getPostImages(viewPost).length} Imagens`
                        : "Baixar Imagem"}
                    </Button>
                    {viewPost.caption && (
                      <CopyButton text={viewPost.caption} testId="button-view-copy-caption" />
                    )}
                    {viewPost.caption && (
                      <span className="text-xs text-muted-foreground">Copiar legenda</span>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2 border-t border-border flex-wrap">
                  {userRole === "client" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setAnnotatingPost(viewPost);
                        setViewPost(null);
                      }}
                      data-testid="button-view-annotate"
                    >
                      <Pencil className="w-4 h-4 mr-2" />
                      Anotar Imagem
                    </Button>
                  )}

                  {userRole === "client" ? (
                    viewPost.status === "Pendente" && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            handleStatusChange(viewPost.id, "Aprovado");
                            setViewPost({ ...viewPost, status: "Aprovado" });
                          }}
                          data-testid="button-view-approve"
                        >
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Aprovar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setReviewingPost(viewPost);
                            setViewPost(null);
                          }}
                          data-testid="button-view-revision"
                        >
                          <AlertCircle className="w-3 h-3 mr-1" />
                          Pedir Revisão
                        </Button>
                      </div>
                    )
                  ) : (
                    viewPost.status === "Revisão" && (
                      <Button
                        size="sm"
                        onClick={() => handleOpenResubmit(viewPost)}
                        data-testid="button-resubmit"
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Reenviar com Ajustes
                      </Button>
                    )
                  )}

                  <div className="ml-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive"
                      onClick={() => {
                        setViewPost(null);
                        setDeletingApprovalId(viewPost.id);
                      }}
                      data-testid="button-delete-approval"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Excluir
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {reviewingPost && (
        <ReviewDialog
          post={reviewingPost}
          open={!!reviewingPost}
          onClose={() => setReviewingPost(null)}
          onSubmit={handleReviewSubmit}
          isPending={updateMutation.isPending}
        />
      )}

      <Dialog open={!!resubmitPost} onOpenChange={(open) => { if (!open) { resubmitForm.reset(); setResubmitPost(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Reenviar com Ajustes</DialogTitle>
            <DialogDescription>
              Envie uma nova versão da postagem "{resubmitPost?.title}" com os ajustes solicitados
            </DialogDescription>
          </DialogHeader>
          {resubmitPost && (
            <Form {...resubmitForm}>
              <form onSubmit={resubmitForm.handleSubmit(onResubmitSubmit)} className="space-y-4">
                <FormField
                  control={resubmitForm.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Titulo</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          data-testid="input-resubmit-title"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={resubmitForm.control}
                  name="caption"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Legenda</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          value={field.value || ""}
                          placeholder="Texto da legenda do post"
                          rows={3}
                          data-testid="input-resubmit-caption"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={resubmitForm.control}
                  name="imageUrl"
                  render={() => (
                    <FormItem>
                      <FormLabel>Nova Imagem *</FormLabel>
                      <div className="mt-1">
                        {resubmitImageUrl ? (
                          <div className="relative rounded-md overflow-hidden border border-border">
                            <img
                              src={resubmitImageUrl}
                              alt="Preview"
                              className="w-full h-48 object-cover"
                              data-testid="img-resubmit-preview"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="absolute top-2 right-2 bg-card/90"
                              onClick={() => resubmitForm.setValue("imageUrl", "", { shouldValidate: true })}
                              data-testid="button-resubmit-remove-image"
                            >
                              <XIcon className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <label
                            className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-border rounded-md cursor-pointer hover:border-primary/50 transition-colors"
                            data-testid="label-resubmit-upload"
                          >
                            {isResubmitUploading ? (
                              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                            ) : (
                              <>
                                <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                                <span className="text-sm text-muted-foreground">Clique para enviar nova imagem</span>
                                <span className="text-xs text-muted-foreground/70 mt-1">PNG, JPG ate 10MB</span>
                              </>
                            )}
                            <input
                              type="file"
                              className="hidden"
                              accept="image/*"
                              onChange={handleResubmitFileChange}
                              disabled={isResubmitUploading}
                              data-testid="input-resubmit-file"
                            />
                          </label>
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {resubmitPost.observations && (
                  <div className="rounded-md bg-muted/40 p-3">
                    <Label className="text-xs text-muted-foreground mb-1 block">Observações do cliente</Label>
                    <p className="text-sm">{resubmitPost.observations}</p>
                  </div>
                )}

                {resubmitPost.captionSuggestion && (
                  <div className="rounded-md bg-primary/5 border border-primary/15 p-3">
                    <Label className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
                      <MessageSquare className="w-3 h-3" />
                      Sugestão de ajuste da legenda do cliente
                    </Label>
                    <p className="text-sm">{resubmitPost.captionSuggestion}</p>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => { resubmitForm.reset(); setResubmitPost(null); }} data-testid="button-cancel-resubmit">
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={resubmitMutation.isPending}
                    data-testid="button-submit-resubmit"
                  >
                    {resubmitMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Reenviar
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>

      <ImageLightbox
        imageUrl={lightboxPost?.imageUrl || ""}
        annotations={lightboxPost?.annotations}
        title={lightboxPost?.title || ""}
        open={!!lightboxPost}
        onClose={() => setLightboxPost(null)}
      />

      <AlertDialog open={deletingApprovalId !== null} onOpenChange={(open) => !open && setDeletingApprovalId(null)}>
        <AlertDialogContent data-testid="dialog-confirm-delete-approval">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Postagem</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta postagem? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingApprovalId) {
                  deleteMutation.mutate(deletingApprovalId);
                  setDeletingApprovalId(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-approval"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
