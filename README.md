# mcp-pexels

MCP server for the [Pexels](https://www.pexels.com) free stock photo and video API. Plug into Claude Code to search and retrieve attribution-ready media assets for your YouTube production pipeline.

## Tools

| Tool | Description |
|------|-------------|
| `search_photos` | Search photos by query, orientation, page |
| `search_videos` | Search videos by query, orientation, duration |
| `get_curated_photos` | Browse Pexels editorial curated collection |

All responses include photographer credit, full download URLs, and dimensions — everything you need for compliant attribution.

## Free Tier Limits

| Metric | Limit |
|--------|-------|
| Requests per hour | **200** |
| Requests per month | **20,000** |
| Rate limit headers | `X-Ratelimit-Limit`, `X-Ratelimit-Remaining` |
| Attribution required | Yes — credit photographer name + Pexels |

No paid tier needed for production YouTube workflows at reasonable volume.

## API Key

Sign up free at **https://www.pexels.com/api/** — instant approval, no credit card.

## Environment Variables

```bash
PEXELS_API_KEY=your_api_key_here
```

Copy `.env.example` to `.env` and fill in your key.

## Install

```bash
cd mcp-pexels
npm install
npm run build
```

## Usage (dev mode, no build step)

```bash
PEXELS_API_KEY=your_key npx tsx src/index.ts
```

## Claude Code `.mcp.json` Config

```json
{
  "mcpServers": {
    "pexels": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-pexels/dist/index.js"],
      "env": {
        "PEXELS_API_KEY": "your_key_here"
      }
    }
  }
}
```

Or with `tsx` for development (no build required):

```json
{
  "mcpServers": {
    "pexels": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/mcp-pexels/src/index.ts"],
      "env": {
        "PEXELS_API_KEY": "your_key_here"
      }
    }
  }
}
```

## Example Prompts

```
Search Pexels for landscape drone footage of Lahore, 5 results
```

```
Find portrait-orientation photos of "AI robot" for a thumbnail, page 2
```

## Attribution Requirements

Per Pexels license, you must credit the photographer. Each response includes:
- `photographer`: display name
- `photographer_url`: their Pexels profile
- `url`: the photo page (link here in video descriptions)

Standard credit format: *"Photo by [Name] from Pexels"*

## How I Built This — Channel 1 Angle

**Video idea:** *"I built a free AI stock footage finder in Claude Code (14 MCP servers, zero subscriptions)"*

This MCP is part of a 14-server YouTube production pipeline built entirely on free APIs. The interesting story: Pexels gives you 20,000 requests/month for free, which is more than enough to source B-roll for 4 videos/week. Combined with Pixabay and Unsplash MCPs in the same pipeline, you have 3 stock libraries accessible from a single Claude Code chat — no browser tab switching, no manual downloading.

The build took under 2 hours using Claude Code's file writing tools. The pattern (Zod schema → fetch wrapper → MCP tool registration) is identical across all 9 Node MCPs in this pipeline, making each one ~15 minutes of real work once you have the first one.

## License

MIT — see [LICENSE](LICENSE)
