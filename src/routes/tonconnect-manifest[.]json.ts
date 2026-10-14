import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/tonconnect-manifest.json")({
  server: {
    handlers: {
      GET: ({ request }) => {
        const origin = new URL(request.url).origin;
        return Response.json(
          { url: origin, name: "Farm City", iconUrl: `${origin}/favicon.ico` },
          { headers: { "Access-Control-Allow-Origin": "*" } },
        );
      },
    },
  },
});
