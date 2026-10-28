#!/bin/bash
# Project install hook — runs ONCE during container creation with full network access.
# Use this for: SDK downloads, toolchain installs, large binary fetches.
#
# This runs BEFORE the firewall is activated, so all domains are reachable.
# Do NOT add install-only domains to firewall-allowlist-project.json — use this hook instead.
#
# Examples:
#   curl -fsSL https://storage.googleapis.com/flutter_infra_release/releases/... | tar xz
#   npm install -g some-global-tool
