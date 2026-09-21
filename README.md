# Opiquill website

Vue 3, Vite, ethers v6 and Lucide icons. English interface, documents and launch assets. A charcoal navigation rail opens four workspaces on a warm ivory canvas: The board, My record, The method and Common ground. The board pairs a question ledger with a contextual dossier; the forecast drawer keeps the rules and next action together. Georgia headlines, DM Sans body text, acid yellow and tomato orange define the visual system.

```sh
npm ci
npm run dev
npm run build
npm run preview
```

Use the address printed by Vite. Deploy only `dist/` to an HTTPS static host. `public/deployment.json` holds public contract metadata. Wallet interactions run through the user's wallet; read-only calls use the official testnet RPC. The private `../key.txt` belongs only to contract deployment scripts and must never be copied into this site.

There is no backend, account database, paid plan, bot, email collection, tracking integration or real-money trading. Wallet verification is a five-minute browser-memory ownership check. Chain writes require a separate wallet transaction and confirmation.

The current identity is Opiquill / opiquill.xyz / @opiquill. The domain and handle are proposed, not registered by this delivery. See `../README.md`, `../docs/brand-guide.md`, `../docs/verification.md` and `../contracts/README.md` for identity, acceptance and operational details.
