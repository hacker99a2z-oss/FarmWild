import { createServerFn } from "@tanstack/react-start";
import { publicWithdrawalUrl } from "./withdrawal-links";

/** Public configuration only; never return the environment object. */
export const getWithdrawalLinks = createServerFn({ method: "GET" }).handler(async () => ({
  paymentsProof: publicWithdrawalUrl(process.env["PAYMENTS_PROOF_URL"]),
  contactSupport: publicWithdrawalUrl(process.env["CONTACT_SUPPORT_URL"]),
}));