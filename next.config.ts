import type { NextConfig } from 'next';
import { execSync } from 'child_process';

let gitSha = 'dev';
try {
  gitSha = execSync('git rev-parse --short HEAD').toString().trim();
} catch {}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_GIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || gitSha,
    NEXT_PUBLIC_GIT_COMMIT_MSG: (() => {
      try {
        return execSync('git log -1 --format=%s').toString().trim();
      } catch {
        return '';
      }
    })(),
  },
};

export default nextConfig;
