export const swaggerSpec = {
  openapi: "3.0.0",
  info: {
    title: "Agent Brain API",
    version: "1.0.0",
    description:
      "A REST API with MongoDB persistence. Designed for testing and inter-agent communication.\n\n**Base URL:** `/api`\n\nAll endpoints return JSON. No authentication required.",
  },
  servers: [{ url: "/api", description: "API base path" }],
  tags: [
    {
      name: "health",
      description: "Server and database health checks",
    },
    {
      name: "items",
      description:
        "General-purpose CRUD collection. Store any structured data with a `name`, `tags`, and a flexible `data` field for any JSON payload.",
    },
    {
      name: "sync",
      description:
        "**Start here.** One command to send messages, actions, and logs all at once. This is the recommended endpoint for other agents.",
    },
    {
      name: "messages",
      description:
        "Chat and agent message history. Store messages by session, role (user/assistant/system/agent), and agent ID. Supports batch inserts for syncing conversation history.",
    },
    {
      name: "logs",
      description:
        "API request logs. Every request is automatically recorded. You can also write manual log entries.",
    },
  ],
  paths: {
    "/healthz": {
      get: {
        tags: ["health"],
        summary: "Health check",
        description:
          "Returns server status, MongoDB connection state, and process uptime.",
        operationId: "healthCheck",
        responses: {
          "200": {
            description: "Server is healthy",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/HealthStatus" },
                example: { status: "ok", mongodb: "connected", uptime: 3600 },
              },
            },
          },
        },
      },
    },
    "/items": {
      get: {
        tags: ["items"],
        summary: "List all items",
        description: "Returns a paginated list of items stored in MongoDB.",
        operationId: "listItems",
        parameters: [
          {
            in: "query",
            name: "status",
            schema: { type: "string", enum: ["active", "inactive", "archived"] },
            description: "Filter by status",
          },
          {
            in: "query",
            name: "limit",
            schema: { type: "integer", default: 20 },
            description: "Max items to return (max 100)",
          },
          {
            in: "query",
            name: "skip",
            schema: { type: "integer", default: 0 },
            description: "Items to skip (for pagination)",
          },
        ],
        responses: {
          "200": {
            description: "List of items",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Item" },
                    },
                    total: { type: "integer" },
                    limit: { type: "integer" },
                    skip: { type: "integer" },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["items"],
        summary: "Create a new item",
        description: "Creates a new item in MongoDB. The `data` field accepts any JSON.",
        operationId: "createItem",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateItemInput" },
              examples: {
                simple: {
                  summary: "Simple item",
                  value: {
                    name: "My first item",
                    description: "Testing the API",
                    tags: ["test", "demo"],
                  },
                },
                with_data: {
                  summary: "Item with custom JSON payload",
                  value: {
                    name: "Agent log",
                    description: "Logged from another AI agent",
                    tags: ["agent", "automated"],
                    data: {
                      agentId: "agent-123",
                      action: "data_sync",
                      timestamp: "2026-04-10T00:00:00Z",
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Item created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Item" },
              },
            },
          },
          "400": {
            description: "Validation error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/items/{id}": {
      get: {
        tags: ["items"],
        summary: "Get a single item by ID",
        operationId: "getItem",
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string" },
            description: "MongoDB ObjectId",
            example: "664f1a2b3c4d5e6f7a8b9c0d",
          },
        ],
        responses: {
          "200": {
            description: "Item found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Item" },
              },
            },
          },
          "404": {
            description: "Item not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
      put: {
        tags: ["items"],
        summary: "Update an item by ID",
        operationId: "updateItem",
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string" },
            description: "MongoDB ObjectId",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateItemInput" },
            },
          },
        },
        responses: {
          "200": {
            description: "Item updated",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Item" },
              },
            },
          },
          "404": {
            description: "Item not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
      delete: {
        tags: ["items"],
        summary: "Delete an item by ID",
        operationId: "deleteItem",
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string" },
            description: "MongoDB ObjectId",
          },
        ],
        responses: {
          "200": {
            description: "Item deleted",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    id: { type: "string" },
                  },
                },
              },
            },
          },
          "404": {
            description: "Item not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/logs": {
      get: {
        tags: ["logs"],
        summary: "Get recent API request logs",
        description: "Returns the most recent log entries stored in MongoDB.",
        operationId: "listLogs",
        parameters: [
          {
            in: "query",
            name: "limit",
            schema: { type: "integer", default: 50 },
            description: "Max entries to return (max 200)",
          },
          {
            in: "query",
            name: "method",
            schema: {
              type: "string",
              enum: ["GET", "POST", "PUT", "DELETE", "PATCH"],
            },
            description: "Filter by HTTP method",
          },
        ],
        responses: {
          "200": {
            description: "List of log entries",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Log" },
                    },
                    total: { type: "integer" },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["logs"],
        summary: "Create a log entry",
        description: "Agents can use this to record their own activity in MongoDB.",
        operationId: "createLog",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateLogInput" },
              examples: {
                agent_log: {
                  summary: "Agent activity log",
                  value: {
                    method: "POST",
                    path: "/api/items",
                    statusCode: 201,
                    durationMs: 42,
                    requestBody: { name: "Test item" },
                    responseBody: { _id: "abc123", name: "Test item" },
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Log entry created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Log" },
              },
            },
          },
        },
      },
      delete: {
        tags: ["logs"],
        summary: "Clear all logs",
        description: "Deletes all log entries from MongoDB.",
        operationId: "clearLogs",
        responses: {
          "200": {
            description: "Logs cleared",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    deleted: { type: "integer" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/messages": {
      get: {
        tags: ["messages"],
        summary: "List messages",
        description: "Returns messages sorted oldest-first. Filter by sessionId, role, or agentId.",
        operationId: "listMessages",
        parameters: [
          {
            in: "query",
            name: "sessionId",
            schema: { type: "string" },
            description: "Filter by session ID",
          },
          {
            in: "query",
            name: "role",
            schema: { type: "string", enum: ["user", "assistant", "system", "agent"] },
            description: "Filter by role",
          },
          {
            in: "query",
            name: "agentId",
            schema: { type: "string" },
            description: "Filter by agent ID",
          },
          {
            in: "query",
            name: "limit",
            schema: { type: "integer", default: 50 },
            description: "Max messages to return (max 200)",
          },
          {
            in: "query",
            name: "skip",
            schema: { type: "integer", default: 0 },
            description: "Messages to skip (for pagination)",
          },
        ],
        responses: {
          "200": {
            description: "List of messages",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { type: "array", items: { $ref: "#/components/schemas/Message" } },
                    total: { type: "integer" },
                    limit: { type: "integer" },
                    skip: { type: "integer" },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["messages"],
        summary: "Create a message",
        operationId: "createMessage",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateMessageInput" },
              examples: {
                user_message: {
                  summary: "User message",
                  value: {
                    role: "user",
                    content: "Hello, what can you do?",
                    sessionId: "session-abc123",
                  },
                },
                agent_message: {
                  summary: "Agent response with metadata",
                  value: {
                    role: "agent",
                    content: "I can help you store and retrieve data via this API.",
                    sessionId: "session-abc123",
                    agentId: "agent-001",
                    metadata: { model: "gpt-4o", tokensUsed: 42 },
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Message created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Message" },
              },
            },
          },
          "400": {
            description: "Validation error",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/Error" } },
            },
          },
        },
      },
      delete: {
        tags: ["messages"],
        summary: "Clear messages",
        description: "Delete all messages, or all messages for a specific session.",
        operationId: "clearMessages",
        parameters: [
          {
            in: "query",
            name: "sessionId",
            schema: { type: "string" },
            description: "If provided, only messages for this session are deleted",
          },
        ],
        responses: {
          "200": {
            description: "Messages cleared",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    deleted: { type: "integer" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/messages/batch": {
      post: {
        tags: ["messages"],
        summary: "Batch create messages",
        description: "Insert up to 100 messages in a single request. Useful for syncing full conversation history.",
        operationId: "batchCreateMessages",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "array",
                items: { $ref: "#/components/schemas/CreateMessageInput" },
                maxItems: 100,
              },
              example: [
                { role: "user", content: "Hi!", sessionId: "session-abc123" },
                { role: "assistant", content: "Hello! How can I help?", sessionId: "session-abc123" },
              ],
            },
          },
        },
        responses: {
          "201": {
            description: "Messages created",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    created: { type: "integer" },
                    data: { type: "array", items: { $ref: "#/components/schemas/Message" } },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/sync/read": {
      get: {
        tags: ["sync"],
        summary: "Read everything for a session in one call",
        description:
          "Returns messages, planning steps, actions, and logs for a session — all in one response. Filter by `sessionId` or omit to get everything.",
        operationId: "syncRead",
        parameters: [
          {
            in: "query",
            name: "sessionId",
            schema: { type: "string" },
            description: "Session to read. Omit to return all data.",
            example: "session-001",
          },
          {
            in: "query",
            name: "limit",
            schema: { type: "integer", default: 50 },
            description: "Max entries per collection (max 200)",
          },
        ],
        responses: {
          "200": {
            description: "All data for the session",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    sessionId: { type: "string", nullable: true },
                    messages: { type: "object", properties: { data: { type: "array" }, total: { type: "integer" } } },
                    planning: { type: "object", properties: { data: { type: "array" }, total: { type: "integer" } } },
                    actions: { type: "object", properties: { data: { type: "array" }, total: { type: "integer" } } },
                    logs: { type: "object", properties: { data: { type: "array" }, total: { type: "integer" } } },
                  },
                },
                example: {
                  sessionId: "session-001",
                  messages: { data: [], total: 0 },
                  planning: { data: [], total: 0 },
                  actions: { data: [], total: 0 },
                  logs: { data: [], total: 0 },
                },
              },
            },
          },
        },
      },
    },
    "/sync": {
      post: {
        tags: ["sync"],
        summary: "One-shot sync — send everything at once",
        description:
          "Send messages, actions, and logs in a single request. Each field is optional. Actions are stored as items. All three collections are written in parallel.\n\n**This is the recommended endpoint for other agents to use.**",
        operationId: "sync",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SyncInput" },
              examples: {
                full: {
                  summary: "Full payload",
                  value: {
                    sessionId: "session-001",
                    messages: [
                      { role: "user", content: "Hello!" },
                      { role: "agent", content: "Hi! How can I help?", agentId: "agent-001" },
                    ],
                    actions: [
                      { name: "file-edit", tags: ["action"], data: { file: "App.tsx", action: "modified" } },
                    ],
                    logs: [
                      { method: "POST", path: "/api/items", statusCode: 201, durationMs: 38 },
                    ],
                  },
                },
                messages_only: {
                  summary: "Messages only",
                  value: {
                    sessionId: "session-abc",
                    messages: [
                      { role: "user", content: "What is the status?" },
                      { role: "assistant", content: "Everything is running fine." },
                    ],
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "All items saved successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SyncResult" },
                example: { ok: true, totalSaved: 4, results: { messages: { saved: 2 }, actions: { saved: 1 }, logs: { saved: 1 } } },
              },
            },
          },
          "207": {
            description: "Partial success — some collections had errors",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SyncResult" },
              },
            },
          },
        },
      },
    },
    "/messages/{id}": {
      get: {
        tags: ["messages"],
        summary: "Get a message by ID",
        operationId: "getMessage",
        parameters: [
          { in: "path", name: "id", required: true, schema: { type: "string" }, description: "MongoDB ObjectId" },
        ],
        responses: {
          "200": {
            description: "Message found",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Message" } } },
          },
          "404": {
            description: "Not found",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
      delete: {
        tags: ["messages"],
        summary: "Delete a message by ID",
        operationId: "deleteMessage",
        parameters: [
          { in: "path", name: "id", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Message deleted",
            content: {
              "application/json": {
                schema: { type: "object", properties: { message: { type: "string" }, id: { type: "string" } } },
              },
            },
          },
          "404": {
            description: "Not found",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      Item: {
        type: "object",
        properties: {
          _id: { type: "string", example: "664f1a2b3c4d5e6f7a8b9c0d" },
          name: { type: "string", example: "My item" },
          description: { type: "string", example: "A short description" },
          tags: {
            type: "array",
            items: { type: "string" },
            example: ["test", "demo"],
          },
          data: {
            type: "object",
            nullable: true,
            description: "Any JSON payload",
            example: { key: "value" },
          },
          status: {
            type: "string",
            enum: ["active", "inactive", "archived"],
            example: "active",
          },
          createdAt: {
            type: "string",
            format: "date-time",
            example: "2026-04-10T12:00:00.000Z",
          },
          updatedAt: {
            type: "string",
            format: "date-time",
            example: "2026-04-10T12:00:00.000Z",
          },
        },
      },
      CreateItemInput: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string", example: "My item" },
          description: { type: "string", example: "A short description" },
          tags: {
            type: "array",
            items: { type: "string" },
            example: ["test"],
          },
          data: {
            type: "object",
            nullable: true,
            description: "Any JSON payload",
          },
          status: {
            type: "string",
            enum: ["active", "inactive", "archived"],
            default: "active",
          },
        },
      },
      UpdateItemInput: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
          data: { type: "object", nullable: true },
          status: {
            type: "string",
            enum: ["active", "inactive", "archived"],
          },
        },
      },
      Log: {
        type: "object",
        properties: {
          _id: { type: "string" },
          method: { type: "string", example: "POST" },
          path: { type: "string", example: "/api/items" },
          statusCode: { type: "integer", example: 201 },
          durationMs: { type: "integer", example: 42, nullable: true },
          requestBody: { type: "object", nullable: true },
          responseBody: { type: "object", nullable: true },
          ip: { type: "string", nullable: true },
          userAgent: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      CreateLogInput: {
        type: "object",
        required: ["method", "path", "statusCode"],
        properties: {
          method: { type: "string", example: "GET" },
          path: { type: "string", example: "/api/items" },
          statusCode: { type: "integer", example: 200 },
          durationMs: { type: "integer", example: 15 },
          requestBody: { type: "object", nullable: true },
          responseBody: { type: "object", nullable: true },
        },
      },
      SyncInput: {
        type: "object",
        properties: {
          sessionId: {
            type: "string",
            description: "Session ID applied to all entries that don't specify their own",
            example: "session-001",
          },
          messages: {
            type: "array",
            items: { $ref: "#/components/schemas/CreateMessageInput" },
            description: "Chat messages (user / assistant / agent roles)",
          },
          planning: {
            type: "array",
            items: {
              type: "object",
              properties: {
                summary: { type: "string", description: "What the agent was planning", example: "Planning proxy authentication method" },
                durationMs: { type: "integer", example: 5000 },
                agentId: { type: "string" },
                sessionId: { type: "string" },
              },
            },
            description: "Internal agent planning/reasoning steps. Stored as system messages with metadata.type='planning'.",
          },
          actions: {
            type: "array",
            items: { type: "object" },
            description: "Agent actions stored as items. Include a `name` field; everything else goes into `data`.",
          },
          logs: {
            type: "array",
            items: { $ref: "#/components/schemas/CreateLogInput" },
            description: "Request or activity log entries",
          },
        },
      },
      SyncResult: {
        type: "object",
        properties: {
          ok: { type: "boolean", example: true },
          totalSaved: { type: "integer", example: 4 },
          results: {
            type: "object",
            properties: {
              messages: { type: "object", properties: { saved: { type: "integer" } } },
              actions: { type: "object", properties: { saved: { type: "integer" } } },
              logs: { type: "object", properties: { saved: { type: "integer" } } },
            },
          },
          errors: {
            type: "array",
            items: { type: "string" },
            description: "Present only when ok is false or partial failure occurred",
          },
        },
      },
      Message: {
        type: "object",
        properties: {
          _id: { type: "string", example: "664f1a2b3c4d5e6f7a8b9c0d" },
          role: {
            type: "string",
            enum: ["user", "assistant", "system", "agent"],
            example: "user",
          },
          content: { type: "string", example: "Hello, what can you do?" },
          sessionId: { type: "string", nullable: true, example: "session-abc123" },
          agentId: { type: "string", nullable: true, example: "agent-001" },
          metadata: {
            type: "object",
            nullable: true,
            description: "Any additional JSON data (e.g. model name, token count)",
            example: { model: "gpt-4o", tokensUsed: 42 },
          },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      CreateMessageInput: {
        type: "object",
        required: ["role", "content"],
        properties: {
          role: {
            type: "string",
            enum: ["user", "assistant", "system", "agent"],
            example: "user",
          },
          content: { type: "string", example: "Hello, what can you do?" },
          sessionId: { type: "string", nullable: true, example: "session-abc123" },
          agentId: { type: "string", nullable: true, example: "agent-001" },
          metadata: { type: "object", nullable: true },
        },
      },
      HealthStatus: {
        type: "object",
        properties: {
          status: { type: "string", example: "ok" },
          mongodb: { type: "string", example: "connected" },
          uptime: { type: "number", example: 3600 },
        },
      },
      Error: {
        type: "object",
        properties: {
          error: { type: "string", example: "Item not found" },
        },
      },
    },
  },
};
