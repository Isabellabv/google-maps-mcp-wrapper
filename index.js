import express from "express";
import dotenv from "dotenv";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL;

if (!BACKEND_BASE_URL) {
  console.error("Missing BACKEND_BASE_URL");
  process.exit(1);
}

const server = new McpServer({
  name: "google-maps-mcp-wrapper",
  version: "1.0.0"
});

async function postJson(path, body) {
  const response = await fetch(`${BACKEND_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const text = await response.text();
  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON from backend: ${text}`);
  }

  if (!response.ok) {
    throw new Error(data?.message || data?.error || `Backend error ${response.status}`);
  }

  return data;
}

server.tool(
  "find_place",
  {
    query: z.string(),
    city: z.string().optional(),
    state: z.string().optional()
  },
  async ({ query, city, state }) => {
    const data = await postJson("/maps/find-place", { query, city, state });
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
    };
  }
);

server.tool(
  "geocode_address",
  {
    address: z.string()
  },
  async ({ address }) => {
    const data = await postJson("/maps/geocode", { address });
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
    };
  }
);

server.tool(
  "get_street_view",
  {
    lat: z.number(),
    lng: z.number(),
    size: z.string().optional(),
    heading: z.number().optional(),
    pitch: z.number().optional(),
    fov: z.number().optional()
  },
  async ({ lat, lng, size, heading, pitch, fov }) => {
    const data = await postJson("/maps/street-view", {
      lat,
      lng,
      size,
      heading,
      pitch,
      fov
    });

    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
    };
  }
);

server.tool(
  "get_static_map",
  {
    lat: z.number(),
    lng: z.number(),
    label: z.string().optional(),
    size: z.string().optional(),
    zoom: z.number().optional(),
    maptype: z.string().optional()
  },
  async ({ lat, lng, label, size, zoom, maptype }) => {
    const data = await postJson("/maps/static-map", {
      lat,
      lng,
      label,
      size,
      zoom,
      maptype
    });

    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
    };
  }
);

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "google-maps-mcp-wrapper",
    mcp_endpoint: "/mcp"
  });
});

app.all("/mcp", async (req, res) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID()
  });

  res.on("close", () => {
    transport.close();
  });

  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.listen(PORT, () => {
  console.log(`MCP wrapper running on port ${PORT}`);
});
