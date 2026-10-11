// Open Battle's service worker (#34), built by the `serviceWorker` plugin in
// vite.config.ts, which fills in the build's files and version.
//
// - It keeps the app on the device, so hotseat, solo games, lessons, replays,
//   the shelves and the campaign book work without a network, and the app can
//   be installed. A new version waits until the player chooses to reload
//   (src/sw/register.ts says when: never mid-game).
// - It shows play-by-mail notifications (src/mail/mailbox.ts). A push from
//   the mailbox carries nothing about the game: it only says a file has come,
//   and the app fetches it from the mailbox when it opens.
const VERSION = "ac6e83ba1124";
const FILES = ["assets/Board-CaSKTMT1.js","assets/BufferGeometryUtils-gzGtEl-O.js","assets/CommandPanel-BH4gbCuT.js","assets/CommandPanel-Bi4U5AfF.js","assets/CommandPanel-CFREzG9S.js","assets/Editor-DDTeAfF-.js","assets/EventSeat-BorOGuIU.js","assets/EventsUI-CYeQbGDQ.js","assets/FigureLibrary-Bpdbvg4d.js","assets/GameScreen-r6aAiU4Z.js","assets/MailLobby-B_UKkeNT.js","assets/Miniatures-DUHbm-f-.js","assets/OpenTables-DObUyTYl.js","assets/PhotoMatch-gpYYAMmq.js","assets/PlayerCard-BuDlWu25.js","assets/RankedGame-BvnwvPil.js","assets/RulesPage-D4LMJxwy.js","assets/StandeeMaker-IzwEZLY1.js","assets/TeachRule-TE41daWP.js","assets/Workshop-tcnpJYXS.js","assets/_virtual_sandbox-worker-UEAHsTPi.js","assets/_virtual_soak-worker-DiMF5SxP.js","assets/actions-gJYAWubU.js","assets/aws4fetch.esm-BLUAl4pF.js","assets/base64-gMTPUZJI.js","assets/book-Dm6DfwYE.js","assets/brinewatch-DN2-OwGh.js","assets/browser-UgmTalj_.js","assets/browser-bopAeLbn.js","assets/codec-DOoWeNvh.js","assets/config-Kg6xkhHB.js","assets/core-BCpOvlTV.js","assets/de-CfJuTQOX.js","assets/dist-WFp3Oeug.js","assets/dist-YYVtoirG.js","assets/dist-lgRNSFRF.js","assets/file-qvOJhGA3.js","assets/files-CdfAAl3C.js","assets/fr-BBe_5PVn.js","assets/fxp-CNHNYw_7.js","assets/fxp-DcRaohTd.js","assets/gameLog-CKlphS-S.js","assets/help-g3tn9H7p.js","assets/http-5byn-Ucq.js","assets/idb-OWIpJU7O.js","assets/index-BH23y70G.css","assets/index-BfpSBwFY.js","assets/jsx-runtime-NZYk81nU.js","assets/keys-D-MKR9PG.js","assets/layout-DsEURAxH.js","assets/lesson-BaC2G3IL.js","assets/levels-DlkUqTaf.js","assets/local-CD-gFMI8.js","assets/mailbox-Bat4zbng.js","assets/manifest-BRIPGYy3.js","assets/meshShape-DzF9a5Ro.js","assets/nostr-3hr_3JiF.js","assets/open-Z0phF1iv.js","assets/pack-CQdDDylk.js","assets/packageChange-Be729-6H.js","assets/page-DDyASzfQ.js","assets/play-DIim4Xz2.js","assets/post-Fm_M8j26.js","assets/preload-helper-BaNbYf_w.js","assets/printPlay-CV1-idau.js","assets/react-Bu-9VsiK.js","assets/react-Cvdyeg_0.js","assets/react-dom-B-VxWsjA.js","assets/react-hsrUxga6.js","assets/relayBusy-DoHBJB33.js","assets/replayFile-BLMsFSlA.js","assets/report-Z0YziaQT.js","assets/rift-lanterns-DLDKmR7R.js","assets/rolldown-runtime-hePW80VL.js","assets/roster-CVZButfQ.js","assets/route-BBOwze3u.js","assets/rulebook-DYk1I3nk.js","assets/scheduler-C784v2VA.js","assets/secp256k1-yVjC_Axf.js","assets/shelfActions-CmKdK0mL.js","assets/showcase-BVyZ9Omh.js","assets/site-CHb1xoFU.js","assets/standIns-BTEgtfF8.js","assets/store-BDR_iiu0.js","assets/store-BiEM9191.js","assets/store-C5zTqO69.js","assets/store-DKYWaTB4.js","assets/store-MUmwzseS.js","assets/syntax-CEL_Wvla.js","assets/systemLabels-Cj5FMnI_.js","assets/systems-Bb77jzAf.js","assets/systems-CH-bs1Br.js","assets/systems-CMBwm9M3.js","assets/talk-iA7lajmS.js","assets/three.module-DD1TOtOx.js","assets/thumb-U-0pfIFr.js","assets/trystero-CQejBhJ5.js","assets/trystero-UFErJx2D.js","assets/trystero-ZTrsR5mO.js","assets/webtorrent.min-DeIqevk6.js","assets/worker-BVA_ZBZ3.js","assets/worker-Bf23nJ5x.js","assets/worker-CtrB5Iye.js","assets/worker-DV1DuzPc.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","icons/maskable-512.png","index.html","manifest.webmanifest"];
const CACHE = `open-battle-${VERSION}`;
const DEV = VERSION === "dev";
const at = (path) => new URL(path, self.registration.scope).href;

self.addEventListener("install", (event) => {
  if (DEV) return;
  event.waitUntil(
    caches
      .open(CACHE)
      // Hashed build files never change, so the copies the page just loaded will do; the rest
      // (index.html, the manifest, icons) are fetched fresh.
      .then((cache) =>
        cache.addAll(
          FILES.map((f) => new Request(at(f), { cache: /-[\w-]{8}\.\w+$/.test(f) ? "default" : "reload" })),
        ),
      ),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names.filter((n) => n.startsWith("open-battle-") && n !== CACHE).map((n) => caches.delete(n)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// The page asks for the waiting version once the player says reload.
self.addEventListener("message", (event) => {
  if (event.data?.t === "skip-waiting") self.skipWaiting();
});

/** Things that only make sense live: the server's config, signalling, the mailbox, health. */
const LIVE = /\/(config\.json|health\.json|health|relay|mailbox)(\/|$|\?)/;

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (DEV || request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || LIVE.test(url.pathname)) return;
  if (request.mode === "navigate") {
    // The page: the network when it answers (it may carry a newer version), else the copy kept here.
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(at("index.html"), { cacheName: CACHE }).then((r) => r ?? Response.error()),
      ),
    );
    return;
  }
  // The build's files never change under a name: the kept copy first.
  event.respondWith(
    caches.match(request, { cacheName: CACHE, ignoreSearch: true }).then((kept) => kept ?? fetch(request)),
  );
});

self.addEventListener("push", (event) => {
  event.waitUntil(
    self.registration.showNotification("Your move · Open Battle", {
      body: "Your opponent sent their turn.",
      tag: "open-battle-mail",
      renotify: true,
      icon: at("icons/icon-192.png"),
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => w.url.startsWith(self.registration.scope));
      return open ? open.focus() : self.clients.openWindow(self.registration.scope);
    }),
  );
});
