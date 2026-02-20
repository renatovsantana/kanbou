import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertPostSchema, type Post, type Client } from "@shared/schema";
import { useCreatePost, useUpdatePost } from "@/hooks/use-posts";
import { useClients } from "@/hooks/use-clients";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Loader2, Save, Instagram, Facebook, Linkedin, Video, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { z } from "zod";

const PLATFORMS = [
  { value: "Instagram", label: "Instagram", icon: Instagram, color: "text-pink-600" },
  { value: "Facebook", label: "Facebook", icon: Facebook, color: "text-blue-600" },
  { value: "LinkedIn", label: "LinkedIn", icon: Linkedin, color: "text-blue-700" },
  { value: "TikTok", label: "TikTok", icon: Video, color: "text-slate-900" },
  { value: "Blog", label: "Blog", icon: FileText, color: "text-orange-600" },
];

const formSchema = insertPostSchema.extend({
  scheduledDate: z.coerce.date(),
  clientId: z.coerce.number().min(1, "Selecione um cliente"),
  clientName: z.string().min(1, "Cliente é obrigatório"),
  platform: z.array(z.string()).min(1, "Selecione ao menos uma plataforma"),
});

type PostFormValues = z.infer<typeof formSchema>;

interface PostFormProps {
  post?: Post;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function PostForm({ post, onSuccess, onCancel }: PostFormProps) {
  const createPost = useCreatePost();
  const updatePost = useUpdatePost();
  const { data: clients } = useClients();

  const allClients = clients || [];
  const activeClients = allClients.filter((c: Client) => c.isActive);
  const selectableClients = post?.clientId
    ? [...activeClients.filter((c: Client) => c.id !== post.clientId),
       ...allClients.filter((c: Client) => c.id === post.clientId)]
        .filter((c, i, arr) => arr.findIndex(x => x.id === c.id) === i)
    : activeClients;

  const isEditing = !!post;
  const isPending = createPost.isPending || updatePost.isPending;

  const form = useForm<PostFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      clientId: post?.clientId || undefined,
      clientName: post?.clientName || "",
      title: post?.title || "",
      content: post?.content || "",
      platform: post?.platform || [],
      status: post?.status || "Agendado",
      mediaUrl: post?.mediaUrl || "",
      notes: post?.notes || "",
      scheduledDate: post?.scheduledDate ? new Date(post.scheduledDate) : new Date(),
    },
  });

  async function onSubmit(data: PostFormValues) {
    try {
      if (isEditing && post) {
        await updatePost.mutateAsync({ id: post.id, ...data });
      } else {
        await createPost.mutateAsync(data);
      }
      onSuccess?.();
    } catch (error) {
      console.error("Form submission error", error);
    }
  }

  function handleClientChange(clientIdStr: string) {
    const selected = allClients.find((c: Client) => String(c.id) === clientIdStr);
    if (selected) {
      form.setValue("clientId", selected.id, { shouldValidate: true });
      form.setValue("clientName", selected.name, { shouldValidate: true });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="clientId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cliente</FormLabel>
                <Select
                  onValueChange={handleClientChange}
                  value={field.value ? String(field.value) : undefined}
                >
                  <FormControl>
                    <SelectTrigger data-testid="select-client" className="rounded-xl">
                      <SelectValue placeholder="Selecione um cliente" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {selectableClients.map((c: Client) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}{!c.isActive ? " (inativo)" : ""}
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
                <FormLabel>Título do Post (Assunto)</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: Promoção de Natal" {...field} className="rounded-xl" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FormField
            control={form.control}
            name="platform"
            render={() => (
              <FormItem>
                <FormLabel>Plataformas</FormLabel>
                <div className="flex flex-wrap gap-3 pt-1">
                  {PLATFORMS.map((p) => (
                    <FormField
                      key={p.value}
                      control={form.control}
                      name="platform"
                      render={({ field }) => {
                        const checked = field.value?.includes(p.value) || false;
                        return (
                          <FormItem className="flex items-center gap-2 space-y-0">
                            <FormControl>
                              <Checkbox
                                data-testid={`checkbox-platform-${p.value.toLowerCase()}`}
                                checked={checked}
                                onCheckedChange={(isChecked) => {
                                  const current = field.value || [];
                                  if (isChecked) {
                                    field.onChange([...current, p.value]);
                                  } else {
                                    field.onChange(current.filter((v: string) => v !== p.value));
                                  }
                                }}
                              />
                            </FormControl>
                            <FormLabel className="flex items-center gap-1.5 text-sm font-normal cursor-pointer">
                              <p.icon className={cn("w-4 h-4", p.color)} />
                              {p.label}
                            </FormLabel>
                          </FormItem>
                        );
                      }}
                    />
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Agendado">Agendado</SelectItem>
                    <SelectItem value="Publicado">Publicado</SelectItem>
                    <SelectItem value="Cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="scheduledDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Data de Agendamento</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full pl-3 text-left font-normal rounded-xl",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {field.value ? (
                          format(field.value, "PPP", { locale: ptBR })
                        ) : (
                          <span>Selecione uma data</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      initialFocus
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Legenda / Copy</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Escreva a legenda do post aqui..."
                  className="min-h-[120px] resize-none rounded-xl"
                  {...field}
                  value={field.value || ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="mediaUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Link da Arte/Mídia</FormLabel>
                <FormControl>
                  <Input placeholder="https://drive.google.com/..." {...field} value={field.value || ""} className="rounded-xl" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Observações Internas</FormLabel>
                <FormControl>
                  <Input placeholder="Obs: Aprovar com o cliente até dia 15" {...field} value={field.value || ""} className="rounded-xl" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} className="rounded-xl px-6">
              Cancelar
            </Button>
          )}
          <Button
            type="submit"
            disabled={isPending}
            className="rounded-xl px-8"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                {isEditing ? "Atualizar Post" : "Criar Post"}
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
