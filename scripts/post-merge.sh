#!/bin/bash
set -e
npm install
npx drizzle-kit push --force < /dev/null 2>&1 || echo "[post-merge] drizzle-kit push skipped (interactive prompts detected). Run 'npm run db:push' manually if schema changes are needed."
