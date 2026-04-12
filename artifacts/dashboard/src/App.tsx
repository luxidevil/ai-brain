import { useState, useEffect, useCallback } from "react";

type Status = "checking" | "ok" | "error";
type Tab = "thoughts" | "overview" | "howto";

const API = "/api";

interface Thought {
  thoughtId: string;
  description: string;
  key: string | null;
  counts: { messages: number; items: number; logs: number };
  total: number;
  createdAt: string | null;
}

interface HealthData {
  status: string;
  mongodb: string;
  uptime: number;
}

interface TimelineEntry {
  type: string;
  role?: string;
  content?: string;
  name?: string;
  description?: string;
  data?: unknown;
  metadata?: Record<string, unknown>;
  status?: string;
  tags?: string[];
  sessionId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  createdAt: string;
}

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
    amber: "bg-amber-100 text-amber-700",
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${map[color] ?? map.blue}`}>
      {children}
    </span>
  );
}

function Card({ children, className = "", ...rest }: { children: React.ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`bg-white border border-gray-200 rounded-xl shadow-sm ${className}`} {...rest}>
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

// ── LandingPage ─────────────────────────────────────────────────────────────

function LandingPage({ onToken }: { onToken: (t: string) => void }) {
  const [input, setInput] = useState("");
  const [showToken, setShowToken] = useState(false);
  const host = window.location.origin;

  const exampleSnippet = `import requests

HEADERS = {"Authorization": "Bearer YOUR_THOUGHT_KEY"}

# Write — sync agent activity
requests.post("${host}/api/sync", headers=HEADERS, json={
    "messages": [{"role": "assistant", "content": "Done."}],
    "planning": [{"content": "Thinking step", "step": 1}],
    "actions": [{"name": "search", "description": "Searched web"}],
})

# Read — fetch full context
ctx = requests.get("${host}/api/sync/context", headers=HEADERS).json()`;

  const features = [
    { icon: "💭", title: "Thought Namespaces", desc: "Each project gets its own isolated memory space with a unique Thought Key." },
    { icon: "🔑", title: "Brain Token + Thought Keys", desc: "Master access via Brain Token. Per-project agents use scoped Thought Keys — no cross-contamination." },
    { icon: "📨", title: "Messages, Planning & Actions", desc: "Store full conversation history, thinking steps, tool calls, and logs in a single sync call." },
    { icon: "📖", title: "Read by AI", desc: "Agents can fetch their entire context in one call — ready to paste into any prompt." },
    { icon: "🗄️", title: "MongoDB Backed", desc: "All data persisted in MongoDB. Bring your own URI or use the default shared instance." },
    { icon: "⚡", title: "REST API", desc: "Dead-simple HTTP API. Works with any language, any framework, any agent." },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Nav */}
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <span className="text-lg font-bold">🧠 Agent Brain</span>
        <button
          onClick={() => setShowToken(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-sm font-semibold rounded-lg transition-colors"
        >
          Open Dashboard →
        </button>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-950 border border-blue-800 text-blue-300 text-xs font-medium px-3 py-1.5 rounded-full mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          MongoDB-backed · REST API · Any agent, any language
        </div>
        <h1 className="text-5xl font-extrabold tracking-tight mb-5 bg-gradient-to-br from-white to-gray-400 bg-clip-text text-transparent">
          Persistent Memory<br />for AI Agents
        </h1>
        <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-10">
          Agent Brain gives your AI agents a shared, persistent memory store. Sync messages, planning steps, and actions across sessions — then read it all back in one call.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <button
            onClick={() => setShowToken(true)}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 font-semibold rounded-xl transition-colors text-sm"
          >
            Open Dashboard
          </button>
          <a
            href="#how-it-works"
            className="px-6 py-3 bg-gray-800 hover:bg-gray-700 font-semibold rounded-xl transition-colors text-sm"
          >
            How it works ↓
          </a>
        </div>
      </section>

      {/* Code snippet */}
      <section className="max-w-3xl mx-auto px-6 pb-20">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800">
            <span className="w-3 h-3 rounded-full bg-red-500/60" />
            <span className="w-3 h-3 rounded-full bg-yellow-500/60" />
            <span className="w-3 h-3 rounded-full bg-green-500/60" />
            <span className="text-xs text-gray-500 ml-2 font-mono">agent_memory.py</span>
          </div>
          <pre className="p-5 text-sm font-mono text-green-300 leading-relaxed overflow-x-auto whitespace-pre">
            {exampleSnippet}
          </pre>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <h2 className="text-2xl font-bold text-center mb-10">Everything your agent needs</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => (
            <div key={f.title} className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-600 transition-colors">
              <div className="text-2xl mb-3">{f.icon}</div>
              <h3 className="font-semibold text-white mb-1">{f.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="max-w-4xl mx-auto px-6 pb-20">
        <h2 className="text-2xl font-bold text-center mb-10">How it works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { step: "1", title: "Register", desc: "Call POST /api/auth/register to get your Brain Token. Create a Thought for each project — you get a scoped Thought Key." },
            { step: "2", title: "Sync", desc: "Your agent POSTs to /api/sync with its Thought Key. Messages, planning steps, and actions are saved automatically." },
            { step: "3", title: "Read", desc: "On the next run, GET /api/sync/context returns the full event history — drop it straight into your system prompt." },
          ].map((s) => (
            <div key={s.step} className="relative bg-gray-900 border border-gray-800 rounded-xl p-6">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center mb-4">
                {s.step}
              </div>
              <h3 className="font-semibold text-white mb-2">{s.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Connect CTA */}
      <section className="max-w-xl mx-auto px-6 pb-24 text-center">
        <h2 className="text-2xl font-bold mb-3">Ready to connect?</h2>
        <p className="text-gray-400 text-sm mb-6">Enter your Brain Token to open the dashboard and manage your thoughts.</p>
        {showToken ? (
          <div className="flex gap-2">
            <input
              autoFocus
              type="password"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && input && onToken(input)}
              placeholder="bt_..."
              className="flex-1 px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-500"
            />
            <button
              onClick={() => input && onToken(input)}
              className="px-5 py-3 bg-blue-600 hover:bg-blue-500 text-sm font-semibold rounded-xl transition-colors"
            >
              Connect
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowToken(true)}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-500 font-semibold rounded-xl transition-colors"
          >
            Open Dashboard →
          </button>
        )}
      </section>

      <footer className="border-t border-gray-800 py-6 text-center text-xs text-gray-600">
        Agent Brain · {host}
      </footer>
    </div>
  );
}

// ── ChatBubble ───────────────────────────────────────────────────────────────

function ChatBubble({ entry }: { entry: TimelineEntry }) {
  if (entry.type === "planning") {
    return (
      <div className="flex gap-3 items-start py-3">
        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-sm shrink-0">🧠</div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-amber-700">Planning</span>
            <span className="text-xs text-gray-400">{formatTime(entry.createdAt)}</span>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-gray-700 whitespace-pre-wrap font-mono">
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
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-purple-700">Action</span>
            <Badge color="purple">{entry.name}</Badge>
            <span className="text-xs text-gray-400">{formatTime(entry.createdAt)}</span>
          </div>
          {entry.description && (
            <p className="text-sm text-gray-600 mb-1">{entry.description}</p>
          )}
          {entry.tags && entry.tags.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {entry.tags.map((tag) => (
                <Badge key={tag} color="gray">{tag}</Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (entry.type === "log") {
    const isError = (entry.statusCode ?? 0) >= 400;
    return (
      <div className="flex gap-3 items-start py-2">
        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs shrink-0 font-mono text-gray-500">
          {entry.method?.slice(0, 3)}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-mono ${isError ? "text-red-600" : "text-gray-600"}`}>
              {entry.method} {entry.path}
            </span>
            <Badge color={isError ? "red" : "green"}>{entry.statusCode}</Badge>
            <span className="text-xs text-gray-400">{formatTime(entry.createdAt)}</span>
          </div>
        </div>
      </div>
    );
  }

  // message
  const isUser = entry.role === "user";
  const isAssistant = entry.role === "assistant";
  const isSystem = entry.role === "system";

  const avatarBg = isUser ? "bg-blue-500" : isAssistant ? "bg-green-500" : "bg-gray-400";
  const avatarLabel = isUser ? "U" : isAssistant ? "A" : "S";

  return (
    <div className={`flex gap-3 items-start py-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div className={`w-8 h-8 rounded-full ${avatarBg} flex items-center justify-center text-xs font-bold text-white shrink-0`}>
        {avatarLabel}
      </div>
      <div className={`flex-1 max-w-[80%] ${isUser ? "items-end flex flex-col" : ""}`}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs text-gray-400 capitalize">{entry.role}</span>
          <span className="text-xs text-gray-400">{formatTime(entry.createdAt)}</span>
        </div>
        <div className={`rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
          isUser
            ? "bg-blue-600 text-white rounded-tr-sm"
            : isSystem
              ? "bg-gray-100 text-gray-600 font-mono text-xs border border-gray-200 rounded-tl-sm"
              : "bg-white border border-gray-200 text-gray-800 rounded-tl-sm"
        }`}>
          {entry.content}
        </div>
      </div>
    </div>
  );
}

// ── ReadByAI Modal ────────────────────────────────────────────────────────

function ReadByAIModal({
  thoughtId,
  token,
  onClose,
}: {
  thoughtId: string;
  token: string;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await fetch(
          `${API}/sync/context?projectId=${encodeURIComponent(thoughtId)}&limit=300`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const d = await r.json();
        const events: Record<string, unknown>[] = d.events ?? [];

        const lines: string[] = [
          `=== AGENT BRAIN CONTEXT: ${thoughtId} ===`,
          `Retrieved: ${new Date().toLocaleString()}`,
          `Total events: ${events.length}`,
          "",
        ];

        for (const e of events) {
          if (e.type === "message") {
            lines.push(`[${String(e.role ?? "?").toUpperCase()}] ${String(e.content ?? "")}`);
          } else if (e.type === "planning") {
            lines.push(`[THINKING] ${String(e.content ?? "")}`);
          } else if (e.type === "action") {
            lines.push(`[ACTION:${String(e.name ?? "")}] ${String(e.description ?? "")}`);
          } else if (e.type === "log") {
            lines.push(`[LOG] ${String(e.method ?? "")} ${String(e.path ?? "")} → ${String(e.statusCode ?? "")}`);
          }
        }

        if (events.length === 0) {
          lines.push("(No events recorded yet for this thought)");
        }

        lines.push("", "=== END OF CONTEXT ===");
        setText(lines.join("\n"));
      } catch {
        setText("Failed to load context.");
      } finally {
        setLoading(false);
      }
    })();
  }, [thoughtId, token]);

  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <h3 className="font-bold text-gray-900">Read by AI</h3>
            <p className="text-xs text-gray-500 mt-0.5">Copy this and paste it into any AI assistant as context</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={copy}
              disabled={loading}
              className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {copied ? "Copied!" : "Copy All"}
            </button>
            <button onClick={onClose} className="px-3 py-1.5 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200">
              Close
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-5">
          {loading ? (
            <Spinner />
          ) : (
            <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap leading-relaxed bg-gray-50 rounded-lg p-4 border border-gray-200">
              {text}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

// ── AppendModal ───────────────────────────────────────────────────────────

function AppendModal({
  thoughtId,
  thoughtKey,
  token,
  onClose,
  onDone,
}: {
  thoughtId: string;
  thoughtKey?: string;
  token: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<"quick" | "json" | "code">("quick");
  const [codeLang, setCodeLang] = useState<"prompt" | "curl" | "python" | "js">("prompt");
  const [codeCopied, setCodeCopied] = useState(false);
  const [role, setRole] = useState<"user" | "assistant" | "system">("user");
  const [content, setContent] = useState("");
  const [jsonText, setJsonText] = useState(
    JSON.stringify(
      {
        messages: [{ role: "user", content: "Hello" }],
        planning: [{ content: "Thinking step", step: 1 }],
        actions: [{ name: "my-action", description: "Did something" }],
      },
      null,
      2
    )
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const host = window.location.origin;
  const keyDisplay = thoughtKey ?? "YOUR_THOUGHT_KEY";

  const codeSnippets: Record<"prompt" | "curl" | "python" | "js", string> = {
    prompt: `## Your Persistent Memory — Agent Brain

You have access to a persistent memory system called Agent Brain. This is your private memory store for this project (thought: "${thoughtId}"). Use it throughout your session to record what you do, what you think, and what actions you take. This memory persists across sessions — future versions of you will read it to pick up where you left off.

MEMORY ENDPOINT: ${host}/api/sync
YOUR KEY: ${keyDisplay}

---

SAVE YOUR WORK — call this after completing tasks, using tools, or finishing a thinking step:

  Method: POST ${host}/api/sync
  Header: Authorization: Bearer ${keyDisplay}
  Header: Content-Type: application/json
  Body:
  {
    "messages": [
      { "role": "assistant", "content": "What you just said or did" }
    ],
    "planning": [
      { "content": "Your reasoning or thinking step", "step": 1 }
    ],
    "actions": [
      { "name": "tool-name", "description": "Brief description of what you did" }
    ]
  }

You only need to include the fields relevant to what just happened. All fields are optional.

---

READ YOUR CONTEXT — call this at the start of each session to remember what you've done:

  Method: GET ${host}/api/sync/context
  Header: Authorization: Bearer ${keyDisplay}

The response contains your full event history in chronological order.

---

Use this memory proactively. The more you record, the more useful your memory becomes over time.`,

    curl: `# Write (sync messages/planning/actions to this thought)
curl -X POST ${host}/api/sync \\
  -H "Authorization: Bearer ${keyDisplay}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "messages": [{"role": "assistant", "content": "..."}],
    "planning": [{"content": "Thinking step", "step": 1}],
    "actions": [{"name": "tool-used", "description": "What happened"}]
  }'

# Read (fetch full context for this thought)
curl "${host}/api/sync/context" \\
  -H "Authorization: Bearer ${keyDisplay}"`,

    python: `import requests

BASE = "${host}/api"
HEADERS = {"Authorization": "Bearer ${keyDisplay}"}

# Write — sync messages, planning steps, actions
requests.post(f"{BASE}/sync", headers=HEADERS, json={
    "messages": [{"role": "assistant", "content": "..."}],
    "planning": [{"content": "Thinking step", "step": 1}],
    "actions": [{"name": "tool-used", "description": "What happened"}],
})

# Read — fetch full context for this thought
ctx = requests.get(f"{BASE}/sync/context", headers=HEADERS).json()
for event in ctx["events"]:
    print(event)`,

    js: `const BASE = "${host}/api";
const HEADERS = {
  "Authorization": "Bearer ${keyDisplay}",
  "Content-Type": "application/json",
};

// Write — sync messages, planning steps, actions
await fetch(\`\${BASE}/sync\`, {
  method: "POST",
  headers: HEADERS,
  body: JSON.stringify({
    messages: [{ role: "assistant", content: "..." }],
    planning: [{ content: "Thinking step", step: 1 }],
    actions: [{ name: "tool-used", description: "What happened" }],
  }),
});

// Read — fetch full context for this thought
const ctx = await fetch(\`\${BASE}/sync/context\`, { headers: HEADERS }).then(r => r.json());
ctx.events.forEach(e => console.log(e));`,
  };

  const copyCode = () => {
    navigator.clipboard.writeText(codeSnippets[codeLang]).then(() => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    });
  };

  const submit = async () => {
    setError(""); setSuccess(""); setSaving(true);
    try {
      let body: Record<string, unknown>;

      if (mode === "quick") {
        if (!content.trim()) { setError("Content cannot be empty"); setSaving(false); return; }
        body = {
          projectId: thoughtId,
          messages: [{ role, content: content.trim() }],
        };
      } else {
        let parsed: Record<string, unknown>;
        try { parsed = JSON.parse(jsonText); } catch { setError("Invalid JSON"); setSaving(false); return; }
        body = { projectId: thoughtId, ...parsed };
      }

      const r = await fetch(`${API}/sync`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const d = await r.json();
      if (!r.ok) { setError(d.error ?? "Failed"); setSaving(false); return; }
      setSuccess(`Saved ${d.saved ?? "?"} item(s) successfully`);
      setContent("");
      onDone();
      setTimeout(onClose, 1200);
    } catch {
      setError("Request failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <h3 className="font-bold text-gray-900">Append to Thought</h3>
            <p className="text-xs text-gray-500 mt-0.5">Add messages or data to <strong>{thoughtId}</strong></p>
          </div>
          <button onClick={onClose} className="px-3 py-1.5 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200">
            Cancel
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex gap-2">
            <button
              onClick={() => setMode("quick")}
              className={`flex-1 py-2 text-sm rounded-lg font-medium transition-colors ${mode === "quick" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >
              Quick Message
            </button>
            <button
              onClick={() => setMode("json")}
              className={`flex-1 py-2 text-sm rounded-lg font-medium transition-colors ${mode === "json" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >
              Paste JSON
            </button>
            <button
              onClick={() => setMode("code")}
              className={`flex-1 py-2 text-sm rounded-lg font-medium transition-colors ${mode === "code" ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >
              Copy Code
            </button>
          </div>

          {mode === "quick" && (
            <div className="space-y-3">
              <div className="flex gap-2">
                {(["user", "assistant", "system"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRole(r)}
                    className={`px-3 py-1.5 text-sm rounded-lg capitalize transition-colors ${role === r ? "bg-blue-100 text-blue-700 font-semibold" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <textarea
                autoFocus
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit(); }}
                placeholder="Type your message here... (Ctrl+Enter to submit)"
                rows={5}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
              />
            </div>
          )}

          {mode === "json" && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500">Paste a JSON object with <code className="bg-gray-100 px-1 rounded">messages</code>, <code className="bg-gray-100 px-1 rounded">planning</code>, <code className="bg-gray-100 px-1 rounded">actions</code>, or <code className="bg-gray-100 px-1 rounded">logs</code> arrays.</p>
              <textarea
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                rows={10}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
              />
            </div>
          )}

          {mode === "code" && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">
                {codeLang === "prompt"
                  ? "Paste this directly into any AI agent's system prompt or first message. It frames the API as the agent's own memory — agents accept this without resistance."
                  : "Copy and paste into your agent code. The Thought Key is pre-filled — it auto-binds to " + thoughtId + "."}
              </p>
              <div className="flex gap-2 flex-wrap">
                {(["prompt", "curl", "python", "js"] as const).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => { setCodeLang(lang); setCodeCopied(false); }}
                    className={`px-3 py-1.5 text-xs rounded-lg font-semibold transition-colors ${codeLang === lang ? "bg-orange-100 text-orange-700 border border-orange-300" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                  >
                    {lang === "prompt" ? "🤖 Agent Prompt" : lang === "js" ? "JavaScript" : lang === "curl" ? "cURL" : "Python"}
                  </button>
                ))}
              </div>
              <div className="relative">
                {codeLang === "prompt" ? (
                  <pre className="bg-amber-50 border border-amber-200 text-gray-800 text-xs rounded-lg p-4 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto font-sans">
                    {codeSnippets.prompt}
                  </pre>
                ) : (
                  <pre className="bg-gray-950 text-green-300 text-xs font-mono rounded-lg p-4 overflow-x-auto whitespace-pre leading-relaxed max-h-64 overflow-y-auto">
                    {codeSnippets[codeLang]}
                  </pre>
                )}
                <button
                  onClick={copyCode}
                  className={`absolute top-2 right-2 px-2.5 py-1 text-xs rounded-md transition-colors ${codeLang === "prompt" ? "bg-amber-600 hover:bg-amber-700 text-white" : "bg-gray-700 hover:bg-gray-600 text-white"}`}
                >
                  {codeCopied ? "✓ Copied!" : "Copy"}
                </button>
              </div>
            </div>
          )}

          {mode !== "code" && error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          {mode !== "code" && success && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{success}</p>}

          {mode !== "code" && (
            <button
              onClick={submit}
              disabled={saving}
              className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving..." : "Append to Thought"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── ThoughtDetail ─────────────────────────────────────────────────────────

function ThoughtDetail({
  thoughtId,
  token,
  onBack,
}: {
  thoughtId: string;
  token: string;
  onBack: () => void;
}) {
  const [data, setData] = useState<{
    messages: TimelineEntry[];
    items: TimelineEntry[];
    logs: TimelineEntry[];
    thought?: { key?: string; description?: string };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"timeline" | "secrets">("timeline");
  const [showReadAI, setShowReadAI] = useState(false);
  const [showAppend, setShowAppend] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/brain/${encodeURIComponent(thoughtId)}?limit=200`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error("Failed");
      const d = await r.json();
      setData(d);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [thoughtId, token]);

  useEffect(() => { load(); }, [load]);

  const thoughtKey = data?.thought?.key;

  const copyKey = () => {
    if (!thoughtKey) return;
    navigator.clipboard.writeText(thoughtKey).then(() => {
      setKeyCopied(true);
      setTimeout(() => setKeyCopied(false), 2000);
    });
  };

  const timeline: TimelineEntry[] = data
    ? [
        ...data.messages.map((m) => ({
          ...m,
          type: (m.metadata as { type?: string } | null)?.type === "planning" ? "planning" : "message",
          createdAt: m.createdAt,
        })),
        ...data.items.map((i) => ({ ...i, type: "action" })),
        ...data.logs.map((l) => ({ ...l, type: "log" })),
      ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    : [];

  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 mb-6 transition-colors"
      >
        ← Back to Thoughts
      </button>

      {/* Thought Key banner — agents use this, NOT the Brain Token */}
      {thoughtKey && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-purple-700 mb-1">
                🔑 Thought Key — use this in your agent (not the Brain Token)
              </p>
              <code className="text-xs text-purple-900 bg-purple-100 rounded px-2 py-1 block truncate font-mono">
                {thoughtKey}
              </code>
              <p className="text-xs text-purple-600 mt-1.5">
                <code className="bg-purple-100 rounded px-1">Authorization: Bearer {thoughtKey.slice(0, 12)}...</code>
                &nbsp;— projectId is auto-bound to <strong>{thoughtId}</strong>
              </p>
            </div>
            <button
              onClick={copyKey}
              className="shrink-0 px-3 py-1.5 text-xs bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
            >
              {keyCopied ? "Copied!" : "Copy Key"}
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{thoughtId}</h2>
          <p className="text-sm text-gray-500 mt-0.5">{data?.thought?.description || "Thought detail"}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setShowReadAI(true)}
            className="px-3 py-1.5 text-sm bg-green-600 text-white hover:bg-green-700 rounded-lg transition-colors font-medium"
          >
            📖 Read by AI
          </button>
          <button
            onClick={() => setShowAppend(true)}
            className="px-3 py-1.5 text-sm bg-purple-600 text-white hover:bg-purple-700 rounded-lg transition-colors font-medium"
          >
            + Append
          </button>
          <button
            onClick={() => setActiveTab("timeline")}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              activeTab === "timeline" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Timeline
          </button>
          <button
            onClick={() => setActiveTab("secrets")}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              activeTab === "secrets" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Secrets
          </button>
          <button
            onClick={load}
            className="px-3 py-1.5 text-sm bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {activeTab === "timeline" && (
        <Card className="divide-y divide-gray-100">
          {loading ? (
            <Spinner />
          ) : timeline.length === 0 ? (
            <div className="px-6 py-4">
              <EmptyState label="No events yet. Use 'Append' to add messages, or sync from your agent." />
            </div>
          ) : (
            <div className="px-6 py-2">
              {timeline.map((entry, i) => (
                <ChatBubble key={i} entry={entry} />
              ))}
            </div>
          )}
        </Card>
      )}

      {activeTab === "secrets" && (
        <SecretsPanel thoughtId={thoughtId} token={token} />
      )}

      {showReadAI && (
        <ReadByAIModal
          thoughtId={thoughtId}
          token={token}
          onClose={() => setShowReadAI(false)}
        />
      )}

      {showAppend && (
        <AppendModal
          thoughtId={thoughtId}
          thoughtKey={thoughtKey}
          token={token}
          onClose={() => setShowAppend(false)}
          onDone={load}
        />
      )}
    </div>
  );
}

// ── SecretsPanel ─────────────────────────────────────────────────────────

function SecretsPanel({ thoughtId, token }: { thoughtId: string; token: string }) {
  const [secrets, setSecrets] = useState<Record<string, { value: string; scope: string; source: string }>>({});
  const [loading, setLoading] = useState(true);
  const [newKey, setNewKey] = useState("");
  const [newVal, setNewVal] = useState("");
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/secrets/thought/${encodeURIComponent(thoughtId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      setSecrets(d.secrets ?? {});
    } catch {
      setSecrets({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [thoughtId]);

  const addSecret = async () => {
    if (!newKey || !newVal) return;
    await fetch(`${API}/secrets/thought/${encodeURIComponent(thoughtId)}/${encodeURIComponent(newKey)}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ value: newVal }),
    });
    setNewKey(""); setNewVal("");
    load();
  };

  const deleteSecret = async (key: string) => {
    if (!confirm(`Delete secret "${key}"?`)) return;
    await fetch(`${API}/secrets/thought/${encodeURIComponent(thoughtId)}/${encodeURIComponent(key)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    load();
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="font-semibold text-sm text-gray-700 mb-3">Add Secret</h3>
        <div className="flex gap-2">
          <input
            value={newKey}
            onChange={(e) => setNewKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_"))}
            placeholder="KEY_NAME"
            className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono"
          />
          <input
            value={newVal}
            onChange={(e) => setNewVal(e.target.value)}
            placeholder="value"
            type="password"
            className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            onClick={addSecret}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
          >
            Save
          </button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {Object.keys(secrets).length === 0 ? (
          <EmptyState label="No secrets yet." />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Key</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Value</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Scope</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {Object.entries(secrets).map(([k, s]) => (
                <tr key={k}>
                  <td className="px-4 py-2 font-mono text-xs text-gray-800">{k}</td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-600">
                    <span
                      className="cursor-pointer select-none"
                      onClick={() => setRevealed((r) => ({ ...r, [k]: !r[k] }))}
                    >
                      {revealed[k] ? s.value : "•".repeat(Math.min(s.value.length, 16))}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <Badge color={s.scope === "brain" ? "blue" : "purple"}>{s.scope}</Badge>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {s.scope === "thought" && (
                      <button
                        onClick={() => deleteSecret(k)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

// ── ThoughtsTab ──────────────────────────────────────────────────────────

function ThoughtsTab({ token }: { token: string }) {
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newId, setNewId] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [createErr, setCreateErr] = useState("");
  const [createdKey, setCreatedKey] = useState<{ thoughtId: string; key: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/brain`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error("Failed");
      const d = await r.json();
      setThoughts(d.thoughts ?? []);
    } catch {
      setThoughts([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!newId.trim()) { setCreateErr("Thought ID is required"); return; }
    setCreateErr("");
    try {
      const r = await fetch(`${API}/brain`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ thoughtId: newId.trim(), description: newDesc.trim() }),
      });
      const d = await r.json();
      if (!r.ok) { setCreateErr(d.error ?? "Failed"); return; }
      setCreating(false);
      setNewId(""); setNewDesc("");
      setCreatedKey({ thoughtId: d.thoughtId, key: d.key });
      load();
    } catch {
      setCreateErr("Failed to create thought");
    }
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  if (selected) {
    return (
      <ThoughtDetail
        thoughtId={selected}
        token={token}
        onBack={() => { setSelected(null); load(); }}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-gray-900">Thoughts</h2>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="px-3 py-1.5 text-sm bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Refresh
          </button>
          <button
            onClick={() => setCreating(true)}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors"
          >
            + New Thought
          </button>
        </div>
      </div>

      {creating && (
        <Card className="p-5 mb-5">
          <h3 className="font-semibold text-gray-800 mb-3">Create Thought</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Thought ID *</label>
              <input
                value={newId}
                onChange={(e) => setNewId(e.target.value)}
                placeholder="my-project"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Description</label>
              <input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="What is this thought about?"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            {createErr && <p className="text-sm text-red-600">{createErr}</p>}
            <div className="flex gap-2">
              <button
                onClick={create}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
              >
                Create
              </button>
              <button
                onClick={() => { setCreating(false); setCreateErr(""); }}
                className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </Card>
      )}

      {createdKey && (
        <Card className="p-5 mb-5 border-green-200 bg-green-50">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-green-800 mb-1">Thought created: {createdKey.thoughtId}</p>
              <p className="text-sm text-green-700 mb-2">Save this Thought Key — it won't be shown again.</p>
              <code className="text-xs bg-green-100 border border-green-300 rounded px-2 py-1 block break-all">
                {createdKey.key}
              </code>
            </div>
            <div className="flex gap-2 ml-4">
              <button
                onClick={() => copy(createdKey.key)}
                className="text-sm text-green-700 hover:text-green-900 font-medium"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
              <button
                onClick={() => setCreatedKey(null)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Dismiss
              </button>
            </div>
          </div>
        </Card>
      )}

      {loading ? (
        <Spinner />
      ) : thoughts.length === 0 ? (
        <EmptyState label='No thoughts yet. Create one to get started.' />
      ) : (
        <div className="grid gap-3">
          {thoughts.map((t) => (
            <Card
              key={t.thoughtId}
              className="p-5 cursor-pointer hover:border-blue-300 transition-colors hover:shadow-md"
              onClick={() => setSelected(t.thoughtId)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900">{t.thoughtId}</h3>
                    {!t.key && <Badge color="amber">Legacy</Badge>}
                  </div>
                  <p className="text-sm text-gray-500 mb-3">{t.description || "No description"}</p>
                  {t.key && (
                    <code
                      className="text-xs bg-gray-100 rounded px-1.5 py-0.5 text-gray-500 block truncate max-w-xs"
                      title={t.key}
                    >
                      {t.key.substring(0, 20)}...
                    </code>
                  )}
                </div>
                <div className="flex gap-6 ml-6 shrink-0">
                  <div className="text-center">
                    <div className="text-lg font-bold text-blue-600">{t.counts.messages}</div>
                    <div className="text-xs text-gray-400">Messages</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-purple-600">{t.counts.items}</div>
                    <div className="text-xs text-gray-400">Actions</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-gray-600">{t.counts.logs}</div>
                    <div className="text-xs text-gray-400">Logs</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-gray-900">{t.total}</div>
                    <div className="text-xs text-gray-400">Total</div>
                  </div>
                </div>
              </div>
              {t.createdAt && (
                <p className="text-xs text-gray-400 mt-3">{timeAgo(t.createdAt)}</p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── OverviewTab ──────────────────────────────────────────────────────────

function OverviewTab({
  apiStatus,
  mongoStatus,
  health,
}: {
  apiStatus: Status;
  mongoStatus: Status;
  health: HealthData | null;
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "API", status: apiStatus, detail: health?.status ?? "—" },
          { label: "MongoDB", status: mongoStatus, detail: health?.mongodb ?? "—" },
          { label: "Uptime", status: "ok" as Status, detail: health ? `${Math.floor(health.uptime / 60)}m` : "—" },
          { label: "Version", status: "ok" as Status, detail: "2.0" },
        ].map((item) => (
          <Card key={item.label} className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <StatusDot status={item.status} />
              <span className="text-sm font-medium text-gray-700">{item.label}</span>
            </div>
            <p className="text-lg font-bold text-gray-900 capitalize">{item.detail}</p>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <h3 className="font-semibold text-gray-800 mb-3">Quick Reference</h3>
        <div className="space-y-2 text-sm font-mono text-gray-600">
          {[
            ["GET", "/api/healthz", "Health check"],
            ["POST", "/api/auth/register", "Register account"],
            ["POST", "/api/auth/login", "Login"],
            ["GET", "/api/brain", "List thoughts (brain token)"],
            ["POST", "/api/brain", "Create thought"],
            ["GET", "/api/brain/:id", "Get thought detail + messages"],
            ["POST", "/api/sync", "Sync messages/actions/logs"],
            ["GET", "/api/sync/context?projectId=x", "Get flat timeline"],
            ["GET", "/api/messages", "List messages"],
            ["GET", "/api/items", "List items/actions"],
            ["GET", "/api/logs", "List request logs"],
            ["GET", "/api/secrets/brain", "Brain-level secrets"],
            ["GET", "/api/secrets/thought/:id", "Thought-level secrets"],
          ].map(([method, path, desc]) => (
            <div key={path} className="flex gap-3 items-center py-1 border-b border-gray-100 last:border-0">
              <Badge color={method === "GET" ? "green" : method === "POST" ? "blue" : "orange"}>{method}</Badge>
              <code className="text-xs text-gray-700 flex-1">{path}</code>
              <span className="text-xs text-gray-400">{desc}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ── HowToTab ────────────────────────────────────────────────────────────

function HowToTab() {
  return (
    <div className="space-y-6 max-w-3xl">
      <Card className="p-6">
        <h3 className="font-bold text-gray-900 mb-4 text-lg">How to use Agent Brain</h3>
        <div className="space-y-5 text-sm text-gray-700">
          <div>
            <h4 className="font-semibold text-gray-800 mb-2">1. Register & get your Brain Token</h4>
            <p className="mb-2">Register via the API to get a <code className="bg-gray-100 px-1 rounded text-xs">bt_...</code> Brain Token.</p>
            <pre className="bg-gray-900 text-green-400 rounded-lg p-3 text-xs overflow-auto">{`POST /api/auth/register
{
  "email": "you@example.com",
  "password": "secret",
  "name": "Your Name"
}`}</pre>
          </div>

          <div>
            <h4 className="font-semibold text-gray-800 mb-2">2. Create a Thought (project namespace)</h4>
            <pre className="bg-gray-900 text-green-400 rounded-lg p-3 text-xs overflow-auto">{`POST /api/brain
Authorization: Bearer bt_...

{ "thoughtId": "my-project", "description": "My AI agent project" }`}</pre>
          </div>

          <div>
            <h4 className="font-semibold text-gray-800 mb-2">3. Store messages from your agent</h4>
            <pre className="bg-gray-900 text-green-400 rounded-lg p-3 text-xs overflow-auto">{`POST /api/sync
Authorization: Bearer tk_... (Thought Key)

{
  "projectId": "my-project",
  "sessionId": "session-001",
  "messages": [
    { "role": "user", "content": "Build me a website" },
    { "role": "assistant", "content": "Sure! Here is the plan..." }
  ],
  "actions": [
    { "name": "create-file", "description": "Created index.html" }
  ]
}`}</pre>
          </div>

          <div>
            <h4 className="font-semibold text-gray-800 mb-2">4. Recall context in a new session</h4>
            <pre className="bg-gray-900 text-green-400 rounded-lg p-3 text-xs overflow-auto">{`GET /api/sync/context?projectId=my-project
Authorization: Bearer tk_...

Returns chronological timeline of all events`}</pre>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ── App ──────────────────────────────────────────────────────────────────

export default function App() {
  const [apiStatus, setApiStatus] = useState<Status>("checking");
  const [mongoStatus, setMongoStatus] = useState<Status>("checking");
  const [health, setHealth] = useState<HealthData | null>(null);
  const [tab, setTab] = useState<Tab>("thoughts");
  const [token, setToken] = useState(() => localStorage.getItem("brain_token") ?? "");

  const checkHealth = useCallback(async () => {
    try {
      const r = await fetch(`${API}/healthz`);
      if (!r.ok) throw new Error();
      const d: HealthData = await r.json();
      setHealth(d);
      setApiStatus("ok");
      setMongoStatus(d.mongodb === "connected" ? "ok" : "error");
    } catch {
      setApiStatus("error");
      setMongoStatus("error");
    }
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  const handleToken = (t: string) => {
    setToken(t);
    localStorage.setItem("brain_token", t);
  };

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "thoughts", label: "Thoughts", icon: "💭" },
    { key: "overview", label: "Overview", icon: "📊" },
    { key: "howto", label: "How To", icon: "📖" },
  ];

  if (!token) {
    return <LandingPage onToken={handleToken} />;
  }

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
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setToken(""); localStorage.removeItem("brain_token"); }}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors"
            >
              Disconnect
            </button>
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
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {tab === "thoughts" && <ThoughtsTab token={token} />}
        {tab === "overview" && <OverviewTab apiStatus={apiStatus} mongoStatus={mongoStatus} health={health} />}
        {tab === "howto" && <HowToTab />}
      </main>
    </div>
  );
}
