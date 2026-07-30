import {
  Blocks,
  Bot,
  Boxes,
  Check,
  Download,
  LayoutDashboard,
  Loader2,
  Package,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingBag,
  X,
} from "lucide-react";
import {
  type ComponentType,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  MemoryRouter,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import type {
  AgentInfo,
  AuditResult,
  DashboardStats,
  Extension,
  MarketplaceItem,
  Project,
} from "@/lib/types";
import type { KitSummary } from "@/types/kits";
import {
  HarnessKitRuntimeProvider,
  type EmbeddedTheme,
  type HarnessKitEmbedRuntime,
  useHarnessKitRuntime,
} from "./runtime";

type Language = "en" | "zh";

const labels = {
  en: {
    product: "1agents Extensions",
    overview: "Overview",
    extensions: "Extensions",
    agents: "Agents",
    audit: "Audit",
    marketplace: "Marketplace",
    projects: "Projects",
    kits: "Kits",
    refresh: "Refresh",
    empty: "Nothing to show yet.",
    loading: "Loading extension inventory…",
    retry: "Retry",
    degraded: "HarnessKit is unavailable",
    degradedHelp:
      "The rest of 1agents remains available. Retry after the extension service is ready.",
    search: "Search the marketplace",
    searching: "Searching…",
    scope: "Project scope",
    detected: "Detected",
    notDetected: "Not detected",
    enabled: "Enabled",
    disabled: "Disabled",
    findings: "findings",
    installed: "installed",
  },
  zh: {
    product: "1agents 扩展",
    overview: "概览",
    extensions: "扩展",
    agents: "Agent",
    audit: "审计",
    marketplace: "市场",
    projects: "项目",
    kits: "套件",
    refresh: "刷新",
    empty: "目前没有可显示的内容。",
    loading: "正在加载扩展清单…",
    retry: "重试",
    degraded: "HarnessKit 暂不可用",
    degradedHelp: "1agents 的其他功能仍可使用。扩展服务就绪后可重试。",
    search: "搜索扩展市场",
    searching: "搜索中…",
    scope: "项目范围",
    detected: "已检测",
    notDetected: "未检测",
    enabled: "已启用",
    disabled: "已禁用",
    findings: "项发现",
    installed: "次安装",
  },
} as const;

function normalizeLanguage(value: string): Language {
  return value.toLowerCase().startsWith("zh") ? "zh" : "en";
}

function normalizeRoute(route: string): string {
  const clean = route.trim().replace(/^#/, "");
  if (!clean || clean === "/" || clean === "/overview") return "/overview";
  return clean.startsWith("/") ? clean : `/${clean}`;
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "Request cancelled";
  }
  const raw = error instanceof Error ? error.message : String(error);
  try {
    const parsed = JSON.parse(raw) as { message?: unknown };
    if (typeof parsed.message === "string") return parsed.message;
  } catch {
    // Plain-text upstream errors are expected.
  }
  return raw.replace(/Bearer\s+\S+/gi, "Bearer [redacted]").slice(0, 300);
}

function useLoad<T>(
  loader: () => Promise<T>,
  revision: number,
): {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
} {
  const { reportError } = useHarnessKitRuntime();
  const [localRevision, setLocalRevision] = useState(0);
  const [state, setState] = useState<{
    data: T | null;
    error: string | null;
    loading: boolean;
  }>({ data: null, error: null, loading: true });

  useEffect(() => {
    let current = true;
    setState((previous) => ({ ...previous, error: null, loading: true }));
    loader().then(
      (data) => {
        if (current) setState({ data, error: null, loading: false });
      },
      (error: unknown) => {
        reportError(error);
        if (current) {
          setState({
            data: null,
            error: safeErrorMessage(error),
            loading: false,
          });
        }
      },
    );
    return () => {
      current = false;
    };
  }, [loader, localRevision, reportError, revision]);

  return {
    ...state,
    reload: () => setLocalRevision((value) => value + 1),
  };
}

function LoadingState({ text }: { text: string }) {
  return (
    <div className="hk-embed-state" role="status">
      <RefreshCw size={18} className="hk-embed-spin" aria-hidden="true" />
      <span>{text}</span>
    </div>
  );
}

function ErrorState({
  title,
  help,
  error,
  retryLabel,
  onRetry,
}: {
  title: string;
  help: string;
  error: string;
  retryLabel: string;
  onRetry(): void;
}) {
  return (
    <section className="hk-embed-error" role="alert">
      <ShieldCheck size={24} aria-hidden="true" />
      <div>
        <h2>{title}</h2>
        <p>{help}</p>
        <code>{error}</code>
      </div>
      <button type="button" onClick={onRetry}>
        {retryLabel}
      </button>
    </section>
  );
}

function Page({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="hk-embed-page">
      <header className="hk-embed-page-header">
        <h1>{title}</h1>
        {action}
      </header>
      {children}
    </section>
  );
}

function DataPage<T>({
  title,
  revision,
  loader,
  render,
  language,
}: {
  title: string;
  revision: number;
  loader: () => Promise<T>;
  render(data: T): ReactNode;
  language: Language;
}) {
  const text = labels[language];
  const result = useLoad(loader, revision);
  return (
    <Page title={title}>
      {result.loading ? <LoadingState text={text.loading} /> : null}
      {!result.loading && result.error ? (
        <ErrorState
          title={text.degraded}
          help={text.degradedHelp}
          error={result.error}
          retryLabel={text.retry}
          onRetry={result.reload}
        />
      ) : null}
      {!result.loading && !result.error && result.data != null
        ? render(result.data)
        : null}
    </Page>
  );
}

function Overview({
  language,
  revision,
}: {
  language: Language;
  revision: number;
}) {
  const { api } = useHarnessKitRuntime();
  const text = labels[language];
  return (
    <DataPage
      title={text.overview}
      language={language}
      revision={revision}
      loader={useMemo(() => () => api.getDashboardStats(), [api])}
      render={(stats: DashboardStats) => {
        const cards = [
          [text.extensions, stats.total_extensions],
          ["Skills", stats.skill_count],
          ["MCP", stats.mcp_count],
          [text.audit, stats.critical_issues + stats.high_issues],
        ];
        return (
          <div className="hk-embed-stats">
            {cards.map(([label, value]) => (
              <article key={label} className="hk-embed-stat">
                <span>{label}</span>
                <strong>{value}</strong>
              </article>
            ))}
          </div>
        );
      }}
    />
  );
}

function extensionMatchesScope(extension: Extension, scopePath?: string) {
  if (!scopePath) return true;
  return (
    extension.scope.type === "project" && extension.scope.path === scopePath
  );
}

function Extensions({
  language,
  revision,
  scopePath,
}: {
  language: Language;
  revision: number;
  scopePath?: string;
}) {
  const { api } = useHarnessKitRuntime();
  const text = labels[language];
  return (
    <DataPage
      title={text.extensions}
      language={language}
      revision={revision}
      loader={useMemo(() => () => api.listExtensions(), [api])}
      render={(extensions: Extension[]) => {
        const visible = extensions.filter((extension) =>
          extensionMatchesScope(extension, scopePath),
        );
        if (visible.length === 0)
          return <p className="hk-embed-empty">{text.empty}</p>;
        return (
          <div className="hk-embed-table-wrap">
            <table className="hk-embed-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Kind</th>
                  <th>Agents</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((extension) => (
                  <tr key={extension.id}>
                    <td>
                      <strong>{extension.name}</strong>
                      <small>{extension.description}</small>
                    </td>
                    <td>
                      <span className="hk-embed-kind">{extension.kind}</span>
                    </td>
                    <td>{extension.agents.join(", ") || "—"}</td>
                    <td>
                      {extension.enabled ? text.enabled : text.disabled}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }}
    />
  );
}

function Agents({
  language,
  revision,
}: {
  language: Language;
  revision: number;
}) {
  const { api } = useHarnessKitRuntime();
  const text = labels[language];
  return (
    <DataPage
      title={text.agents}
      language={language}
      revision={revision}
      loader={useMemo(() => () => api.listAgents(), [api])}
      render={(agents: AgentInfo[]) => (
        <div className="hk-embed-grid">
          {agents.map((agent) => (
            <article key={agent.name} className="hk-embed-card">
              <span className="hk-agent-initial" aria-hidden="true">
                {agent.name.slice(0, 2).toUpperCase()}
              </span>
              <div>
                <strong>{agent.name}</strong>
                <p>
                  {agent.detected ? text.detected : text.notDetected} ·{" "}
                  {agent.extension_count} {text.extensions.toLowerCase()}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}
    />
  );
}

function Audit({
  language,
  revision,
}: {
  language: Language;
  revision: number;
}) {
  const { api } = useHarnessKitRuntime();
  const text = labels[language];
  return (
    <DataPage
      title={text.audit}
      language={language}
      revision={revision}
      loader={useMemo(() => () => api.listAuditResults(), [api])}
      render={(results: AuditResult[]) =>
        results.length === 0 ? (
          <p className="hk-embed-empty">{text.empty}</p>
        ) : (
          <div className="hk-embed-list">
            {results.map((result) => (
              <article key={result.extension_id} className="hk-embed-list-row">
                <div>
                  <strong>{result.extension_id}</strong>
                  <p>
                    {result.findings.length} {text.findings}
                  </p>
                </div>
                <span className="hk-embed-score">{result.trust_score}</span>
              </article>
            ))}
          </div>
        )
      }
    />
  );
}

function Marketplace({
  language,
}: {
  language: Language;
}) {
  const { api, reportError } = useHarnessKitRuntime();
  const text = labels[language];
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MarketplaceItem | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [installingAgent, setInstallingAgent] = useState<string | null>(null);
  const [installedKeys, setInstalledKeys] = useState<Set<string>>(new Set());

  // Load trending skills on mount
  useEffect(() => {
    let active = true;
    setLoading(true);
    api.trendingMarketplace("skill", 30)
      .then((data) => {
        if (active && data) setItems(data);
      })
      .catch((cause) => {
        if (active) setError(safeErrorMessage(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api]);

  const search = async () => {
    const value = query.trim();
    if (!value) return;
    setLoading(true);
    setError(null);
    try {
      setItems(await api.searchMarketplace(value, "skill", 30));
    } catch (cause) {
      reportError(cause);
      setError(safeErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  };

  const handleSelectItem = (item: MarketplaceItem) => {
    setSelectedItem(item);
    setPreviewContent(null);
    setPreviewLoading(item.kind === "skill");

    // Fetch agents list
    api.listAgents().then((list) => setAgents(list.filter((a) => a.detected))).catch(() => []);

    // Fetch skill preview
    if (item.kind === "skill") {
      api.fetchSkillPreview(item.source, item.skill_id || item.name, item.repo_url)
        .then((content) => setPreviewContent(content))
        .catch(() => setPreviewContent(null))
        .finally(() => setPreviewLoading(false));
    }
  };

  const handleInstall = async (agentName: string) => {
    if (!selectedItem) return;
    const key = `${selectedItem.id}:${agentName}`;
    setInstallingAgent(key);
    try {
      await api.installFromMarketplace(
        selectedItem.source,
        selectedItem.skill_id || selectedItem.name,
        agentName,
        { type: "global" }
      );
      setInstalledKeys((prev) => new Set(prev).add(key));
    } catch (cause) {
      reportError(cause);
    } finally {
      setInstallingAgent(null);
    }
  };

  return (
    <Page title={text.marketplace}>
      <form
        className="hk-embed-search"
        onSubmit={(event) => {
          event.preventDefault();
          void search();
        }}
      >
        <Search size={17} aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={text.search}
          aria-label={text.search}
        />
        <button type="submit" disabled={loading || !query.trim()}>
          {loading ? text.searching : text.search}
        </button>
      </form>

      {error ? <p className="hk-embed-inline-error">{error}</p> : null}

      {loading && items.length === 0 ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "32px" }}>
          <Loader2 size={24} style={{ animation: "hk-embed-spin 1s linear infinite" }} />
        </div>
      ) : null}

      <div className="hk-embed-grid">
        {items.map((item) => (
          <button
            type="button"
            key={`${item.source}:${item.id}`}
            onClick={() => handleSelectItem(item)}
            className="hk-embed-card hk-embed-card-clickable"
          >
            <span className="hk-agent-initial" aria-hidden="true">
              {item.kind.slice(0, 2).toUpperCase()}
            </span>
            <div>
              <strong>{item.name}</strong>
              <p>{item.description}</p>
              <small>
                {item.installs} {text.installed}
              </small>
            </div>
          </button>
        ))}
      </div>

      {/* Slide-over Detail Drawer */}
      {selectedItem && (
        <aside className="hk-embed-drawer" role="dialog" aria-label={selectedItem.name}>
          <div className="hk-embed-drawer-header">
            <div>
              <strong style={{ fontSize: "16px", display: "block" }}>{selectedItem.name}</strong>
              <small style={{ color: "var(--hk-muted)", fontSize: "12px" }}>
                {selectedItem.source} · {selectedItem.installs} {text.installed}
              </small>
            </div>
            <button
              type="button"
              className="hk-embed-drawer-close"
              onClick={() => setSelectedItem(null)}
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          <div className="hk-embed-drawer-body">
            {selectedItem.description && (
              <p style={{ margin: 0, fontSize: "13px", color: "var(--hk-ink)" }}>
                {selectedItem.description}
              </p>
            )}

            {/* Install to Agents */}
            <div>
              <strong style={{ fontSize: "13px", display: "block", marginBottom: "8px" }}>
                {language === "zh" ? "安装到 Agent" : "Install to Agent"}
              </strong>
              {agents.length === 0 ? (
                <p style={{ fontSize: "12px", color: "var(--hk-muted)", margin: 0 }}>
                  {language === "zh" ? "未检测到可安装的 Agent" : "No detected agents available"}
                </p>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {agents.map((agent) => {
                    const key = `${selectedItem.id}:${agent.name}`;
                    const isInstalled = installedKeys.has(key);
                    const isInstalling = installingAgent === key;
                    return (
                      <button
                        type="button"
                        key={agent.name}
                        disabled={isInstalled || isInstalling}
                        onClick={() => void handleInstall(agent.name)}
                        className="hk-embed-agent-btn"
                      >
                        {isInstalling ? (
                          <Loader2 size={13} style={{ animation: "hk-embed-spin 1s linear infinite" }} />
                        ) : isInstalled ? (
                          <Check size={13} style={{ color: "green" }} />
                        ) : (
                          <Download size={13} />
                        )}
                        <span>{agent.name}</span>
                        {isInstalled ? <span>({language === "zh" ? "已安装" : "Installed"})</span> : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* SKILL.md Preview */}
            <div>
              <strong style={{ fontSize: "13px", display: "block", marginBottom: "8px" }}>
                {language === "zh" ? "技能文档 (SKILL.md)" : "Documentation (SKILL.md)"}
              </strong>
              {previewLoading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: "16px" }}>
                  <Loader2 size={18} style={{ animation: "hk-embed-spin 1s linear infinite" }} />
                </div>
              ) : previewContent ? (
                <pre className="hk-embed-drawer-preview">{previewContent}</pre>
              ) : (
                <p style={{ fontSize: "12px", color: "var(--hk-muted)", fontStyle: "italic", margin: 0 }}>
                  {language === "zh" ? "无预览文档" : "No preview documentation"}
                </p>
              )}
            </div>
          </div>
        </aside>
      )}
    </Page>
  );
}

function Projects({
  language,
  revision,
}: {
  language: Language;
  revision: number;
}) {
  const { api } = useHarnessKitRuntime();
  const text = labels[language];
  return (
    <DataPage
      title={text.projects}
      language={language}
      revision={revision}
      loader={useMemo(() => () => api.listProjects(), [api])}
      render={(projects: Project[]) =>
        projects.length === 0 ? (
          <p className="hk-embed-empty">{text.empty}</p>
        ) : (
          <div className="hk-embed-list">
            {projects.map((project) => (
              <article key={project.id} className="hk-embed-list-row">
                <div>
                  <strong>{project.name}</strong>
                  <p>{project.path}</p>
                </div>
                <span>{project.exists ? "●" : "○"}</span>
              </article>
            ))}
          </div>
        )
      }
    />
  );
}

function Kits({
  language,
  revision,
}: {
  language: Language;
  revision: number;
}) {
  const { api } = useHarnessKitRuntime();
  const text = labels[language];
  return (
    <DataPage
      title={text.kits}
      language={language}
      revision={revision}
      loader={useMemo(() => () => api.listKits(), [api])}
      render={(kits: KitSummary[]) =>
        kits.length === 0 ? (
          <p className="hk-embed-empty">{text.empty}</p>
        ) : (
          <div className="hk-embed-grid">
            {kits.map((kit) => (
              <article key={kit.id} className="hk-embed-card">
                <span className="hk-agent-initial" aria-hidden="true">
                  KT
                </span>
                <div>
                  <strong>{kit.name}</strong>
                  <p>{kit.description}</p>
                  <small>{kit.extension_count} extensions</small>
                </div>
              </article>
            ))}
          </div>
        )
      }
    />
  );
}

const navItems: Array<{
  path: string;
  label: keyof (typeof labels)["en"];
  icon: ComponentType<{ size?: number; "aria-hidden"?: boolean }>;
}> = [
  { path: "/overview", label: "overview", icon: LayoutDashboard },
  { path: "/extensions", label: "extensions", icon: Blocks },
  { path: "/agents", label: "agents", icon: Bot },
  { path: "/audit", label: "audit", icon: ShieldCheck },
  { path: "/marketplace", label: "marketplace", icon: ShoppingBag },
  { path: "/projects", label: "projects", icon: Boxes },
  { path: "/kits", label: "kits", icon: Package },
];

function RouteBridge({
  route,
  onNavigate,
}: {
  route: string;
  onNavigate(route: string): void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const prevPropRoute = useRef<string>(normalizeRoute(route));

  useEffect(() => {
    const target = normalizeRoute(route);
    if (prevPropRoute.current !== target) {
      prevPropRoute.current = target;
      if (location.pathname !== target) {
        navigate(target, { replace: true });
      }
    }
  }, [navigate, route, location.pathname]);

  useEffect(() => {
    onNavigate(`${location.pathname}${location.search}`);
  }, [location.pathname, location.search, onNavigate]);

  return null;
}

function EmbeddedShell({
  language,
  route,
  scopePath,
  revision,
  onRefresh,
  onNavigate,
}: {
  language: Language;
  route: string;
  scopePath?: string;
  revision: number;
  onRefresh(): void;
  onNavigate(route: string): void;
}) {
  const text = labels[language];
  return (
    <div className="hk-embed-shell">
      <RouteBridge route={route} onNavigate={onNavigate} />
      <aside className="hk-embed-sidebar">
        <div className="hk-embed-brand">
          <span className="hk-embed-mark" aria-hidden="true">
            1A
          </span>
          <strong>{text.product}</strong>
        </div>
        <nav aria-label={text.product}>
          {navItems.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                isActive ? "hk-embed-nav is-active" : "hk-embed-nav"
              }
            >
              <Icon size={17} aria-hidden />
              <span>{text[label]}</span>
            </NavLink>
          ))}
        </nav>
        {scopePath ? (
          <div className="hk-embed-scope" title={scopePath}>
            <small>{text.scope}</small>
            <span>{scopePath}</span>
          </div>
        ) : null}
      </aside>
      <main className="hk-embed-main">
        <button
          type="button"
          className="hk-embed-refresh"
          onClick={onRefresh}
          aria-label={text.refresh}
          title={text.refresh}
        >
          <RefreshCw size={16} aria-hidden="true" />
        </button>
        <Routes>
          <Route
            path="/overview"
            element={<Overview language={language} revision={revision} />}
          />
          <Route
            path="/extensions"
            element={
              <Extensions
                language={language}
                revision={revision}
                scopePath={scopePath}
              />
            }
          />
          <Route
            path="/agents"
            element={<Agents language={language} revision={revision} />}
          />
          <Route
            path="/audit"
            element={<Audit language={language} revision={revision} />}
          />
          <Route
            path="/marketplace"
            element={<Marketplace language={language} />}
          />
          <Route
            path="/projects"
            element={<Projects language={language} revision={revision} />}
          />
          <Route
            path="/kits"
            element={<Kits language={language} revision={revision} />}
          />
          <Route path="*" element={<Navigate to="/overview" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export function HarnessKitEmbeddedApp({
  runtime,
  initialRoute,
  route,
  theme,
  language,
  scopePath,
  revision,
  onRefresh,
  onNavigate,
}: {
  runtime: HarnessKitEmbedRuntime;
  initialRoute: string;
  route: string;
  theme: EmbeddedTheme;
  language: string;
  scopePath?: string;
  revision: number;
  onRefresh(): void;
  onNavigate(route: string): void;
}) {
  const normalizedLanguage = normalizeLanguage(language);
  const resolvedTheme =
    theme === "system"
      ? typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;
  return (
    <HarnessKitRuntimeProvider runtime={runtime}>
      <div
        className="hk-embed-root"
        data-theme="tiesen"
        data-color-mode={resolvedTheme}
        lang={normalizedLanguage}
      >
        <MemoryRouter initialEntries={[normalizeRoute(initialRoute)]}>
          <EmbeddedShell
            language={normalizedLanguage}
            route={route}
            scopePath={scopePath}
            revision={revision}
            onRefresh={onRefresh}
            onNavigate={onNavigate}
          />
        </MemoryRouter>
      </div>
    </HarnessKitRuntimeProvider>
  );
}
