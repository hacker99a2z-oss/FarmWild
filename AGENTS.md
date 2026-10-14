<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Game state lives in MongoDB and every game action is a server function that verifies Telegram initData — the client never decides balances, water or crops.
- Shared game numbers live in src/lib/rules.ts (covered by rules.test.ts) so client and server can't drift.
- Gram (TON) payments use TON Connect in the browser (lazy-loaded) and are confirmed server-side by matching the order comment on the merchant wallet; payouts are sent from a server-held wallet.

- Crop fields use independent indexed parts; atomically upgrade legacy fields while preserving progress in part zero.
- Read only public withdrawal destinations from runtime environment in a public server function; never expose other environment values.
- Use one shared withdrawal history limit in server and browser to keep the latest records consistent.
