# Project Overlay

Place team-specific customizations here. These files are committed to your project
and are never modified by base updates. Structure mirrors base/ for clarity.

## Files

- `configs/bashrc_custom` — custom shell configuration sourced on login
- `configs/firewall/firewall-allowlist-project.json` — additional firewall domains
- `configs/sudoers/sudoers-project` — project-specific sudoers rules
- `configs/mcp/` — custom MCP server configurations (scaffolded by mcp-servers feature)
- `scripts/project-install.sh` — one-time installs with full network (before firewall)
- `scripts/lifecycle/post-create.sh` — runs after container creation (first time)
- `scripts/lifecycle/post-start.sh` — runs after every container start
