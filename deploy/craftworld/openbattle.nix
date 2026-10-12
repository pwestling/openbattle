# Open Battle (app repo: pwestling/openbattle, deploy/craftworld/openbattle.nix; copy it to the infra
# repo as hosts/vps-01/apps/openbattle.nix): a peer-to-peer tabletop for miniatures wargames.
# Public at https://openbattle.thehivemind5.com. nginx serves the built app and routes to one
# small Node service on loopback: the signalling relay (4400, also /config.json with TURN logins
# and /health.json).
# Games run in the players' browsers; coturn relays game traffic for players whose networks
# block a direct link.
#
# This mirrors the app repo's docker-compose self-host kit (docs/self-host.md), with nginx in
# place of Caddy. The services exist only once secrets/openbattle.yaml exists (keys `environment`,
# a TURN_SECRET=... line, and `turn-secret`, the same secret alone). Every push to openbattle
# main that passes CI deploys itself within a few minutes (openbattle-pull below); the app repo's
# deploy/craftworld/release.sh still promotes a build by hand.
{ config, lib, pkgs, ... }:
let
  domain = "openbattle.thehivemind5.com";
  secretsFile = ../secrets/openbattle.yaml;
  registered = builtins.pathExists secretsFile;
  release = "/srv/openbattle/current";
  state = "/var/lib/openbattle";
  turnPort = 3478;
  # Keep in step with the DigitalOcean firewall rule for TURN relays.
  turnMinPort = 49160;
  turnMaxPort = 49359;

  hardening = {
    User = "openbattle";
    Group = "openbattle";
    Slice = "apps.slice";
    WorkingDirectory = release;
    UMask = "0077";
    Restart = "on-failure";
    RestartSec = "5s";
    TimeoutStopSec = "15s";
    NoNewPrivileges = true;
    PrivateTmp = true;
    ProtectSystem = "strict";
    ProtectHome = true;
    PrivateDevices = true;
    ProtectKernelTunables = true;
    ProtectKernelModules = true;
    ProtectKernelLogs = true;
    ProtectControlGroups = true;
    RestrictSUIDSGID = true;
    RestrictRealtime = true;
    RestrictAddressFamilies = [ "AF_INET" "AF_INET6" "AF_UNIX" "AF_NETLINK" ];
    CapabilityBoundingSet = "";
    AmbientCapabilities = "";
    LimitCORE = 0;
    OOMPolicy = "kill";
    CPUWeight = 100;
  };

  # The relay listens on every address; only loopback (nginx, and the relay's STUN check of
  # coturn) may reach it.
  loopbackOnly = {
    IPAddressDeny = "any";
    IPAddressAllow = "localhost";
  };

  service = { description, script, environment ? { }, serviceConfig ? { }, after ? [ ] }: {
    inherit description environment;
    wantedBy = [ "multi-user.target" ];
    wants = [ "network-online.target" ];
    after = [ "network-online.target" "sops-install-secrets.service" ] ++ after;
    requires = [ "sops-install-secrets.service" ];
    startLimitIntervalSec = 60;
    startLimitBurst = 5;
    unitConfig.ConditionPathExists = "${release}/server/${script}";
    serviceConfig = hardening // {
      ExecStart = "${pkgs.nodejs_22}/bin/node ${release}/server/${script}";
    } // serviceConfig;
  };

  # A location that sets its own header drops the server's, so each repeats nosniff.
  nosniff = "add_header X-Content-Type-Options nosniff always;";
  noCache = ''
    ${nosniff}
    add_header Cache-Control "no-cache" always;
  '';

  proxy = port: {
    proxyPass = "http://127.0.0.1:${toString port}";
    extraConfig = ''
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $remote_addr;
      proxy_set_header X-Forwarded-Proto $scheme;
      proxy_set_header X-Forwarded-Host $host;
    '';
  };

  # Continuous deploy: CI publishes each green build of openbattle main to the repo's "craftworld"
  # release; this pulls the newest, health-checks it and rolls back on failure. Pull-based, so no
  # credential for this machine lives in GitHub. deploy/craftworld/release.sh still works by hand.
  pullRelease = pkgs.writeShellApplication {
    name = "openbattle-pull";
    runtimeInputs = with pkgs; [ coreutils curl findutils gnugrep gnutar gzip jq systemd ];
    text = ''
      set -euo pipefail
      base="https://github.com/pwestling/openbattle/releases/download/craftworld"
      root=/srv/openbattle
      state=/var/lib/openbattle-deploy
      units=(openbattle-relay)
      mkdir -p "$state" "$root/releases"

      manifest="$(curl -fsSL --max-time 30 "$base/openbattle.json")"
      rev="$(jq -er .rev <<<"$manifest")"
      file="$(jq -er .file <<<"$manifest")"
      sum="$(jq -er .sha256 <<<"$manifest")"
      [[ "$rev" =~ ^[0-9a-f]{7,40}$ && "$file" =~ ^openbattle-[0-9a-f]+\.tar\.gz$ && "$sum" =~ ^[0-9a-f]{64}$ ]] || {
        echo "Unexpected manifest: $manifest" >&2
        exit 1
      }
      current="$(cat "$root/current/REVISION" 2>/dev/null || true)"
      [[ "$rev" == "$current" ]] && exit 0
      if [[ "$(cat "$state/failed" 2>/dev/null || true)" == "$rev" ]]; then
        echo "Skipping $rev: it failed its health check before."
        exit 0
      fi

      work="$(mktemp -d)"
      trap 'rm -rf "$work"' EXIT
      curl -fsSL --max-time 300 -o "$work/release.tar.gz" "$base/$file"
      echo "$sum  $work/release.tar.gz" | sha256sum -c --quiet -
      name="$(date -u +%Y%m%dT%H%M%SZ)-$rev"
      release="$root/releases/$name"
      [[ -e "$release" ]] && release="$release-$$"
      mkdir -p "$work/x"
      tar --no-same-owner -xzf "$work/release.tar.gz" -C "$work/x"
      [[ -f "$work/x/dist/index.html" && -f "$work/x/server/relay.mjs" && "$(cat "$work/x/REVISION")" == "$rev" ]] || {
        echo "Release $rev is incomplete." >&2
        exit 1
      }
      if [[ -n "$(find "$work/x" -type l -path '*/dist/*' -print -quit)" ]]; then
        echo "Release $rev has a symlink in dist." >&2
        exit 1
      fi
      chown -R root:root "$work/x"
      chmod -R a+rX,go-w "$work/x"
      mv "$work/x" "$release"

      healthy() {
        for _ in $(seq 1 20); do
          if systemctl is-active --quiet "''${units[@]}" &&
            curl -fsS --max-time 3 http://127.0.0.1:4400/config.json >/dev/null &&
            curl -fsS --max-time 3 --resolve openbattle.thehivemind5.com:443:127.0.0.1 \
              https://openbattle.thehivemind5.com/ | grep -q '<div id="root"'; then
            return 0
          fi
          sleep 1
        done
        return 1
      }

      previous="$(readlink -f "$root/current" || true)"
      ln -sfn "$release" "$root/current.new"
      mv -Tf "$root/current.new" "$root/current"
      systemctl restart "''${units[@]}"
      sleep 2
      if healthy; then
        echo "Promoted Open Battle $rev ($name)."
        rm -f "$state/failed"
      else
        echo "Open Battle $rev failed its health check; rolling back." >&2
        echo "$rev" >"$state/failed"
        if [[ -n "$previous" && -d "$previous" ]]; then
          ln -sfn "$previous" "$root/current.new"
          mv -Tf "$root/current.new" "$root/current"
          systemctl restart "''${units[@]}"
        fi
        rm -rf "$release"
        exit 1
      fi

      # Keep the five newest releases, and always the previous one.
      find "$root/releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -rn | tail -n +6 | cut -d' ' -f2- |
        while read -r old; do
          [[ "$old" == "$previous" ]] || rm -rf "$old"
        done
    '';
  };
in
{
  users.groups.openbattle = { };
  users.users.openbattle = {
    isSystemUser = true;
    group = "openbattle";
    hashedPassword = "!";
  };

  systemd.tmpfiles.rules = [ "d /srv/openbattle/releases 0755 root root -" ];

  sops.secrets = lib.mkIf registered {
    "openbattle/environment" = {
      sopsFile = secretsFile;
      key = "environment";
      owner = "openbattle";
      mode = "0400";
      restartUnits = [ "openbattle-relay.service" ];
    };
    "openbattle/turn-secret" = {
      sopsFile = secretsFile;
      key = "turn-secret";
      owner = "turnserver";
      mode = "0400";
      restartUnits = [ "coturn.service" ];
    };
  };

  systemd.services = lib.mkIf registered {
    openbattle-relay = service {
      description = "Open Battle signalling relay";
      script = "relay.mjs";
      environment = {
        PORT = "4400";
        PUBLIC_URL = "https://${domain}";
        TURN_URLS = "turn:${domain}:${toString turnPort}?transport=udp,turn:${domain}:${toString turnPort}?transport=tcp";
        TURN_CHECK = "127.0.0.1:${toString turnPort}";
      };
      serviceConfig = loopbackOnly // {
        EnvironmentFile = config.sops.secrets."openbattle/environment".path;
        MemoryHigh = "192M";
        MemoryMax = "256M";
        TasksMax = 64;
      };
    };

    coturn.serviceConfig.Slice = "apps.slice";

    openbattle-pull = {
      description = "Promote the newest Open Battle build";
      wants = [ "network-online.target" ];
      after = [ "network-online.target" ];
      unitConfig.ConditionPathExists = release;
      serviceConfig = {
        Type = "oneshot";
        ExecStart = lib.getExe pullRelease;
        Slice = "builds.slice";
        TimeoutStartSec = "10min";
        PrivateTmp = true;
        NoNewPrivileges = true;
      };
    };
  };

  systemd.timers.openbattle-pull = lib.mkIf registered {
    wantedBy = [ "timers.target" ];
    timerConfig = {
      OnBootSec = "3min";
      OnUnitInactiveSec = "2min";
      RandomizedDelaySec = "20s";
    };
  };

  services.coturn = lib.mkIf registered {
    enable = true;
    realm = domain;
    listening-port = turnPort;
    min-port = turnMinPort;
    max-port = turnMaxPort;
    use-auth-secret = true;
    static-auth-secret-file = config.sops.secrets."openbattle/turn-secret".path;
    no-cli = true;
    no-tls = true;
    no-dtls = true;
    extraConfig = ''
      fingerprint
      # Keep TURN inside the relay port range and the box's bandwidth. Each player who needs TURN
      # holds one or two allocations, each one relay port; past the cap coturn answers 486 and the
      # app tells players the site's relay is busy. Game traffic and voice fit well inside max-bps.
      total-quota=180
      max-bps=125000
      bps-capacity=6250000
      no-tcp-relay
      stale-nonce=600
      no-multicast-peers
      no-rfc5780
      external-ip=164.90.155.4
      # Never relay into this machine's own or private networks (loopback, tailnet, DO VPC).
      denied-peer-ip=0.0.0.0-0.255.255.255
      denied-peer-ip=10.0.0.0-10.255.255.255
      denied-peer-ip=100.64.0.0-100.127.255.255
      denied-peer-ip=127.0.0.0-127.255.255.255
      denied-peer-ip=169.254.0.0-169.254.255.255
      denied-peer-ip=172.16.0.0-172.31.255.255
      denied-peer-ip=192.168.0.0-192.168.255.255
      denied-peer-ip=::1
      denied-peer-ip=fc00::-fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff
    '';
  };

  networking.firewall = lib.mkIf registered {
    allowedTCPPorts = [ turnPort ];
    allowedUDPPorts = [ turnPort ];
    allowedUDPPortRanges = [ { from = turnMinPort; to = turnMaxPort; } ];
  };

  services.nginx.virtualHosts.${domain} = lib.mkIf registered {
    enableACME = true;
    forceSSL = true;
    root = "${release}/dist";
    extraConfig = ''
      access_log off;
      ${nosniff}
    '';
    locations = {
      "/".tryFiles = "$uri $uri/ /index.html";
      # Hashed build assets never change; everything else revalidates after a release.
      "/assets/".extraConfig = ''
        ${nosniff}
        add_header Cache-Control "public, max-age=31536000, immutable" always;
      '';
      "= /index.html".extraConfig = noCache;
      "= /sw.js".extraConfig = noCache;
      "= /health".alias = "${release}/health.html";
      # proxyWebsockets sets HTTP/1.1 and the Upgrade headers for the signalling socket.
      "/relay" = (proxy 4400) // { proxyWebsockets = true; };
      "= /config.json" = proxy 4400;
      "= /health.json" = proxy 4400;
    };
  };
}
