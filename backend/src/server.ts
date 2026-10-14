import express, { type Request, type Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import {
  CROP_KEYS,
  WITHDRAWAL_HISTORY_LIMIT,
  DAILY_REWARDS,
  DAILY_SEEDS,
  fieldParts,
  isFieldPart,
  isReady,
  dailyStatus,
  dayKey,
  CROP_RULES,
  MIN_WITHDRAW_CENTS,
  MIN_SEED_BUY,
  MAX_SEED_BUY,
  AD_COOLDOWN_MS,
  seedPriceCents,
  referralRewardCents,
  tonNanoForUsd,
  type CropKey,
  type PlayerView,
  type Daily,
} from "./rules.js";
import { getDb } from "./db.js";
import { verifyInitData } from "./tg.js";
import { getTonUsd, findPayment, normalizeAddress, MERCHANT_ADDRESS } from "./ton.js";
import { kickPayouts, runPayouts } from "./payout.js";

dotenv.config();

export const app = express();
app.use(cors());
app.use(express.json());

type PlayerDoc = {
  _id: number;
  firstName: string;
  username: string | null;
  photoUrl: string | null;
  balanceCents: number;
  seeds?: Partial<Record<CropKey, number>>;
  crops: Record<CropKey, number>;
  fields: Record<CropKey, unknown>;
  daily?: Daily;
  referredBy: number | null;
  referralCount: number;
  referralEarnedCents: number;
  lastAdAt?: Date;
  createdAt: Date;
};

const isCrop = (k: unknown): k is CropKey =>
  typeof k === "string" && (CROP_KEYS as string[]).includes(k);

const rec = <T>(fn: (k: CropKey) => T) =>
  Object.fromEntries(CROP_KEYS.map((k) => [k, fn(k)])) as Record<CropKey, T>;

const parts = (p: PlayerDoc, k: CropKey) => fieldParts(k, p.fields?.[k] as never);

async function ctx(initData: string) {
  const tg = await verifyInitData(initData);
  const db = await getDb();
  return { tg, db, players: db.collection<PlayerDoc>("players") };
}

async function view(db: Awaited<ReturnType<typeof getDb>>, p: PlayerDoc): Promise<PlayerView> {
  const w = await db
    .collection<{
      _id: string;
      telegramId: number;
      cents: number;
      address: string;
      status: string;
      createdAt: Date;
    }>("withdrawals")
    .find({ telegramId: p._id })
    .sort({ createdAt: -1 })
    .limit(WITHDRAWAL_HISTORY_LIMIT)
    .toArray();
  const now = Date.now();
  return {
    balanceCents: p.balanceCents,
    seeds: rec((k) => p.seeds?.[k] ?? 0),
    crops: p.crops,
    fields: rec((k) => parts(p, k)),
    daily: dailyStatus(p.daily, now),
    referralCount: p.referralCount,
    referralEarnedCents: p.referralEarnedCents,
    nextAdAt: p.lastAdAt ? new Date(p.lastAdAt).getTime() + AD_COOLDOWN_MS : null,
    serverNow: now,
    withdrawals: w.map((x) => ({
      id: String(x._id),
      cents: x.cents,
      address: x.address,
      status: x.status,
      date: new Date(x.createdAt).toISOString(),
    })),
  };
}

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Load / initialize player
app.post("/api/player/load", async (req: Request, res: Response) => {
  try {
    const { initData } = req.body;
    if (typeof initData !== "string") {
      return res.status(400).json({ error: "Invalid initData" });
    }
    const { tg, db, players } = await ctx(initData);
    const existing = await players.findOneAndUpdate(
      { _id: tg.id },
      {
        $set: {
          firstName: tg.first_name,
          username: tg.username ?? null,
          photoUrl: tg.photo_url ?? null,
        },
      },
      { returnDocument: "after" }
    );
    if (existing) {
      return res.json(await view(db, existing));
    }

    // Referral logic for new players
    const m = tg.start_param?.match(/^ref_(\d+)$/);
    let refId = m && Number(m[1]) !== tg.id ? Number(m[1]) : null;
    if (!refId) {
      const saved = await db
        .collection<{ _id: number; ref: number }>("start_refs")
        .findOne({ _id: tg.id });
      if (saved && saved.ref !== tg.id) refId = saved.ref;
    }
    let referredBy: number | null = null;
    if (refId) {
      const r = await players.updateOne(
        { _id: refId },
        { $inc: { referralCount: 1 } }
      );
      if (r.matchedCount) referredBy = refId;
    }

    const doc: PlayerDoc = {
      _id: tg.id,
      firstName: tg.first_name,
      username: tg.username ?? null,
      photoUrl: tg.photo_url ?? null,
      balanceCents: 0,
      seeds: rec((k) => (k === "wheat" ? 4 : k === "corn" ? 2 : 1)),
      crops: rec(() => 0),
      fields: rec((k) => fieldParts(k)),
      daily: { streak: 0, lastDay: null },
      referredBy,
      referralCount: 0,
      referralEarnedCents: 0,
      createdAt: new Date(),
    };

    try {
      await players.insertOne(doc);
    } catch {
      // concurrent insert
    }

    const created = await players.findOne({ _id: tg.id });
    return res.json(await view(db, created || doc));
  } catch (err: any) {
    return res.status(400).json({ error: err.message || "Failed to load player" });
  }
});

// Tap field part (plant or harvest)
app.post("/api/player/tap", async (req: Request, res: Response) => {
  try {
    const { initData, crop, part } = req.body;
    if (!isCrop(crop)) return res.status(400).json({ error: "Invalid crop" });
    const partNum = Number(part ?? 0);
    if (!isFieldPart(crop, partNum)) return res.status(400).json({ error: "Invalid field part" });

    const { tg, db, players } = await ctx(initData);
    const p = await players.findOne({ _id: tg.id });
    if (!p) return res.status(404).json({ error: "Player not found" });

    const list = parts(p, crop);
    const f = list[partNum]!;
    const now = Date.now();

    if (!f.planted) {
      if ((p.seeds?.[crop] ?? 0) < 1) {
        return res.json({
          ok: false,
          message: `No ${crop} seeds — claim daily or buy seeds`,
          player: await view(db, p),
        });
      }
      list[partNum] = { planted: true, plantedAt: now, ads: 0 };
      const updated = await players.findOneAndUpdate(
        { _id: tg.id, [`seeds.${crop}`]: { $gte: 1 } },
        { $set: { [`fields.${crop}`]: list }, $inc: { [`seeds.${crop}`]: -1 } },
        { returnDocument: "after" }
      );
      return res.json({
        ok: true,
        message: "planted",
        player: await view(db, updated || p),
      });
    }

    if (!isReady(crop, f, now)) {
      return res.json({
        ok: false,
        message: "growing",
        player: await view(db, p),
      });
    }

    list[partNum] = { planted: false, plantedAt: 0, ads: 0 };
    const updated = await players.findOneAndUpdate(
      { _id: tg.id },
      { $set: { [`fields.${crop}`]: list }, $inc: { [`crops.${crop}`]: 1 } },
      { returnDocument: "after" }
    );
    return res.json({
      ok: true,
      message: "harvested",
      player: await view(db, updated || p),
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || "Failed to tap field" });
  }
});

// Claim weekly streak reward
app.post("/api/player/claim-daily", async (req: Request, res: Response) => {
  try {
    const { initData } = req.body;
    const { tg, db, players } = await ctx(initData);
    const p = await players.findOne({ _id: tg.id });
    if (!p) return res.status(404).json({ error: "Player not found" });

    const now = Date.now();
    const st = dailyStatus(p.daily, now);
    if (!st.canClaim) {
      return res.status(400).json({ error: "Already claimed today — come back tomorrow" });
    }
    const day = st.done + 1;
    const crop = DAILY_REWARDS[day - 1]!;
    const updated = await players.findOneAndUpdate(
      { _id: tg.id },
      {
        $set: { daily: { streak: day, lastDay: dayKey(now) } },
        $inc: { [`seeds.${crop}`]: DAILY_SEEDS },
      },
      { returnDocument: "after" }
    );
    return res.json({ day, crop, player: await view(db, updated || p) });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || "Claim daily failed" });
  }
});

// Sell harvested crops
app.post("/api/player/sell", async (req: Request, res: Response) => {
  try {
    const { initData, crop, qty } = req.body;
    if (!isCrop(crop)) return res.status(400).json({ error: "Invalid crop" });
    const quantity = Number(qty);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1_000_000) {
      return res.status(400).json({ error: "Invalid quantity" });
    }

    const { tg, db, players } = await ctx(initData);
    const earn = CROP_RULES[crop].sellCents * quantity;
    const updated = await players.findOneAndUpdate(
      { _id: tg.id, [`crops.${crop}`]: { $gte: quantity } },
      { $inc: { [`crops.${crop}`]: -quantity, balanceCents: earn } },
      { returnDocument: "after" }
    );
    if (!updated) {
      return res.status(400).json({ error: "Not enough crops" });
    }
    return res.json({ earnedCents: earn, player: await view(db, updated) });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || "Sell failed" });
  }
});

// TON price quote
app.get("/api/ton/quote", async (_req: Request, res: Response) => {
  try {
    const price = await getTonUsd();
    res.json({
      tonUsd: price,
      nanoPerDollar: tonNanoForUsd(100, price).toString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Price quote unavailable" });
  }
});

// Create seed purchase order
app.post("/api/orders/create", async (req: Request, res: Response) => {
  try {
    const { initData, crop, qty } = req.body;
    if (!isCrop(crop)) return res.status(400).json({ error: "Invalid seed" });
    const quantity = Number(qty);
    if (!Number.isInteger(quantity) || quantity < MIN_SEED_BUY || quantity > MAX_SEED_BUY) {
      return res.status(400).json({ error: `Buy at least ${MIN_SEED_BUY} seeds` });
    }

    const { tg, db } = await ctx(initData);
    const price = await getTonUsd();
    const nano = tonNanoForUsd(seedPriceCents(crop, quantity), price).toString();
    const id = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    const comment = `FC-${id}`;
    await db.collection("orders").insertOne({
      _id: id as never,
      telegramId: tg.id,
      crop,
      qty: quantity,
      nano,
      comment,
      status: "pending",
      createdAt: new Date(),
    });
    return res.json({ orderId: id, address: MERCHANT_ADDRESS, nano, comment });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || "Failed to create order" });
  }
});

// Confirm seed purchase order
app.post("/api/orders/confirm", async (req: Request, res: Response) => {
  try {
    const { initData, orderId } = req.body;
    if (typeof orderId !== "string" || !/^[a-f0-9]{16}$/.test(orderId)) {
      return res.status(400).json({ error: "Invalid order" });
    }

    const { tg, db, players } = await ctx(initData);
    const orders = db.collection<{
      _id: string;
      telegramId: number;
      crop?: CropKey;
      qty?: number;
      nano: string;
      comment: string;
      status: string;
      txHash?: string;
    }>("orders");
    const order = await orders.findOne({ _id: orderId, telegramId: tg.id });
    if (!order) return res.status(404).json({ error: "Order not found" });

    const p = await players.findOne({ _id: tg.id });
    if (order.status === "paid") {
      return res.json({ paid: true, player: p ? await view(db, p) : null });
    }

    if (!order.crop || !order.qty) return res.status(400).json({ error: "Old order type" });

    const hash = await findPayment(order.comment, BigInt(order.nano));
    if (!hash) {
      return res.json({ paid: false, player: null });
    }

    const used = await orders.findOne({ txHash: hash });
    if (used) return res.status(400).json({ error: "Payment already used" });

    const claim = await orders.updateOne(
      { _id: order._id, status: "pending" },
      { $set: { status: "paid", txHash: hash, paidAt: new Date() } }
    );
    if (claim.modifiedCount) {
      const me = await players.findOneAndUpdate(
        { _id: tg.id },
        { $inc: { [`seeds.${order.crop}`]: order.qty } },
        { returnDocument: "after" }
      );
      const reward = referralRewardCents(seedPriceCents(order.crop, order.qty));
      if (me?.referredBy && reward > 0) {
        await players.updateOne(
          { _id: me.referredBy },
          { $inc: { balanceCents: reward, referralEarnedCents: reward } }
        );
      }
    }

    const updated = await players.findOne({ _id: tg.id });
    return res.json({ paid: true, player: updated ? await view(db, updated) : null });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || "Confirmation failed" });
  }
});

// Withdraw balance
app.post("/api/player/withdraw", async (req: Request, res: Response) => {
  try {
    const { initData, cents, address: rawAddress } = req.body;
    const amountCents = Number(cents);
    if (!Number.isInteger(amountCents) || amountCents < MIN_WITHDRAW_CENTS || amountCents > 10_000_000) {
      return res.status(400).json({ error: "Minimum withdraw is $0.10" });
    }
    if (typeof rawAddress !== "string" || rawAddress.length > 100) {
      return res.status(400).json({ error: "Connect your Tonkeeper wallet" });
    }

    let address: string;
    try {
      address = normalizeAddress(rawAddress);
    } catch {
      return res.status(400).json({ error: "Invalid wallet address" });
    }

    const { tg, db, players } = await ctx(initData);
    const price = await getTonUsd();
    const nano = tonNanoForUsd(amountCents, price);

    const updated = await players.findOneAndUpdate(
      { _id: tg.id, balanceCents: { $gte: amountCents } },
      { $inc: { balanceCents: -amountCents } },
      { returnDocument: "after" }
    );
    if (!updated) {
      return res.status(400).json({ error: "Not enough balance" });
    }

    await db.collection("withdrawals").insertOne({
      _id: crypto.randomUUID() as never,
      telegramId: tg.id,
      cents: amountCents,
      nano: nano.toString(),
      address,
      status: "pending",
      createdAt: new Date(),
    });

    kickPayouts();
    return res.json({ player: await view(db, updated) });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || "Withdrawal failed" });
  }
});

// Withdrawal support links
app.get("/api/public/withdrawal-links", (_req: Request, res: Response) => {
  const sanitize = (raw?: string) => {
    if (!raw) return null;
    try {
      const u = new URL(raw.trim());
      return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
    } catch {
      return null;
    }
  };
  res.json({
    paymentsProof: sanitize(process.env["PAYMENTS_PROOF_URL"]),
    contactSupport: sanitize(process.env["CONTACT_SUPPORT_URL"]),
  });
});

// Server-side Rewarded Ad verification
const handleReward = async (req: Request, res: Response) => {
  try {
    const userId = req.query.userid || req.body?.userid;
    const crop = req.query.crop || req.body?.crop;
    const part = req.query.part || req.body?.part;

    if (!userId) {
      return res.status(400).json({ error: "Missing userid parameter" });
    }

    const db = await getDb();
    const players = db.collection<PlayerDoc>("players");
    const player = await players.findOne({ _id: Number(userId) });
    if (!player) {
      return res.status(404).json({ error: "Player not found" });
    }

    const now = Date.now();
    if (player.lastAdAt && new Date(player.lastAdAt).getTime() + AD_COOLDOWN_MS > now) {
      return res.status(429).json({ error: "Ad cooldown not expired" });
    }

    if (crop && part !== undefined && part !== null) {
      const k = crop as CropKey;
      if (!isCrop(k)) return res.status(400).json({ error: "Invalid crop" });
      const partNum = Number(part);
      if (!isFieldPart(k, partNum)) return res.status(400).json({ error: "Invalid field part" });

      const list = parts(player, k);
      const f = list[partNum]!;
      if (!f.planted) return res.status(400).json({ error: "Plant a seed first" });
      if (isReady(k, f, now)) return res.status(400).json({ error: "Already fully grown" });

      list[partNum] = { ...f, ads: Math.min(CROP_RULES[k].adsNeed, f.ads + 1) };
      await players.updateOne(
        { _id: Number(userId) },
        { $set: { [`fields.${k}`]: list, lastAdAt: new Date(now) } }
      );
      return res.json({ success: true, message: "Ad progress updated" });
    }

    await players.updateOne({ _id: Number(userId) }, { $set: { lastAdAt: new Date(now) } });
    return res.json({ success: true, message: "Reward cooldown updated" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
};

app.get("/reward", handleReward);
app.post("/reward", handleReward);

// Telegram Bot Webhook
app.post("/api/public/telegram", async (req: Request, res: Response) => {
  const secret = process.env["TELEGRAM_WEBHOOK_SECRET"];
  if (secret && req.headers["x-telegram-bot-api-secret-token"] !== secret) {
    return res.status(403).send("forbidden");
  }

  const update = req.body as {
    message?: { chat: { id: number }; from?: { id: number }; text?: string };
  } | null;
  const msg = update?.message;
  if (!msg?.text?.startsWith("/start")) return res.send("ok");

  const appUrl = process.env["WEBAPP_URL"] ?? `https://${req.headers.host}`;
  const payload = msg.text.split(" ")[1];
  const ref = payload?.match(/^ref_(\d+)$/);
  if (ref && msg.from && Number(ref[1]) !== msg.from.id) {
    try {
      const db = await getDb();
      await db.collection<{ _id: number; ref: number; at: Date }>("start_refs").updateOne(
        { _id: msg.from.id },
        { $setOnInsert: { ref: Number(ref[1]), at: new Date() } },
        { upsert: true }
      );
    } catch (e) {
      console.error("save ref failed", e);
    }
  }

  const caption = [
    "🌾 <b>Welcome to Farm City!</b>",
    "",
    "🌱 Plant seeds  •  ⏳ Grow them  •  🌽 Harvest crops",
    "💰 Sell crops for real balance",
    "👥 Invite friends & earn 10% of their purchases",
    "⚡ Withdraw to your TON wallet — auto payout!",
    "",
    "👇 Tap <b>Play Now</b> to start farming",
  ].join("\n");

  const rows: { text: string; web_app?: { url: string }; url?: string }[][] = [
    [{ text: "🎮 Play Now", web_app: { url: appUrl } }],
  ];
  if (process.env["CHANNEL_URL"]) rows.push([{ text: "📢 Official Channel", url: process.env["CHANNEL_URL"] }]);
  if (process.env["SUPPORT_URL"]) rows.push([{ text: "💬 Support Group", url: process.env["SUPPORT_URL"] }]);

  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (token) {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: msg.chat.id,
        text: caption,
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: rows },
      }),
    }).catch((e) => console.error("Telegram sendMessage error", e));
  }

  return res.send("ok");
});

// Payout cron trigger
app.get("/api/public/payout", async (req: Request, res: Response) => {
  const secret = process.env["PAYOUT_CRON_SECRET"];
  const key = req.query.key;
  if (!secret || key !== secret) return res.send("ok");
  return res.json(await runPayouts());
});

// Start listening if run directly
const PORT = process.env["PORT"] || 5000;
if (process.env["NODE_ENV"] !== "test" && !process.env["EMBEDDED_DEV"]) {
  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Backend server listening on 0.0.0.0:${PORT}`);
  });
}
