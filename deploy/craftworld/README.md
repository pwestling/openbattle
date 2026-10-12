# Open Battle on Craftworld

The public site at https://openbattle.thehivemind5.com runs on Craftworld (vps-01), a NixOS
host. It is the same stack as the docker compose kit in [docs/self-host.md](../../docs/self-host.md),
run as NixOS services with nginx in place of Caddy:

| Path                                     | Service                                     | Port                                    |
| ---------------------------------------- | ------------------------------------------- | --------------------------------------- |
| `/`, `/health`                           | nginx serves `/srv/openbattle/current/dist` | 443                                     |
| `/relay`, `/config.json`, `/health.json` | `openbattle-relay` (server/relay.mjs)       | 4400                                    |
| TURN                                     | `coturn`                                    | 3478 UDP/TCP, relays on UDP 49160–49359 |

TURN is capped to protect the server: at most 180 relays at once (about 90 players who need
TURN), 1 Mbit/s per relay and 50 Mbit/s in all. Past that, coturn turns new connections away and
the app tells players the site's relay is busy. Widen the DigitalOcean port range and `total-quota`
together if that starts happening.

Releases live in
`/srv/openbattle/releases/<time>-<rev>`, with `/srv/openbattle/current` pointing at one.

## First deploy

All of this runs from Porter's Mac, where the infra checkout and Tailscale SSH are.

1. **Infra module.** Copy `openbattle.nix` to the infra repo as `hosts/vps-01/apps/openbattle.nix`
   and import it from `hosts/vps-01/configuration.nix`.
2. **Secret.** One TURN secret, stored twice in `hosts/vps-01/secrets/openbattle.yaml`:
   ```sh
   secret=$(openssl rand -hex 32)
   printf 'environment: "TURN_SECRET=%s"\nturn-secret: "%s"\n' "$secret" "$secret" \
     > hosts/vps-01/secrets/openbattle.yaml
   scripts/sops.sh -e -i hosts/vps-01/secrets/openbattle.yaml
   ```
   Until this file exists the module adds nothing but the release directory.
3. **DigitalOcean firewall** (`vps-01-admin`). TCP 443 is already open. TURN needs:
   ```sh
   doctl --context personal-vps compute firewall add-rules d3652637-698e-40cd-bda8-a4b0c8797dd2 \
     --inbound-rules 'protocol:tcp,ports:3478,address:0.0.0.0/0,address:::/0 protocol:udp,ports:3478,address:0.0.0.0/0,address:::/0 protocol:udp,ports:49160-49359,address:0.0.0.0/0,address:::/0'
   ```
4. **DNS.** Cloudflare zone `thehivemind5.com`: A `openbattle` → `164.90.155.4`, DNS only, TTL 60.
   Without it the name falls to the `*.thehivemind5.com` wildcard (RackNerd).
5. **Release, then infra.** `deploy/craftworld/release.sh` puts the build in place (it skips the
   restart while the services don't exist yet). Then commit the infra change and run
   `scripts/deploy.sh` in the infra repo; nginx gets its certificate and the services start.
6. **Check.** `https://openbattle.thehivemind5.com/health` should show the relay and TURN as up.
   Two browsers on different networks with `?forceTurn=1` should connect through TURN.

## Later releases

They deploy themselves. Each push to main that passes CI's `check` job is built by the
`craftworld` job and published to the repo's
[craftworld release](https://github.com/pwestling/openbattle/releases/tag/craftworld) as
`openbattle-<rev>.tar.gz` plus `openbattle.json` (its revision and SHA-256). On Craftworld the
`openbattle-pull` timer looks every two minutes. When it finds a new revision it checks the hash,
switches `current`, restarts the three services and health-checks them and the page nginx
serves. If anything fails it switches back, restarts again and skips that revision until a newer
one arrives. Nothing in GitHub can reach the server: it only downloads from the public repo.

- See what happened: `journalctl -u openbattle-pull` on the server.
- Deploy now instead of waiting: `systemctl start openbattle-pull`.
- By hand, from a clean checkout of main: `deploy/craftworld/release.sh` (builds the committed
  HEAD, uploads it, switches `current` and restarts the services).
- Roll back by hand: point `current` at an older release in `/srv/openbattle/releases` and
  restart the three services. The next push to main deploys over it.

Changes to `openbattle.nix` itself (services, nginx, coturn, this timer) still need copying into
the infra repo and `scripts/deploy.sh`.
