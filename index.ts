
import { MCPServer, text, object } from "mcp-use/server";
import { z } from "zod";

const server = new MCPServer({
  name: "my-first-mcp",
  title: "my-first-mcp",
  version: "1.0.0",
  description: "MCP server com integração à documentação do Drizzle ORM",
  baseUrl: process.env.MCP_URL || "http://localhost:3000",
  favicon: "favicon.ico",
  websiteUrl: "https://mcp-use.com",
  icons: [
    {
      src: "icon.svg",
      mimeType: "image/svg+xml",
      sizes: ["512x512"],
    },
  ],
});

const docsCache = new Map<string, { content: string; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 horas em ms

const KEYWORD_MAP: Record<string, { url: string; title: string }[]> = {
  select:      [{ url: "https://orm.drizzle.team/docs/select",                title: "Select" }],
  buscar:      [{ url: "https://orm.drizzle.team/docs/select",                title: "Select" }],
  query:       [{ url: "https://orm.drizzle.team/docs/select",                title: "Select" }],
  consulta:    [{ url: "https://orm.drizzle.team/docs/select",                title: "Select" }],
  insert:      [{ url: "https://orm.drizzle.team/docs/insert",                title: "Insert" }],
  inserir:     [{ url: "https://orm.drizzle.team/docs/insert",                title: "Insert" }],
  update:      [{ url: "https://orm.drizzle.team/docs/update",                title: "Update" }],
  atualizar:   [{ url: "https://orm.drizzle.team/docs/update",                title: "Update" }],
  delete:      [{ url: "https://orm.drizzle.team/docs/delete",                title: "Delete" }],
  deletar:     [{ url: "https://orm.drizzle.team/docs/delete",                title: "Delete" }],
  remover:     [{ url: "https://orm.drizzle.team/docs/delete",                title: "Delete" }],
  join:        [{ url: "https://orm.drizzle.team/docs/joins",                 title: "Joins" }],
  relat:       [{ url: "https://orm.drizzle.team/docs/rqb-v2",               title: "Relational Queries" }],
  relation:    [{ url: "https://orm.drizzle.team/docs/rqb-v2",               title: "Relational Queries" }],
  migrat:      [{ url: "https://orm.drizzle.team/docs/migrations",            title: "Migrations" }],
  migração:    [{ url: "https://orm.drizzle.team/docs/migrations",            title: "Migrations" }],
  schema:      [{ url: "https://orm.drizzle.team/docs/drizzle-schema",        title: "Schema" }],
  tabela:      [{ url: "https://orm.drizzle.team/docs/drizzle-schema",        title: "Schema" }],
  table:       [{ url: "https://orm.drizzle.team/docs/drizzle-schema",        title: "Schema" }],
  transaction: [{ url: "https://orm.drizzle.team/docs/transactions",          title: "Transactions" }],
  filter:      [{ url: "https://orm.drizzle.team/docs/filters",               title: "Filters" }],
  filtro:      [{ url: "https://orm.drizzle.team/docs/filters",               title: "Filters" }],
  where:       [{ url: "https://orm.drizzle.team/docs/filters",               title: "Filters" }],
  index:       [{ url: "https://orm.drizzle.team/docs/indexes-constraints",   title: "Indexes & Constraints" }],
  índice:      [{ url: "https://orm.drizzle.team/docs/indexes-constraints",   title: "Indexes & Constraints" }],
  postgres:    [{ url: "https://orm.drizzle.team/docs/get-started-postgresql",title: "PostgreSQL" }],
  mysql:       [{ url: "https://orm.drizzle.team/docs/get-started-mysql",     title: "MySQL" }],
  sqlite:      [{ url: "https://orm.drizzle.team/docs/get-started-sqlite",    title: "SQLite" }],
};

async function searchViaAlgolia(query: string): Promise<string | null> {
  try {
    const response = await fetch(
      "https://TZGZ85B4R9-dsn.algolia.net/1/indexes/drizzleorm/query",
      {
        method: "POST",
        headers: {
          "X-Algolia-Application-Id": "TZGZ85B4R9",
          "X-Algolia-API-Key": "44f84cb5f3b74568e57c98c94a2e2c50",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          hitsPerPage: 5,
          attributesToRetrieve: ["content", "hierarchy", "url", "anchor"],
          attributesToHighlight: [],
        }),
      }
    );

    if (!response.ok) return null;

    const data: any = await response.json();
    const hits: any[] = data.hits ?? [];

    if (hits.length === 0) return null;

    const results = hits
      .map((hit) => {
        const breadcrumb = Object.values(hit.hierarchy ?? {})
          .filter(Boolean)
          .join(" > ");
        const content = hit.content?.trim() ?? "";
        return `### ${breadcrumb}\n${content}\n🔗 ${hit.url}`;
      })
      .join("\n\n---\n\n");

    return `Resultados via Algolia para "${query}":\n\n${results}`;
  } catch {
    return null;
  }
}

async function fetchDrizzlePage(url: string): Promise<string> {
  const cached = docsCache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.content;
  }

  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      Accept: "text/html",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ao buscar ${url}`);
  }

  const html = await response.text();

  const content = extractContent(html);

  docsCache.set(url, { content, timestamp: Date.now() });
  return content;
}

function extractContent(html: string): string {
  let content = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<svg[\s\S]*?<\/svg>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  const mainMatch =
    content.match(/<main[\s\S]*?>([\s\S]*?)<\/main>/i) ||
    content.match(/<article[\s\S]*?>([\s\S]*?)<\/article>/i);

  if (mainMatch) {
    content = mainMatch[1];
  }

  content = content
    .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, "\n\n## $1\n")
    .replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, "\n```\n$1\n```\n")
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`")
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "\n- $1")
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "\n$1\n")
    .replace(/<[^>]+>/g, "") 
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");

  content = content
    .replace(/\n{4,}/g, "\n\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  return content;
}

function buildFallbackLinks(query: string): string {
  const q = query.toLowerCase();
  const found = new Map<string, string>();

  for (const [keyword, pages] of Object.entries(KEYWORD_MAP)) {
    if (q.includes(keyword)) {
      for (const page of pages) {
        found.set(page.url, page.title);
      }
    }
  }

  if (found.size === 0) {
    found.set("https://orm.drizzle.team/docs/overview", "Documentação geral");
  }

  const links = [...found.entries()]
    .map(([url, title]) => `- **${title}**: ${url}`)
    .join("\n");

  return `Links relevantes na documentação do Drizzle ORM:\n\n${links}`;
}


server.tool(
  {
    name: "list-drizzle-topics",
    description:
      "Lista os principais tópicos e páginas da documentação do Drizzle ORM com os links diretos",
    schema: z.object({}),
  },
  async () => {
    const topics = [
      { title: "Overview",             url: "https://orm.drizzle.team/docs/overview" },
      { title: "Get Started (PG)",     url: "https://orm.drizzle.team/docs/get-started-postgresql" },
      { title: "Schema",               url: "https://orm.drizzle.team/docs/drizzle-schema" },
      { title: "Select",               url: "https://orm.drizzle.team/docs/select" },
      { title: "Insert",               url: "https://orm.drizzle.team/docs/insert" },
      { title: "Update",               url: "https://orm.drizzle.team/docs/update" },
      { title: "Delete",               url: "https://orm.drizzle.team/docs/delete" },
      { title: "Filters",              url: "https://orm.drizzle.team/docs/filters" },
      { title: "Joins",                url: "https://orm.drizzle.team/docs/joins" },
      { title: "Relational Queries",   url: "https://orm.drizzle.team/docs/rqb-v2" },
      { title: "Migrations",           url: "https://orm.drizzle.team/docs/migrations" },
      { title: "Transactions",         url: "https://orm.drizzle.team/docs/transactions" },
      { title: "Indexes & Constraints",url: "https://orm.drizzle.team/docs/indexes-constraints" },
      { title: "Column Types (PG)",    url: "https://orm.drizzle.team/docs/column-types/pg" },
      { title: "Column Types (MySQL)", url: "https://orm.drizzle.team/docs/column-types/mysql" },
    ];

    const list = topics.map((t) => `- **${t.title}**: ${t.url}`).join("\n");
    return text(`Tópicos disponíveis na documentação do Drizzle ORM:\n\n${list}`);
  }
);

server.tool(
  {
    name: "search-drizzle-docs",
    description:
      "Pesquisa a documentação do Drizzle ORM. Use para perguntas sobre select, insert, update, delete, schema, migrations, joins, transactions, relational queries, filtros, índices, tipos de coluna, conexão com PostgreSQL, MySQL, SQLite, etc.",
    schema: z.object({
      query: z
        .string()
        .describe(
          "Pergunta ou termo a buscar, ex: 'como fazer select em tabela postgres', 'como criar migration', 'tipos de coluna'"
        ),
    }),
  },
  async ({ query }) => {
    const algoliaResult = await searchViaAlgolia(query);
    if (algoliaResult) {
      return text(algoliaResult);
    }

    const q = query.toLowerCase();
    const matchedPages: { url: string; title: string }[] = [];

    for (const [keyword, pages] of Object.entries(KEYWORD_MAP)) {
      if (q.includes(keyword)) {
        for (const page of pages) {
          if (!matchedPages.find((p) => p.url === page.url)) {
            matchedPages.push(page);
          }
        }
      }
    }

    if (matchedPages.length === 0) {
      matchedPages.push(
        { url: "https://orm.drizzle.team/docs/select", title: "Select" },
        { url: "https://orm.drizzle.team/docs/drizzle-schema", title: "Schema" }
      );
    }

    const pagesToFetch = matchedPages.slice(0, 2); 
    const results: string[] = [];

    for (const page of pagesToFetch) {
      try {
        const content = await fetchDrizzlePage(page.url);

        const firstTerm = q.split(" ").find((w) => w.length > 3) ?? q;
        const idx = content.toLowerCase().indexOf(firstTerm);
        const snippet =
          idx !== -1
            ? content.slice(Math.max(0, idx - 150), idx + 800).trim()
            : content.slice(0, 800).trim();

        results.push(`## ${page.title}\n🔗 ${page.url}\n\n${snippet}`);
      } catch (err) {
        results.push(
          `## ${page.title}\n🔗 ${page.url}\n\n⚠️ Não foi possível carregar esta página. Acesse diretamente pelo link.`
        );
      }
    }

    if (results.length > 0) {
      return text(
        `Resultados para "${query}" na documentação do Drizzle ORM:\n\n` +
          results.join("\n\n---\n\n")
      );
    }

    return text(buildFallbackLinks(query));
  }
);

server.tool(
  {
    name: "get-drizzle-page",
    description:
      "Retorna o conteúdo completo de uma página específica da documentação do Drizzle ORM. Use quando precisar de exemplos de código detalhados ou da documentação completa de um tópico.",
    schema: z.object({
      topic: z
        .enum([
          "select",
          "insert",
          "update",
          "delete",
          "filters",
          "joins",
          "schema",
          "migrations",
          "transactions",
          "rqb",
          "indexes",
          "column-types-pg",
          "column-types-mysql",
          "get-started-postgresql",
          "get-started-mysql",
          "get-started-sqlite",
        ])
        .describe("O tópico da documentação a buscar"),
    }),
  },
  async ({ topic }) => {
    const urlMap: Record<string, string> = {
      select:               "https://orm.drizzle.team/docs/select",
      insert:               "https://orm.drizzle.team/docs/insert",
      update:               "https://orm.drizzle.team/docs/update",
      delete:               "https://orm.drizzle.team/docs/delete",
      filters:              "https://orm.drizzle.team/docs/filters",
      joins:                "https://orm.drizzle.team/docs/joins",
      schema:               "https://orm.drizzle.team/docs/drizzle-schema",
      migrations:           "https://orm.drizzle.team/docs/migrations",
      transactions:         "https://orm.drizzle.team/docs/transactions",
      rqb:                  "https://orm.drizzle.team/docs/rqb-v2",
      indexes:              "https://orm.drizzle.team/docs/indexes-constraints",
      "column-types-pg":    "https://orm.drizzle.team/docs/column-types/pg",
      "column-types-mysql": "https://orm.drizzle.team/docs/column-types/mysql",
      "get-started-postgresql": "https://orm.drizzle.team/docs/get-started-postgresql",
      "get-started-mysql":      "https://orm.drizzle.team/docs/get-started-mysql",
      "get-started-sqlite":     "https://orm.drizzle.team/docs/get-started-sqlite",
    };

    const url = urlMap[topic];

    try {
      const content = await fetchDrizzlePage(url);
      // Limita a 4000 chars para não estourar o contexto do LLM
      const truncated =
        content.length > 4000
          ? content.slice(0, 4000) + "\n\n... (conteúdo truncado — acesse o link para ver o restante)"
          : content;

      return text(`## Documentação: ${topic}\n🔗 ${url}\n\n${truncated}`);
    } catch (err) {
      return text(
        `Não foi possível carregar a página automaticamente.\n\n` +
          `Acesse diretamente: ${url}`
      );
    }
  }
);


server.tool(
  {
    name: "fetch-weather",
    description: "Fetch the weather for a city",
    schema: z.object({
      city: z.string().describe("The city to fetch the weather for"),
    }),
  },
  async ({ city }) => {
    const response = await fetch(`https://wttr.in/${city}?format=j1`);
    const data: any = await response.json();
    const current = data.current_condition[0];
    return text(
      `The weather in ${city} is ${current.weatherDesc[0].value}. ` +
        `Temperature: ${current.temp_C}°C, Humidity: ${current.humidity}%`
    );
  }
);


server.resource(
  {
    name: "config",
    uri: "config://settings",
    description: "Server configuration",
  },
  async () =>
    object({
      theme: "dark",
      language: "pt-br",
    })
);

// server.prompt(
//   {
//     name: "review-code",
//     description: "Review code for best practices and potential issues",
//     schema: z.object({
//       code: z.string().describe("The code to review"),
//     }),
//   },
//   async ({ code }) => {
//     return text(`Please review this code:\n\n${code}`);
//   }
// );

// ─────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
console.log(`🚀 MCP Server rodando na porta ${PORT}`);
server.listen(PORT);