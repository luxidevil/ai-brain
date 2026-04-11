import { useEffect, useState, useCallback } from "react";

type Status = "checking" | "ok" | "error";
type Tab = "thoughts" | "overview" | "howto";

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
    cyan: "bg-cyan-100 text-cyan-700",
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

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString(undefined, {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

interface TimelineEntry {
  type: "message" | "planning" | "action";
  role?: string;
  content?: string;
  name?: string;
  description?: string;
  data?: unknown;
  metadata?: Record<string, unknown>;
  status?: string;
  tags?: string[];
  sessionId?: string;
  createdAt: string;
}

function buildTimeline(thought: Record<string, unknown>): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  const messages = (thought.messages ?? []) as Record<string, unknown>[];
  for (const m of messages) {
    const meta = m.metadata as Record<string, unknown> | null;
    const isPlanning = meta && meta.type === "planning";
    entries.push({
      type: isPlanning ? "planning" : "message",
      role: m.role as string,
      content: m.content as string,
      metadata: meta ?? undefined,
      sessionId: m.sessionId as string,
      createdAt: m.createdAt as string,
    });
  }

  const items = (thought.items ?? []) as Record<string, unknown>[];
  for (const item of items) {
    entries.push({
      type: "action",
      name: item.name as string,
      description: item.description as string,
      data: item.data,
      status: item.status as string,
      tags: item.tags as string[],
      sessionId: item.sessionId as string,
      createdAt: item.createdAt as string,
    });
  }

  entries.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return entries;
}

function ChatBubble({ entry }: { entry: TimelineEntry }) {
  if (entry.type === "planning") {
    return (
      <div className="flex gap-3 items-start py-3">
        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-sm shrink-0">🧠</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-amber-700">Planning</span>
            {entry.sessionId && <span className="text-xs text-gray-400 font-mono">#{entry.sessionId}</span>}
            <span className="text-xs text-gray-400">{formatTime(entry.createdAt)}</span>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
            {entry.content}
          </div>
        </div>
      </div>
    );
  }

  if (entry.type === "action") {
    return (
      <div className="flex gap-3 items-start py-3">
        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-sm shrink-0">⚡</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-purple-700">Action</span>
            <span className="text-xs font-mono text-gray-600">{entry.name}</span>
            {entry.sessionId && <span className="text-xs text-gray-400 font-mono">#{entry.sessionId}</span>}
            <span className="text-xs text-gray-400">{formatTime(entry.createdAt)}</span>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-3">
            {entry.description && <p className="text-sm text-gray-700">{entry.description}</p>}
            {entry.data && (
              <pre className="mt-2 text-xs text-gray-600 font-mono bg-white rounded px-3 py-2 overflow-auto max-h-32">
                {JSON.stringify(entry.data, null, 2)}
              </pre>
            )}
          </div>
        </div>
      </div>
    );
  }

  const isUser = entry.role === "user";
  const isAgent = entry.role === "agent" || entry.role === "assistant";
  const isSystem = entry.role === "system";

  const avatarBg = isUser ? "bg-blue-100" : isAgent ? "bg-green-100" : "bg-gray-100";
  const avatarIcon = isUser ? "👤" : isAgent ? "🤖" : "⚙️";
  const bubbleBg = isUser
    ? "bg-blue-50 border-blue-200"
    : isAgent
    ? "bg-green-50 border-green-200"
    : "bg-gray-50 border-gray-200";
  const labelColor = isUser ? "text-blue-700" : isAgent ? "text-green-700" : "text-gray-500";

  return (
    <div className={`flex gap-3 items-start py-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div className={`w-8 h-8 rounded-full ${avatarBg} flex items-center justify-center text-sm shrink-0`}>{avatarIcon}</div>
      <div className={`flex-1 min-w-0 ${isUser ? "flex flex-col items-end" : ""}`}>
        <div className={`flex items-center gap-2 mb-1 ${isUser ? "flex-row-reverse" : ""}`}>
          <span className={`text-xs font-semibold ${labelColor}`}>{entry.role}</span>
          {entry.sessionId && <span className="text-xs text-gray-400 font-mono">#{entry.sessionId}</span>}
          <span className="text-xs text-gray-400">{formatTime(entry.createdAt)}</span>
        </div>
        <div className={`border rounded-lg px-4 py-3 text-sm text-gray-800 leading-relaxed whitespace-pre-wrap ${bubbleBg} ${isUser ? "max-w-[80%]" : ""}`}>
          {entry.content}
        </div>
      </div>
    </div>
  );
}

function ThoughtChatView({ thoughtId, onBack }: { thoughtId: string; onBack: () => void }) {
  const [thought, setThought] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionFilter, setSessionFilter] = useState("");

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`${API}/brain/${thoughtId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setThought(data);
        }
      })
      .catch(() => setError("Failed to load thought"))
      .finally(() => setLoading(false));
  }, [thoughtId]);

  if (loading) return <Spinner />;
  if (error) return <EmptyState label={error} />;
  if (!thought) return <EmptyState label="No data" />;

  const timeline = buildTimeline(thought);
  const sessions = [...new Set(timeline.filter((e) => e.sessionId).map((e) => e.sessionId))];
  const filtered = sessionFilter
    ? timeline.filter((e) => e.sessionId === sessionFilter)
    : timeline;

  const counts = thought.counts as Record<string, number>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={onBack} className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium">
          ← Back
        </button>
        <h2 className="text-lg font-bold text-gray-900">{thoughtId}</h2>
        {thought.description && (
          <span className="text-sm text-gray-500">— {thought.description as string}</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Badge color="blue">{counts.messages} messages</Badge>
          <Badge color="purple">{counts.items} actions</Badge>
          <Badge color="gray">{counts.logs} logs</Badge>
        </div>
      </div>

      {sessions.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 font-medium">Sessions:</span>
          <button
            onClick={() => setSessionFilter("")}
            className={`text-xs px-2 py-1 rounded-full font-medium ${!sessionFilter ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            All
          </button>
          {sessions.map((s) => (
            <button
              key={s}
              onClick={() => setSessionFilter(s!)}
              className={`text-xs px-2 py-1 rounded-full font-mono font-medium ${sessionFilter === s ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <Card className="px-5 py-2">
        {filtered.length === 0 ? (
          <EmptyState label="No entries for this filter" />
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map((entry, i) => (
              <ChatBubble key={i} entry={entry} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function ThoughtsTab() {
  const [thoughts, setThoughts] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/brain`);
      const j = await r.json();
      setThoughts(j.thoughts ?? []);
    } catch {
      setThoughts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (selected) {
    return <ThoughtChatView thoughtId={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">All Thoughts</h2>
        <button onClick={load} className="px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 font-medium">Refresh</button>
        <span className="text-xs text-gray-400 ml-auto">{thoughts.length} thoughts</span>
      </div>

      {loading ? <Spinner /> : thoughts.length === 0 ? (
        <EmptyState label="No thoughts in the brain yet. Create one via POST /api/brain" />
      ) : (
        <div className="grid gap-3">
          {thoughts.map((t) => {
            const counts = t.counts as Record<string, number>;
            return (
              <Card key={t.thoughtId as string} className="p-5 cursor-pointer hover:border-blue-300 hover:shadow-md transition-all" >
                <div onClick={() => setSelected(t.thoughtId as string)} className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-lg shrink-0">
                    💭
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-gray-900">{t.thoughtId as string}</h3>
                      {t.key ? (
                        <Badge color="green">has key</Badge>
                      ) : (
                        <Badge color="yellow">legacy</Badge>
                      )}
                    </div>
                    {t.description && (t.description as string) !== "(legacy - no key assigned)" && (
                      <p className="text-sm text-gray-500 mt-0.5">{t.description as string}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-gray-500">💬 {counts.messages} messages</span>
                      <span className="text-xs text-gray-500">⚡ {counts.items} actions</span>
                      <span className="text-xs text-gray-500">📋 {counts.logs} logs</span>
                      <span className="text-xs font-semibold text-gray-700 ml-auto">{t.total as number} total</span>
                    </div>
                  </div>
                  <div className="text-gray-400 text-xl">→</div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

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
            <div className="font-semibold text-blue-900 text-sm">Agent / App</div>
            <div className="text-xs text-blue-600 mt-1">Uses thought key</div>
          </div>
          <div className="flex items-center text-gray-400 text-xl">→</div>
          <div className="flex-1 rounded-lg border border-violet-200 bg-violet-50 p-4 text-center relative">
            <div className="text-2xl mb-2">🧠</div>
            <div className="font-semibold text-violet-900 text-sm">Brain API</div>
            <div className="text-xs text-violet-600 mt-1">Auth + Routes</div>
            {apiStatus === "ok" && (
              <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">Live</span>
            )}
          </div>
          <div className="flex items-center text-gray-400 text-xl">→</div>
          <div className="flex-1 rounded-lg border border-green-200 bg-green-50 p-4 text-center relative">
            <div className="text-2xl mb-2">🍃</div>
            <div className="font-semibold text-green-900 text-sm">MongoDB Atlas</div>
            <div className="text-xs text-green-600 mt-1">Thoughts + Data</div>
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
    </div>
  );
}

function CopyBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <div className="relative group">
      {label && <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{label}</div>}
      <pre className="bg-gray-900 text-green-400 text-xs rounded-lg px-4 py-4 font-mono overflow-auto whitespace-pre-wrap leading-relaxed">
        {code}
      </pre>
      <button
        onClick={copy}
        className="absolute top-3 right-3 text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 px-2 py-1 rounded transition-colors"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}

function HowToTab() {
  const domain = typeof window !== "undefined" ? window.location.origin : "https://YOUR-DOMAIN";

  const listThoughts = `curl "${domain}/api/brain" \\
  -H "Authorization: Bearer YOUR-BRAIN-TOKEN"`;

  const createThought = `curl -X POST "${domain}/api/brain" \\
  -H "Authorization: Bearer YOUR-BRAIN-TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"thoughtId": "my-project", "description": "My cool project"}'

# Response includes the thought key:
# {"thoughtId":"my-project","key":"tk_abc123...","message":"Thought created."}`;

  const readThought = `curl "${domain}/api/brain/my-project" \\
  -H "Authorization: Bearer tk_YOUR-THOUGHT-KEY"`;

  const pushData = `curl -X POST "${domain}/api/brain/my-project/sync" \\
  -H "Authorization: Bearer tk_YOUR-THOUGHT-KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "sessionId": "session-001",
    "messages": [
      { "role": "user", "content": "Build me a login page" },
      { "role": "assistant", "content": "I will create a login page with email and password fields..." }
    ],
    "planning": [
      { "content": "The user wants a login page. I need to create the form component, add validation, set up the API endpoint with bcrypt..." }
    ],
    "actions": [
      { "name": "created-file", "description": "Created login.tsx", "data": { "file": "src/login.tsx" } },
      { "name": "installed-package", "description": "Installed bcrypt" }
    ]
  }'`;

  const agentPrompt = `You have a memory API. Before doing anything, read your memory:

curl "${domain}/api/brain/PROJECT-NAME" \\
  -H "Authorization: Bearer tk_YOUR-THOUGHT-KEY"

This returns every message, decision, and action from all past sessions.
Read it fully before writing any code. Continue from where the last session left off.

At the end of this session, save everything back:

curl -X POST "${domain}/api/brain/PROJECT-NAME/sync" \\
  -H "Authorization: Bearer tk_YOUR-THOUGHT-KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "sessionId": "session-XXX",
    "messages": [ ...all messages from this session... ],
    "planning": [ ...every thought and decision you made... ],
    "actions":  [ ...files changed, commands run, packages installed... ]
  }'`;

  return (
    <div className="space-y-8">
      <Card className="p-6 border-l-4 border-l-blue-500">
        <h2 className="font-bold text-gray-900 mb-1">How the Brain works</h2>
        <p className="text-sm text-gray-600 leading-relaxed">
          <strong>Brain</strong> = your server (master token).
          <strong> Thought</strong> = a project (its own key).
          Each thought contains messages, planning, actions, and logs. An agent only needs the thought key to read/write its data — no brain access needed.
        </p>
        <div className="mt-4 flex items-start gap-3 flex-wrap text-xs font-mono">
          {[
            { icon: "🧠", label: "Brain (master)", color: "bg-gray-100 text-gray-700" },
            { icon: "→", label: "", color: "" },
            { icon: "💭", label: "Thought (own key)", color: "bg-blue-100 text-blue-700" },
            { icon: "→", label: "", color: "" },
            { icon: "💬", label: "Messages + Planning + Actions", color: "bg-green-100 text-green-700" },
          ].map((item, i) =>
            item.label ? (
              <span key={i} className={`px-2 py-1 rounded-full font-semibold ${item.color}`}>
                {item.icon} {item.label}
              </span>
            ) : (
              <span key={i} className="text-gray-300">{item.icon}</span>
            )
          )}
        </div>
      </Card>

      <Card className="p-6 space-y-6">
        <h2 className="font-bold text-gray-900">1. List all thoughts (brain token)</h2>
        <CopyBlock code={listThoughts} />
      </Card>

      <Card className="p-6 space-y-6">
        <h2 className="font-bold text-gray-900">2. Create a thought (brain token)</h2>
        <CopyBlock code={createThought} />
      </Card>

      <Card className="p-6 space-y-6">
        <h2 className="font-bold text-gray-900">3. Read a thought (thought key)</h2>
        <CopyBlock code={readThought} />
      </Card>

      <Card className="p-6 space-y-6">
        <h2 className="font-bold text-gray-900">4. Push data into a thought (thought key)</h2>
        <CopyBlock code={pushData} />
      </Card>

      <Card className="p-6 space-y-6 border-l-4 border-l-purple-500">
        <h2 className="font-bold text-gray-900">Agent prompt template</h2>
        <p className="text-sm text-gray-500">Paste this into your agent's system prompt so it reads/writes its brain automatically:</p>
        <CopyBlock code={agentPrompt} />
      </Card>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>("thoughts");
  const [apiStatus, setApiStatus] = useState<Status>("checking");
  const [mongoStatus, setMongoStatus] = useState<Status>("checking");
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    fetch(`${API}/healthz`)
      .then((r) => r.json())
      .then((data) => {
        setHealth(data);
        setApiStatus(data.status === "ok" ? "ok" : "error");
        setMongoStatus(data.mongodb === "connected" ? "ok" : "error");
      })
      .catch(() => {
        setApiStatus("error");
        setMongoStatus("error");
      });
  }, []);

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "thoughts", label: "Thoughts", icon: "💭" },
    { key: "overview", label: "Overview", icon: "📊" },
    { key: "howto", label: "How To", icon: "📖" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900">🧠 Agent Brain</h1>
            <div className="flex items-center gap-1.5 ml-2">
              <StatusDot status={apiStatus} />
              <span className="text-xs text-gray-500">API</span>
            </div>
            <div className="flex items-center gap-1.5">
              <StatusDot status={mongoStatus} />
              <span className="text-xs text-gray-500">MongoDB</span>
            </div>
          </div>
          <nav className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors font-medium ${
                  tab === t.key
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {tab === "thoughts" && <ThoughtsTab />}
        {tab === "overview" && <OverviewTab apiStatus={apiStatus} mongoStatus={mongoStatus} health={health} />}
        {tab === "howto" && <HowToTab />}
      </main>
    </div>
  );
}
