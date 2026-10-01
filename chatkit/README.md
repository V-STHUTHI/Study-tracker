# ChatKit Starter Template

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
![NextJS](https://img.shields.io/badge/Built_with-NextJS-blue)
![OpenAI API](https://img.shields.io/badge/Powered_by-OpenAI_API-orange)

This repository is the simplest way to bootstrap a [ChatKit](http://openai.github.io/chatkit-js/) application. It ships with a minimal Next.js UI, the ChatKit web component, and a ready-to-use session endpoint so you can experiment with OpenAI-hosted workflows built using [Agent Builder](https://platform.openai.com/agent-builder).

## What You Get


## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Create your environment file

Copy the example file and fill in the required values:

```bash
cp .env.example .env.local
```

You can get your workflow id from the [Agent Builder](https://platform.openai.com/agent-builder) interface, after clicking "Publish":

<img src="./public/docs/workflow.jpg" width=500 />

You can get your OpenAI API key from the [OpenAI API Keys](https://platform.openai.com/api-keys) page.

### 3. Configure ChatKit credentials

Update `.env.local` with the variables that match your setup.


### 4. Run the app

```bash
npm run dev
```

Visit `http://localhost:3000` and start chatting. Use the prompts on the start screen to verify your workflow connection, then customize the UI or prompt list in [`lib/config.ts`](lib/config.ts) and [`components/ChatKitPanel.tsx`](components/ChatKitPanel.tsx).

### 5. Deploy your app

The `chatkit` directory is the Next.js app root. For a public URL without
requiring users to share your Wi-Fi, deploy this directory to a Next.js host
such as Vercel. Set the environment variables from `.env.example` in the host's
project settings, then deploy. Keep `OPENAI_API_KEY` server-side and do not add
it to a `NEXT_PUBLIC_` variable. Add the deployed site's origin to the OpenAI
[Domain allowlist](https://platform.openai.com/settings/organization/security/domain-allowlist).

To test from a phone on the same network, run `npm run dev` and open
`http://<computer-LAN-IP>:3000`. Binding to `0.0.0.0` enables LAN access only;
it does not publish the app to the internet. For internet access, deploy it or
use a secure tunnel.

```bash
npm run build
```

## Customization Tips


## References


# Daymark Study Tracker

A responsive study journal for tracking daily study time, subjects, topics, tests, and problems solved. The dashboard includes a study calendar, weekly charts, subject breakdowns, weekday averages, and CSV export.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. No API key or `.env.local` file is required.

## Use from a phone

The development server listens on all interfaces. On the same Wi-Fi network, open `http://<computer-LAN-IP>:3000` on your phone. For access outside your network, deploy the app to a Next.js host such as Vercel; set the `chatkit` directory as the project root.

## Data and privacy

Study sessions are stored in the browser's local storage on the device where they are entered. They are not synced between browsers or devices, and clearing browser storage removes them. Use **Export** to download a CSV backup. Cross-device sync and accounts require adding a shared database and authentication service.

## Build and check

```bash
npm run lint
npx tsc --noEmit --incremental false
npm run build
```
