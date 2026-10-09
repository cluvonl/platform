#!/usr/bin/env python3
"""Run Next against only the fixed, disposable local admin HTTP stack.

Local CLI credentials are passed in process memory, never printed or persisted.
"""
import os
import re
import secrets
import sys
import subprocess
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
result = subprocess.run(['npx', 'supabase', 'status', '-o', 'env'], cwd=ROOT,
                        capture_output=True, text=True, check=True)
values = dict(re.findall(r'^([A-Z_]+)="([^"]*)"$', result.stdout, re.M))
assert values['PUBLISHABLE_KEY'].startswith('sb_publishable_')
assert values['SECRET_KEY'].startswith('sb_secret_')
environment = dict(os.environ, APP_ENV='local', APP_MODE='app',
                   APP_URL='http://127.0.0.1:3400',
                   SUPABASE_URL='http://127.0.0.1:62321',
                   SUPABASE_PUBLISHABLE_KEY=values['PUBLISHABLE_KEY'],
                   SUPABASE_SECRET_KEY=values['SECRET_KEY'],
                   INVITATION_TOKEN_SECRET=secrets.token_hex(32))
mode='build'if '--build'in sys.argv else 'start'if '--start'in sys.argv else 'dev'
if mode=='start':
 # Match the Dockerfile: include the entire public directory, even when
 # Next tracing has already copied a partial public/app directory.
 for target,source in [(ROOT/'.next/standalone/public',ROOT/'public'),(ROOT/'.next/standalone/.next/static',ROOT/'.next/static')]:
  assert str(target).startswith(str(ROOT/'.next/standalone')+'/')
  if target.is_symlink():target.unlink()
  elif target.exists():shutil.rmtree(target)
  shutil.copytree(source,target)
 environment.update(PORT='3400',HOSTNAME='127.0.0.1')
arguments=['node','--import','./scripts/runtime-guard.mjs','./node_modules/next/dist/bin/next',mode]
if mode in('dev','build'):arguments+=['--webpack']
if mode=='dev':arguments+=['--hostname','127.0.0.1','--port','3400']
if mode=='start':arguments=['node','--import','./scripts/runtime-guard.mjs','./.next/standalone/server.js']
os.execvpe('node',arguments,environment)
