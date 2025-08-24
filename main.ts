import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import z from "zod";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import dotenv from "dotenv";

dotenv.config();

function getServer() {
  const server = new McpServer({
    name: "demo",
    version: "1.0.0",
  });

  server.tool(
    "get-customers",
    "Tool to get all the customers from the database",
    {},
    async () => {
      const response = await fetch(`${process.env.API_URL}/customers`);

      const data = await response.json();

      if (!data || (data.customers && data.customers.length === 0)) {
        return {
          content: [
            {
              type: "text",
              text: "No se encontro informacion al respecto.",
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "add-customer",
    "Tool to add a new customer to the database",
    {
      name: z.string().describe("User name"),
      email: z.string().describe("User email"),
      phone: z.string().describe("User phone"),
      address: z.string().describe("User address"),
    },
    async ({ name, email, phone, address }) => {
      const response = await fetch(`${process.env.API_URL}/customers`, {
        method: "POST",
        mode: "cors",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          phone,
          address,
        }),
      });

      const data = await response.json();

      if (!data) {
        return {
          content: [
            {
              type: "text",
              text: "No se logro agregar el cliente.",
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  return server;
}

const app = express();
app.use(express.json());

app.post("/mcp", async (req: express.Request, res: express.Response) => {
  try {
    const server = getServer();

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    res.on("close", () => {
      transport.close();
      server.close();
    });

    await server.connect(transport);

    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("Error handling MCP request: ", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error",
        },
        id: null,
      });
    }
  }
});

// En modo stateless, GET/DELETE a /mcp no aplican:
app.get("/mcp", (_req, res) => {
  res
    .writeHead(405)
    .end(
      JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Method not allowed." },
        id: null,
      })
    );
});
app.delete("/mcp", (_req, res) => {
  res
    .writeHead(405)
    .end(
      JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Method not allowed." },
        id: null,
      })
    );
});

const PORT = 5001;
app.listen(PORT);
