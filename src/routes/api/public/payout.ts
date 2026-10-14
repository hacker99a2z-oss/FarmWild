import { createFileRoute } from "@tanstack/react-router";

// Free cron (cron-job.org / UptimeRobot) hits this every 5 min:
// https://YOUR-BACKEND/api/public/payout?key=PAYOUT_CRON_SECRET
// It keeps Render awake and runs the payout queue.
export const Route = createFileRoute("/api/public/payout")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env["PAYOUT_CRON_SECRET"];
        const key = new URL(request.url).searchParams.get("key");
        if (!secret || key !== secret) return new Response("ok"); // plain ping keeps server awake
        const { runPayouts } = await import("@/lib/payout.server");
        return Response.json(await runPayouts());
      },
    },
  },
});
