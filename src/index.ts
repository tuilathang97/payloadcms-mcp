import express from "express";
import {
  createBlockSampleContent,
  createCollectionSampleContent,
  getSampleContent,
  createRelationalContent,
  convertToRichtext,
} from "./tools";
import dotenv from "dotenv";

dotenv.config();

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: unknown;
};

type JsonRpcResponse =
  | { jsonrpc: "2.0"; id: string | number; result: unknown }
  | { jsonrpc: "2.0"; id: string | number; error: { code: number; message: string } };

const app = express();
app.use(express.json());

app.post("/mcp", async (req, res) => {
  const { id, method, params } = req.body as JsonRpcRequest;
  let result: unknown;
  try {
    switch (method) {
      case "createBlockSampleContent":
        result = await createBlockSampleContent(params as any);
        break;
      case "createCollectionSampleContent":
        result = await createCollectionSampleContent(params as any);
        break;
      case "getSampleContent":
        result = await getSampleContent();
        break;
      case "createRelationalContent":
        result = await createRelationalContent(params as any);
        break;
      case "convertToRichtext":
        result = await convertToRichtext(params as any);
        break;
      default:
        throw new Error(`Unknown method: ${method}`);
    }

    const response: JsonRpcResponse = { jsonrpc: "2.0", id, result };
    res.json(response);
  } catch (err: any) {
    const response: JsonRpcResponse = {
      jsonrpc: "2.0",
      id,
      error: { code: -32603, message: err.message },
    };
    res.status(500).json(response);
  }
});

app.listen(process.env.PORT, () =>
  console.log(`✅ MCP server listening on :${process.env.PORT}`)
);
