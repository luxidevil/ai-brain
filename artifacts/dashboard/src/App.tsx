import { useEffect, useState, useCallback } from "react";

type Status = "checking" | "ok" | "error";
type Tab = "overview" | "messages" | "actions" | "logs";

const API = "/api";

function StatusDot({ status }: { status: Status }) {
  const colors: Record<Status, string> = {
    checking: "bg-yellow-400 animate-pulse",
    ok: "bg-green-500",
    error: "bg-red-500",
  };
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${colors[status]}`} />;
}

function Badge({ children, color = "blue" }: { children: React.ReactNode; color?: string }) {
  const map: Record<string, string> = {
    blue: "bg-blue-100 text-blue-700",
    green: "bg-green-100 text-green-700",
    purple: "bg-purple-100 text-purple-700",
    orange: "bg-orange-100 text-orange-700",
    red: "bg-red-100 text-red-700",
    gray: "bg-gray-100 text-gray-600",
    yellow: "bg-yellow-100 text-yellow-700",
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${map[color] ?? map.blue}`}>
      {children}
    </span>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white border border-gray-200 rounded-xl shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
      <div className="text-4xl mb-3">📭</div>
      <p className="text-sm">{label}</p>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function roleBadgeColor(role: string) {
  const map: Record<string, string> = {
    user: "blue",
    assistant: "green",
    system: "gray",
    agent: "purple",
  };
  return map[role] ?? "gray";
}

function statusBadgeColor(status: string) {
  const map: Record<string, string> = {
    active: "green",
    inactive: "gray",
    archived: "orange",
  };
  return map[status] ?? "gray";
}

function httpBadgeColor(method: string) {
  const map: Record<string, string> = {
    GET: "blue",
    POST: "green",
    PUT: "yellow",
    DELETE: "red",
    PATCH: "orange",
  };
  return map[method] ?? "gray";
}

function statusCodeColor(code: number) {
  if (code < 300) return "green";
  if (code < 400) return "yellow";
  return "red";
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// ─── Overview Tab ────────────────────────────────────────────────────────────
function OverviewTab({ apiStatus, mongoStatus, health }: {
  apiStatus: Status;
  mongoStatus: Status;
  health: Record<string, unknown> | null;
}) {
  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-5">Architecture</h2>
        <div className="flex items-stretch gap-3">
          <div className="flex-1 rounded-lg border border-blue-200 bg-blue-50 p-4 text-center">
            <div className="text-2xl mb-2">🌐</div>
            <div className="font-semibold text-blue-900 text-sm">Other Agent / App</div>
            <div className="text-xs text-blue-600 mt-1">Sends data via /api/sync</div>
          </div>
          <div className="flex items-center text-gray-400 text-xl">→</div>
          <div className="flex-1 rounded-lg border border-violet-200 bg-violet-50 p-4 text-center relative">
            <div className="text-2xl mb-2">⚙️</div>
            <div className="font-semibold text-violet-900 text-sm">Express API Server</div>
            <div className="text-xs text-violet-600 mt-1">Routes & middleware</div>
            {apiStatus === "ok" && (
              <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">Live</span>
            )}
          </div>
          <div className="flex items-center text-gray-400 text-xl">→</div>
          <div className="flex-1 rounded-lg border border-green-200 bg-green-50 p-4 text-center relative">
            <div className="text-2xl mb-2">🍃</div>
            <div className="font-semibold text-green-900 text-sm">MongoDB Atlas</div>
            <div className="text-xs text-green-600 mt-1">Messages · Actions · Logs</div>
            {mongoStatus === "ok" && (
              <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">Connected</span>
            )}
          </div>
        </div>

        {health && (
          <div className="mt-5 border-t border-gray-100 pt-4">
            <div className="text-xs font-semibold text-gray-400 uppercase mb-2">Live — GET /api/healthz</div>
            <pre className="bg-gray-900 text-green-400 text-xs rounded-lg px-4 py-3 font-mono overflow-auto">
              {JSON.stringify(health, null, 2)}
            </pre>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">One-shot sync command</h2>
        <p className="text-sm text-gray-500 mb-3">Tell another agent to run this single command to send everything at once:</p>
        <pre className="bg-gray-900 text-green-400 text-xs rounded-lg px-4 py-4 font-mono overflow-auto whitespace-pre-wrap leading-relaxed">{`curl -X POST https://YOUR-DOMAIN/api/sync \\
  -H "Content-Type: application/json" \\
  -d '{
    "sessionId": "session-001",
    "messages": [
      { "role": "user", "content": "Hello!" },
      { "role": "agent", "content": "Hi! How can I help?" }
    ],
    "actions": [
      { "name": "file-edit", "data": { "file": "App.tsx", "action": "modified" } }
    ],
    "logs": [
      { "method": "POST", "path": "/api/sync", "statusCode": 201 }
    ]
  }'`}</pre>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[
            { label: "messages", desc: "Chat history by role & session", icon: "💬" },
            { label: "actions", desc: "Agent actions stored as items", icon: "⚡" },
            { label: "logs", desc: "Request/activity log entries", icon: "📋" },
          ].map((f) => (
            <div key={f.label} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <div className="text-lg mb-1">{f.icon}</div>
              <div className="font-semibold text-gray-800 text-sm font-mono">{f.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{f.desc}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── Messages Tab ────────────────────────────────────────────────────────────
function MessagesTab() {
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sessionFilter, setSessionFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (sessionFilter) params.set("sessionId", sessionFilter);
      if (roleFilter) params.set("role", roleFilter);
      const r = await fetch(`${API}/messages?${params}`);
      const j = await r.json();
      setData(j.data ?? []);
      setTotal(j.total ?? 0);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [sessionFilter, roleFilter]);

  useEffect(() => { load(); }, [load]);

  async function deleteOne(id: string) {
    setDeleting(id);
    await fetch(`${API}/messages/${id}`, { method: "DELETE" });
    setDeleting(null);
    load();
  }

  async function clearAll() {
    if (!confirm(sessionFilter ? `Clear all messages for session "${sessionFilter}"?` : "Clear ALL messages?")) return;
    const params = sessionFilter ? `?sessionId=${sessionFilter}` : "";
    await fetch(`${API}/messages${params}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Filter by sessionId..."
          value={sessionFilter}
          onChange={(e) => setSessionFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm flex-1 min-w-[180px] focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          <option value="">All roles</option>
          {["user", "assistant", "system", "agent"].map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <button onClick={load} className="px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 font-medium">Refresh</button>
        <button onClick={clearAll} className="px-3 py-1.5 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 font-medium">
          {sessionFilter ? "Clear session" : "Clear all"}
        </button>
        <span className="text-xs text-gray-400 ml-auto">{total} total</span>
      </div>

      <Card>
        {loading ? <Spinner /> : data.length === 0 ? (
          <EmptyState label="No messages yet. Use /api/sync or /api/messages to send some." />
        ) : (
          <div className="divide-y divide-gray-100">
            {data.map((msg) => (
              <div key={msg._id as string} className="px-5 py-3.5 flex items-start gap-3 hover:bg-gray-50">
                <div className="pt-0.5">
                  <Badge color={roleBadgeColor(msg.role as string)}>{msg.role as string}</Badge>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 leading-relaxed">{msg.content as string}</p>
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    {msg.sessionId && (
                      <span className="text-xs text-gray-400 font-mono">session: {msg.sessionId as string}</span>
                    )}
                    {msg.agentId && (
                      <span className="text-xs text-gray-400 font-mono">agent: {msg.agentId as string}</span>
                    )}
                    <span className="text-xs text-gray-400">{timeAgo(msg.createdAt as string)}</span>
                  </div>
                </div>
                <button
                  onClick={() => deleteOne(msg._id as string)}
                  disabled={deleting === (msg._id as string)}
                  className="text-xs text-red-400 hover:text-red-600 shrink-0 mt-0.5"
                >
                  {deleting === (msg._id as string) ? "..." : "Delete"}
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Actions Tab ─────────────────────────────────────────────────────────────
function ActionsTab() {
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/items?limit=50`);
      const j = await r.json();
      setData(j.data ?? []);
      setTotal(j.total ?? 0);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function deleteOne(id: string) {
    setDeleting(id);
    await fetch(`${API}/items/${id}`, { method: "DELETE" });
    setDeleting(null);
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-sm text-gray-500">Actions are stored as items in MongoDB</h2>
        <button onClick={load} className="ml-auto px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 font-medium">Refresh</button>
        <span className="text-xs text-gray-400">{total} total</span>
      </div>

      <Card>
        {loading ? <Spinner /> : data.length === 0 ? (
          <EmptyState label='No actions yet. Include an "actions" array in your /api/sync call.' />
        ) : (
          <div className="divide-y divide-gray-100">
            {data.map((item) => (
              <div key={item._id as string} className="px-5 py-3.5 flex items-start gap-3 hover:bg-gray-50">
                <div className="pt-0.5">
                  <Badge color={statusBadgeColor(item.status as string)}>{item.status as string}</Badge>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-gray-800">{item.name as string}</div>
                  {item.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{item.description as string}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {(item.tags as string[])?.map((tag) => (
                      <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono">{tag}</span>
                    ))}
                    <span className="text-xs text-gray-400">{timeAgo(item.createdAt as string)}</span>
                  </div>
                  {item.data && (
                    <pre className="mt-2 bg-gray-50 border border-gray-100 rounded text-xs font-mono text-gray-600 px-2 py-1.5 overflow-auto max-h-24">
                      {JSON.stringify(item.data, null, 2)}
                    </pre>
                  )}
                </div>
                <button
                  onClick={() => deleteOne(item._id as string)}
                  disabled={deleting === (item._id as string)}
                  className="text-xs text-red-400 hover:text-red-600 shrink-0 mt-0.5"
                >
                  {deleting === (item._id as string) ? "..." : "Delete"}
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Logs Tab ─────────────────────────────────────────────────────────────────
function LogsTab() {
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [methodFilter, setMethodFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (methodFilter) params.set("method", methodFilter);
      const r = await fetch(`${API}/logs?${params}`);
      const j = await r.json();
      setData(j.data ?? []);
      setTotal(j.total ?? 0);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [methodFilter]);

  useEffect(() => { load(); }, [load]);

  async function clearAll() {
    if (!confirm("Clear all logs?")) return;
    await fetch(`${API}/logs`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={methodFilter}
          onChange={(e) => setMethodFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          <option value="">All methods</option>
          {["GET", "POST", "PUT", "DELETE", "PATCH"].map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <button onClick={load} className="px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 font-medium">Refresh</button>
        <button onClick={clearAll} className="px-3 py-1.5 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 font-medium">Clear all</button>
        <span className="text-xs text-gray-400 ml-auto">{total} total</span>
      </div>

      <Card>
        {loading ? <Spinner /> : data.length === 0 ? (
          <EmptyState label="No logs yet. Every API request is recorded automatically." />
        ) : (
          <div className="divide-y divide-gray-100">
            {data.map((log) => (
              <div key={log._id as string} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50 font-mono text-xs">
                <Badge color={httpBadgeColor(log.method as string)}>{log.method as string}</Badge>
                <span className="text-gray-700 flex-1 truncate">{log.path as string}</span>
                <Badge color={statusCodeColor(log.statusCode as number)}>{log.statusCode as number}</Badge>
                {log.durationMs != null && (
                  <span className="text-gray-400">{log.durationMs as number}ms</span>
                )}
                <span className="text-gray-400 font-sans">{timeAgo(log.createdAt as string)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [apiStatus, setApiStatus] = useState<Status>("checking");
  const [mongoStatus, setMongoStatus] = useState<Status>("checking");
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    fetch(`${API}/healthz`)
      .then((r) => r.json())
      .then((d) => {
        setApiStatus("ok");
        setMongoStatus(d.mongodb === "connected" ? "ok" : "error");
        setHealth(d);
      })
      .catch(() => {
        setApiStatus("error");
        setMongoStatus("error");
      });
  }, []);

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "messages", label: "Messages" },
    { id: "actions", label: "Actions" },
    { id: "logs", label: "Logs" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">API Manager</h1>
            <p className="text-sm text-gray-500 mt-0.5">MongoDB · Express · Open Source</p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <StatusDot status={apiStatus} />
              <span className="text-gray-600">API Server</span>
            </div>
            <div className="flex items-center gap-2">
              <StatusDot status={mongoStatus} />
              <span className="text-gray-600">MongoDB</span>
            </div>
            <a
              href="/api/docs"
              target="_blank"
              rel="noreferrer"
              className="text-xs font-medium text-blue-600 hover:text-blue-700 border border-blue-200 rounded-lg px-3 py-1.5 hover:bg-blue-50"
            >
              API Docs ↗
            </a>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-5xl mx-auto mt-4 flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                tab === t.id
                  ? "bg-gray-900 text-white"
                  : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-6">
        {tab === "overview" && <OverviewTab apiStatus={apiStatus} mongoStatus={mongoStatus} health={health} />}
        {tab === "messages" && <MessagesTab />}
        {tab === "actions" && <ActionsTab />}
        {tab === "logs" && <LogsTab />}
      </div>
    </div>
  );
}
