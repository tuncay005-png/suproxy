#!/usr/bin/env node
// GitHub API push script — uploads workspace files to GitHub repo via Git Data API
// Strategy: use "Create or update file contents" to bootstrap the empty repo,
// then use Git Data API (blobs/tree/commit) for remaining files.

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const PAT = process.env.GITHUB_PAT;
const OWNER = 'tuncay005-png';
const REPO = 'suproxy';
const BASE = '/home/runner/workspace';
const API = 'https://api.github.com';

const headers = {
  'Authorization': `Bearer ${PAT}`,
  'Accept': 'application/vnd.github.v3+json',
  'Content-Type': 'application/json',
  'X-GitHub-Api-Version': '2022-11-28',
};

// Directories/files to skip
const SKIP_DIRS = new Set([
  '.git', 'node_modules', '.pnpm-store', 'dist', 'attached_assets',
  '.local', '.agents', '.cache', '.expo',
]);
const SKIP_FILES = new Set(['.DS_Store']);
const SKIP_EXTENSIONS = new Set(['.map', '.tsbuildinfo']);

async function api(method, path, body) {
  const resp = await fetch(`${API}${path}`, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(`GitHub API ${method} ${path} → ${resp.status}: ${JSON.stringify(data).slice(0, 300)}`);
  return data;
}

function getAllFiles(dir, base = dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry) || SKIP_FILES.has(entry)) continue;
    const full = join(dir, entry);
    const rel = relative(base, full);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...getAllFiles(full, base));
    } else {
      const dotParts = entry.split('.');
      const ext = dotParts.length > 1 ? '.' + dotParts.pop() : '';
      if (SKIP_EXTENSIONS.has(ext)) continue;
      if (stat.size > 900_000) { console.log(`  Skipping too-large: ${rel}`); continue; }
      files.push({ full, rel, size: stat.size });
    }
  }
  return files;
}

function readAsBase64(filePath) {
  return readFileSync(filePath).toString('base64');
}

function readAsUtf8(filePath) {
  try { return { content: readFileSync(filePath, 'utf8'), encoding: 'utf-8' }; }
  catch { return { content: readAsBase64(filePath), encoding: 'base64' }; }
}

async function main() {
  console.log('Gathering files...');
  const files = getAllFiles(BASE);
  console.log(`Found ${files.length} files`);

  // Step 1: Bootstrap the empty repo with first file via contents API
  const firstFile = files[0];
  const { content: firstContent } = readAsUtf8(firstFile.full);
  console.log(`\nBootstrapping repo with: ${firstFile.rel}`);
  const bootstrapResp = await api('PUT', `/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(firstFile.rel)}`, {
    message: 'Initial import from Replit',
    content: Buffer.from(firstContent).toString('base64'),
  });
  const baseCommitSha = bootstrapResp.commit.sha;
  const baseTreeSha = bootstrapResp.commit.tree?.sha;
  console.log(`Bootstrap commit: ${baseCommitSha}`);
  console.log(`Base tree: ${baseTreeSha}`);

  // Step 2: Create blobs for remaining files
  const remainingFiles = files.slice(1);
  console.log(`\nCreating blobs for ${remainingFiles.length} remaining files...`);
  const treeItems = [];

  for (let i = 0; i < remainingFiles.length; i += 8) {
    const batch = remainingFiles.slice(i, i + 8);
    const results = await Promise.all(batch.map(async ({ full, rel }) => {
      try {
        const { content, encoding } = readAsUtf8(full);
        const blob = await api('POST', `/repos/${OWNER}/${REPO}/git/blobs`, { content, encoding });
        return { path: rel, mode: '100644', type: 'blob', sha: blob.sha };
      } catch (e) {
        console.warn(`  Warn: skipping ${rel}: ${e.message.slice(0, 80)}`);
        return null;
      }
    }));
    treeItems.push(...results.filter(Boolean));
    process.stdout.write(`  ${Math.min(i + 8, remainingFiles.length)}/${remainingFiles.length} blobs\r`);
  }
  console.log(`\nCreated ${treeItems.length} blobs`);

  // Step 3: Create a new tree on top of the bootstrap tree
  console.log('Creating tree...');
  const tree = await api('POST', `/repos/${OWNER}/${REPO}/git/trees`, {
    base_tree: baseTreeSha,
    tree: treeItems,
  });

  // Step 4: Create commit
  console.log('Creating commit...');
  const commit = await api('POST', `/repos/${OWNER}/${REPO}/git/commits`, {
    message: 'Import SuProxy project from Replit',
    tree: tree.sha,
    parents: [baseCommitSha],
  });

  // Step 5: Update main branch ref
  console.log('Updating main branch...');
  await api('PATCH', `/repos/${OWNER}/${REPO}/git/refs/heads/main`, {
    sha: commit.sha,
    force: false,
  });

  console.log(`\n✅ Done! Pushed ${treeItems.length + 1} files to https://github.com/${OWNER}/${REPO}`);
}

main().catch(e => { console.error('\n❌ FAILED:', e.message); process.exit(1); });
