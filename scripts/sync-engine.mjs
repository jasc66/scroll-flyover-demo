#!/usr/bin/env node
// Copies the engine from the published `scroll-flyover` npm package (the single
// source of truth) into ./references/, so this repo never carries its own
// hand-maintained copy that can silently drift from the real skill. To pick up an
// engine fix: bump the scroll-flyover version in package.json, run `npm install`
// (this script also runs automatically as postinstall), then commit the result.
import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const src = path.join(root, 'node_modules', 'scroll-flyover', 'references');
const dest = path.join(root, 'references');

// Whole references/ dir, not just scrub-engine.js — also picks up
// qa-reproducibility.mjs, which this repo's own QA suite runs per example.
await mkdir(dest, { recursive: true });
await cp(src, dest, { recursive: true });
console.log(`Synced ${dest} from node_modules/scroll-flyover.`);
