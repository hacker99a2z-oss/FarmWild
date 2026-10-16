import type { CropKey, PlayerView } from "./rules";

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || "").replace(/\/$/, "");

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data as T;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data as T;
}

export const api = {
  loadPlayer: (initData: string) =>
    post<PlayerView>("/api/player/load", { initData }),

  tapField: (initData: string, crop: CropKey, part: number) =>
    post<{ ok: boolean; message: string; player: PlayerView }>("/api/player/tap", {
      initData,
      crop,
      part,
    }),

  claimDaily: (initData: string) =>
    post<{ day: number; crop: CropKey; player: PlayerView }>("/api/player/claim-daily", {
      initData,
    }),

  sellCrops: (initData: string, crop: CropKey, qty: number) =>
    post<{ earnedCents: number; player: PlayerView }>("/api/player/sell", {
      initData,
      crop,
      qty,
    }),

  withdraw: (initData: string, cents: number, address: string) =>
    post<{ player: PlayerView }>("/api/player/withdraw", {
      initData,
      cents,
      address,
    }),

  getGramQuote: () =>
    get<{ tonUsd: number; nanoPerDollar: string }>("/api/ton/quote"),

  createSeedOrder: (initData: string, crop: CropKey, qty: number) =>
    post<{ orderId: string; address: string; nano: string; comment: string }>(
      "/api/orders/create",
      { initData, crop, qty }
    ),

  confirmSeedOrder: (initData: string, orderId: string) =>
    post<{ paid: boolean; player: PlayerView | null }>("/api/orders/confirm", {
      initData,
      orderId,
    }),

  getWithdrawalLinks: () =>
    get<{ paymentsProof: string | null; contactSupport: string | null }>(
      "/api/public/withdrawal-links"
    ),

  verifyAdReward: (userId: number, crop: CropKey, part: number) =>
    get<{ success: boolean; message: string }>(
      `/reward?userid=${userId}&crop=${crop}&part=${part}`
    ),
};
