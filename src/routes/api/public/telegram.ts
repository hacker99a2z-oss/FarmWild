import { createFileRoute } from "@tanstack/react-router";

// Telegram bot webhook: handles /start with intro video + buttons.
// Set once: https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://YOUR-BACKEND/api/public/telegram&secret_token=<TELEGRAM_WEBHOOK_SECRET>
const CAPTION = [
  "🌾 <b>Welcome to Farm City!</b>",
  "",
  "🌱 Plant seeds  •  ⏳ Grow them  •  🌽 Harvest crops",
  "💰 Sell crops for real balance",
  "👥 Invite friends & earn 10% of their purchases",
  "⚡ Withdraw to your TON wallet — auto payout!",
  "",
  "👇 Tap <b>Play Now</b> to start farming",
].join("\n");

async function tg(method: string, body: unknown) {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json() as Promise<{ ok: boolean; description?: string }>;
}

export const Route = createFileRoute("/api/public/telegram")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["TELEGRAM_WEBHOOK_SECRET"];
        if (!secret || request.headers.get("x-telegram-bot-api-secret-token") !== secret) {
          return new Response("forbidden", { status: 403 });
        }
        const update = (await request.json().catch(() => null)) as {
          message?: { chat: { id: number }; from?: { id: number }; text?: string };
        } | null;
        const msg = update?.message;
        if (!msg?.text?.startsWith("/start")) return new Response("ok");

        const origin = new URL(request.url).origin;
        const appUrl = process.env["WEBAPP_URL"] ?? origin;
        const payload = msg.text.split(" ")[1]; // e.g. ref_12345
        const playUrl = appUrl;
        // Remember referral from /start ref_123 so the Mini App can apply it on first open
        const ref = payload?.match(/^ref_(\d+)$/);
        if (ref && msg.from && Number(ref[1]) !== msg.from.id) {
          try {
            const { getDb } = await import("@/lib/db.server");
            const db = await getDb();
            await db.collection<{ _id: number; ref: number; at: Date }>("start_refs").updateOne(
              { _id: msg.from.id },
              { $setOnInsert: { ref: Number(ref[1]), at: new Date() } },
              { upsert: true },
            );
          } catch (e) {
            console.error("save ref failed", e);
          }
        }

        const rows: { text: string; web_app?: { url: string }; url?: string }[][] = [
          [{ text: "🎮 Play Now", web_app: { url: playUrl } }],
        ];
        if (process.env["CHANNEL_URL"]) rows.push([{ text: "📢 Official Channel", url: process.env["CHANNEL_URL"] }]);
        if (process.env["SUPPORT_URL"]) rows.push([{ text: "💬 Support Group", url: process.env["SUPPORT_URL"] }]);
        const base = { chat_id: msg.chat.id, caption: CAPTION, parse_mode: "HTML", reply_markup: { inline_keyboard: rows } };

        const video = process.env["INTRO_VIDEO"]; // Telegram file_id or public .mp4 URL
        let res = video ? await tg("sendVideo", { ...base, video, supports_streaming: true }) : { ok: false };
        if (!res.ok) res = await tg("sendMessage", { chat_id: msg.chat.id, text: CAPTION, parse_mode: "HTML", reply_markup: base.reply_markup });
        return new Response("ok");
      },
    },
  },
});
