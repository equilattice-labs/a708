# Forevane website

Vue 3, Vite, ethers v6 and Lucide icons. Styling and illustration assets are original. Text, downloadable business plan and social assets are English.

```sh
npm ci
npm run dev
npm run build
npm run preview
```

Deploy `dist/` to an HTTPS static host. `public/deployment.json` contains public contract metadata, never a private key. Wallet interactions run in the user's wallet; read-only chain calls use the official testnet RPC. The private `../key.txt` belongs only to contract deployment scripts and must never be copied here.

No backend, account database, paid plans, bots, email collection, analytics tracking or real-money trading is included. Wallet verification is a five-minute browser-memory ownership check. Chain actions are authorized by wallet transactions.

See `../README.md`, `../docs/verification.md` and `../contracts/README.md` for complete operational details.
