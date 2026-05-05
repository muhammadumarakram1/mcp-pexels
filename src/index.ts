import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

const API_KEY = process.env.PEXELS_API_KEY;
const BASE_URL = "https://api.pexels.com";

function requireApiKey(): string {
  if (!API_KEY) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      "PEXELS_API_KEY environment variable is not set. Get a free key at https://www.pexels.com/api/"
    );
  }
  return API_KEY;
}

async function pexelsFetch(path: string): Promise<unknown> {
  const key = requireApiKey();
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: key },
  });
  if (res.status === 429) {
    throw new McpError(ErrorCode.InvalidRequest, "Pexels rate limit hit (200 req/hour, 20,000/month). Retry after reset.");
  }
  if (!res.ok) {
    throw new McpError(ErrorCode.InternalError, `Pexels API error ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

// Tool input schemas
const SearchPhotosSchema = z.object({
  query: z.string().min(1).describe("Search query string"),
  per_page: z.number().int().min(1).max(80).default(15).describe("Results per page (1-80)"),
  page: z.number().int().min(1).default(1).describe("Page number"),
  orientation: z.enum(["landscape", "portrait", "square"]).optional().describe("Photo orientation filter"),
});

const SearchVideosSchema = z.object({
  query: z.string().min(1).describe("Search query string"),
  orientation: z.enum(["landscape", "portrait", "square"]).optional().describe("Video orientation"),
  per_page: z.number().int().min(1).max(80).default(15).describe("Results per page (1-80)"),
  page: z.number().int().min(1).default(1).describe("Page number"),
  min_duration: z.number().int().optional().describe("Minimum video duration in seconds"),
  max_duration: z.number().int().optional().describe("Maximum video duration in seconds"),
});

const GetCuratedPhotosSchema = z.object({
  per_page: z.number().int().min(1).max(80).default(15).describe("Results per page (1-80)"),
  page: z.number().int().min(1).default(1).describe("Page number"),
});

function formatPhoto(photo: Record<string, unknown>) {
  return {
    id: photo.id,
    width: photo.width,
    height: photo.height,
    url: photo.url,
    photographer: photo.photographer,
    photographer_url: photo.photographer_url,
    avg_color: photo.avg_color,
    src: photo.src,
    alt: photo.alt,
  };
}

function formatVideo(video: Record<string, unknown>) {
  const files = video.video_files as Array<Record<string, unknown>> | undefined;
  const bestFile = files?.sort((a, b) => ((b.width as number) ?? 0) - ((a.width as number) ?? 0))[0];
  return {
    id: video.id,
    width: video.width,
    height: video.height,
    url: video.url,
    duration: video.duration,
    user: video.user,
    best_download_link: bestFile?.link,
    best_quality: bestFile ? `${bestFile.width}x${bestFile.height}` : null,
    video_files: video.video_files,
  };
}

const server = new Server(
  { name: "mcp-pexels", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "search_photos",
      description: "Search Pexels for free stock photos. Returns URLs, photographer credit, dimensions, and download links.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query string" },
          per_page: { type: "number", description: "Results per page (1-80)", default: 15 },
          page: { type: "number", description: "Page number", default: 1 },
          orientation: { type: "string", enum: ["landscape", "portrait", "square"], description: "Photo orientation filter" },
        },
        required: ["query"],
      },
    },
    {
      name: "search_videos",
      description: "Search Pexels for free stock videos. Returns streaming URLs, duration, and quality options.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query string" },
          orientation: { type: "string", enum: ["landscape", "portrait", "square"], description: "Video orientation" },
          per_page: { type: "number", description: "Results per page (1-80)", default: 15 },
          page: { type: "number", description: "Page number", default: 1 },
          min_duration: { type: "number", description: "Minimum video duration in seconds" },
          max_duration: { type: "number", description: "Maximum video duration in seconds" },
        },
        required: ["query"],
      },
    },
    {
      name: "get_curated_photos",
      description: "Get Pexels curated photo collection — editorially selected, high quality.",
      inputSchema: {
        type: "object",
        properties: {
          per_page: { type: "number", description: "Results per page (1-80)", default: 15 },
          page: { type: "number", description: "Page number", default: 1 },
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "search_photos": {
        const input = SearchPhotosSchema.parse(args);
        const params = new URLSearchParams({
          query: input.query,
          per_page: String(input.per_page),
          page: String(input.page),
          ...(input.orientation ? { orientation: input.orientation } : {}),
        });
        const data = await pexelsFetch(`/v1/search?${params}`) as Record<string, unknown>;
        const photos = (data.photos as Array<Record<string, unknown>>).map(formatPhoto);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              total_results: data.total_results,
              page: data.page,
              per_page: data.per_page,
              photos,
              next_page: data.next_page,
            }, null, 2),
          }],
        };
      }

      case "search_videos": {
        const input = SearchVideosSchema.parse(args);
        const params = new URLSearchParams({
          query: input.query,
          per_page: String(input.per_page),
          page: String(input.page),
          ...(input.orientation ? { orientation: input.orientation } : {}),
          ...(input.min_duration !== undefined ? { min_duration: String(input.min_duration) } : {}),
          ...(input.max_duration !== undefined ? { max_duration: String(input.max_duration) } : {}),
        });
        const data = await pexelsFetch(`/v1/videos/search?${params}`) as Record<string, unknown>;
        const videos = (data.videos as Array<Record<string, unknown>>).map(formatVideo);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              total_results: data.total_results,
              page: data.page,
              per_page: data.per_page,
              videos,
            }, null, 2),
          }],
        };
      }

      case "get_curated_photos": {
        const input = GetCuratedPhotosSchema.parse(args);
        const params = new URLSearchParams({
          per_page: String(input.per_page),
          page: String(input.page),
        });
        const data = await pexelsFetch(`/v1/curated?${params}`) as Record<string, unknown>;
        const photos = (data.photos as Array<Record<string, unknown>>).map(formatPhoto);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              page: data.page,
              per_page: data.per_page,
              photos,
              next_page: data.next_page,
            }, null, 2),
          }],
        };
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (err) {
    if (err instanceof McpError) throw err;
    if (err instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${err.message}`);
    }
    throw new McpError(ErrorCode.InternalError, `Unexpected error: ${String(err)}`);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("mcp-pexels server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
