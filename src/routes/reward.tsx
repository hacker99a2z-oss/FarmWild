import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";

export const Route = createFileRoute("/reward")({
  loader: async ({ request }) => {
    const url = new URL(request.url);
    const userId = url.searchParams.get("userid");
    const crop = url.searchParams.get("crop");
    const part = url.searchParams.get("part");

    if (!userId) {
      return json({ error: "Missing userid parameter" }, { status: 400 });
    }

    try {
      const { getDb } = await import("../lib/db.server");
      const db = await getDb();
      const { AD_COOLDOWN_MS, CROP_RULES, CROP_KEYS, fieldParts, isFieldPart, isReady } = await import("../lib/rules");

      const players = db.collection<{
        _id: number;
        lastAdAt?: Date;
        fields?: Record<string, unknown>;
      }>("players");

      // Find the player by Telegram ID
      const player = await players.findOne({ _id: Number(userId) });
      if (!player) {
        return json({ error: "Player not found" }, { status: 404 });
      }

      // Check cooldown (3 minutes)
      const now = Date.now();
      if (player.lastAdAt && player.lastAdAt.getTime() + AD_COOLDOWN_MS > now) {
        return json({ error: "Ad cooldown not expired" }, { status: 429 });
      }

      // If crop and part are provided, update field ad progress
      if (crop && part !== null) {
        const k = crop as keyof typeof CROP_RULES;
        if (!CROP_KEYS.includes(k)) {
          return json({ error: "Invalid crop" }, { status: 400 });
        }

        const partNum = Number(part);
        if (!isFieldPart(k, partNum)) {
          return json({ error: "Invalid field part" }, { status: 400 });
        }

        const list = fieldParts(k, player.fields?.[k] as never);
        const f = list[partNum]!;

        if (!f.planted) {
          return json({ error: "Plant a seed first" }, { status: 400 });
        }

        if (isReady(k, f, now)) {
          return json({ error: "Already fully grown" }, { status: 400 });
        }

        // Update ad progress
        list[partNum] = { ...f, ads: Math.min(CROP_RULES[k].adsNeed, f.ads + 1) };

        await players.updateOne(
          { _id: Number(userId) },
          { $set: { [`fields.${k}`]: list, lastAdAt: new Date(now) } }
        );

        return json({ success: true, message: "Ad progress updated" });
      }

      // Just update cooldown if no specific field
      await players.updateOne(
        { _id: Number(userId) },
        { $set: { lastAdAt: new Date(now) } }
      );

      return json({ success: true, message: "Reward cooldown updated" });
    } catch (error) {
      console.error("Reward callback error:", error);
      return json({ error: "Internal server error" }, { status: 500 });
    }
  },
});
