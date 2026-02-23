import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Book, ChevronRight, Search, ArrowUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface TocItem {
  id: string;
  title: string;
  level: number;
}

function parseMarkdown(md: string): string {
  let html = md;

  html = html.replace(/^### (.*$)/gim, '<h3 id="$1" class="text-lg font-semibold mt-8 mb-3 text-foreground scroll-mt-20">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 id="$1" class="text-xl font-bold mt-10 mb-4 text-foreground border-b pb-2 scroll-mt-20">$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 class="text-3xl font-bold mb-2 text-foreground">$1</h1>');

  html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/`([^`]+)`/g, '<code class="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">$1</code>');

  html = html.replace(/^---$/gim, '<hr class="my-6 border-border" />');

  const lines = html.split('\n');
  let result: string[] = [];
  let inTable = false;
  let inCodeBlock = false;
  let codeContent: string[] = [];
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('```')) {
      if (inCodeBlock) {
        result.push(`<pre class="bg-muted/50 border rounded-lg p-4 overflow-x-auto my-4"><code class="text-sm font-mono">${codeContent.join('\n')}</code></pre>`);
        codeContent = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeContent.push(line.replace(/</g, '&lt;').replace(/>/g, '&gt;'));
      continue;
    }

    if (line.startsWith('|') && line.endsWith('|')) {
      if (!inTable) {
        inTable = true;
        const headers = line.split('|').filter(c => c.trim()).map(c => c.trim());
        const nextLine = lines[i + 1];
        if (nextLine && nextLine.includes('---')) {
          i++;
          result.push('<div class="overflow-x-auto my-4"><table class="w-full text-sm border-collapse"><thead><tr>');
          headers.forEach(h => {
            result.push(`<th class="border border-border bg-muted/50 px-3 py-2 text-left font-semibold">${h}</th>`);
          });
          result.push('</tr></thead><tbody>');
          continue;
        }
      }
      const cells = line.split('|').filter(c => c.trim()).map(c => c.trim());
      result.push('<tr>');
      cells.forEach(c => {
        result.push(`<td class="border border-border px-3 py-2">${c}</td>`);
      });
      result.push('</tr>');
      continue;
    } else if (inTable) {
      inTable = false;
      result.push('</tbody></table></div>');
    }

    if (line.match(/^- /)) {
      if (!inList) {
        inList = true;
        result.push('<ul class="list-disc list-inside space-y-1 my-2 ml-2">');
      }
      result.push(`<li class="text-muted-foreground">${line.replace(/^- /, '')}</li>`);
      continue;
    } else if (inList && line.match(/^\s+- /)) {
      result.push(`<li class="text-muted-foreground ml-4">${line.replace(/^\s+- /, '')}</li>`);
      continue;
    } else if (inList) {
      inList = false;
      result.push('</ul>');
    }

    if (line.match(/^\d+\. /)) {
      result.push(`<div class="ml-2 my-1 text-muted-foreground">${line}</div>`);
      continue;
    }

    if (line.trim() === '') {
      result.push('<div class="h-2"></div>');
    } else if (!line.startsWith('<')) {
      result.push(`<p class="text-muted-foreground leading-relaxed">${line}</p>`);
    } else {
      result.push(line);
    }
  }

  if (inTable) result.push('</tbody></table></div>');
  if (inList) result.push('</ul>');

  return result.join('\n');
}

function extractToc(md: string): TocItem[] {
  const items: TocItem[] = [];
  const lines = md.split('\n');
  for (const line of lines) {
    const match = line.match(/^(#{2,3}) (.+)$/);
    if (match) {
      items.push({
        id: match[2],
        title: match[2].replace(/\*\*/g, ''),
        level: match[1].length,
      });
    }
  }
  return items;
}

export default function DocumentacaoPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeSection, setActiveSection] = useState("");
  const [showScrollTop, setShowScrollTop] = useState(false);

  const { data: content, isLoading } = useQuery<string>({
    queryKey: ["/api/documentacao"],
    queryFn: async () => {
      const res = await fetch("/api/documentacao");
      return res.text();
    },
  });

  const toc = content ? extractToc(content) : [];
  const htmlContent = content ? parseMarkdown(content) : "";

  const filteredToc = toc.filter(item =>
    item.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
      setActiveSection(id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" data-testid="loading-docs">
        <div className="animate-pulse flex flex-col items-center gap-3">
          <Book className="w-12 h-12 text-muted-foreground" />
          <p className="text-muted-foreground">Carregando documentação...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-0 max-w-full" data-testid="page-documentacao">
      <aside className="hidden lg:block w-72 shrink-0 border-r">
        <div className="sticky top-0 h-[calc(100vh-4rem)] flex flex-col">
          <div className="p-4 border-b">
            <div className="flex items-center gap-2 mb-3">
              <Book className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-sm">Documentação</h2>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar seção..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-9 text-sm"
                data-testid="input-search-docs"
              />
            </div>
          </div>
          <ScrollArea className="flex-1 p-3">
            <nav className="space-y-0.5">
              {filteredToc.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors hover:bg-muted ${
                    item.level === 3 ? "pl-6 text-xs" : "font-medium"
                  } ${activeSection === item.id ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}
                  data-testid={`toc-item-${item.id}`}
                >
                  <span className="flex items-center gap-1.5">
                    {item.level === 3 && <ChevronRight className="w-3 h-3" />}
                    {item.title}
                  </span>
                </button>
              ))}
            </nav>
          </ScrollArea>
        </div>
      </aside>

      <main className="flex-1 min-w-0 p-6 lg:p-10 max-w-4xl">
        <div className="mb-6 lg:hidden">
          <div className="flex items-center gap-2 mb-2">
            <Book className="w-5 h-5 text-primary" />
            <Badge variant="outline">Documentação do Sistema</Badge>
          </div>
        </div>

        <article
          className="prose-custom"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      </main>

      {showScrollTop && (
        <Button
          size="icon"
          variant="outline"
          className="fixed bottom-6 right-6 rounded-full shadow-lg z-50"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          data-testid="button-scroll-top"
        >
          <ArrowUp className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}
