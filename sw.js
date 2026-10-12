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
const VERSION = "42f710317073";
const FILES = ["assets/Board-TjzL3FGw.js","assets/Branch-DOxvuqTG.js","assets/BufferGeometryUtils-gzGtEl-O.js","assets/Editor-BAzs6XKv.js","assets/EventSeat-CdiZP_xw.js","assets/EventsUI-Bba88SZi.js","assets/FigureLibrary-BpcCpARU.js","assets/Game-gSMYCRFC.js","assets/GameScreen-CA-KzOLy.js","assets/MailLobby-Cn6XpQu6.js","assets/Miniatures-Dh1Rz8dq.js","assets/NextApp-BwN4APxv.js","assets/NextApp-C6C3HxyA.css","assets/OpenTables-Di3e7C-A.js","assets/Packages-b5XCSsYG.js","assets/PhotoMatch-B-DS7Gsf.js","assets/PlayerCard-CaaKQhIZ.js","assets/RankedGame-BP6Bytvf.js","assets/RulesPage-DZ0J4D-l.js","assets/StandeeMaker-BxOGaimJ.js","assets/TeachRule-DdT8GiFQ.js","assets/Workshop-DW6C1x0M.js","assets/_virtual_sandbox-worker-DgQ9wB9p.js","assets/_virtual_soak-worker-B9YL9q_Q.js","assets/actions-DVXO-tla.js","assets/aws4fetch.esm-BLUAl4pF.js","assets/base64-gMTPUZJI.js","assets/board-ClnLF56w.js","assets/book-D8cLR53a.js","assets/brinewatch-DN2-OwGh.js","assets/browser-bopAeLbn.js","assets/codec-DOoWeNvh.js","assets/config-Kg6xkhHB.js","assets/core-DoB44smz.js","assets/de-Bhxmdj7d.js","assets/demo-DKiYfYLM.js","assets/dist-WFp3Oeug.js","assets/dist-YYVtoirG.js","assets/dist-lgRNSFRF.js","assets/events-9ce18a08.esm-D-QCksbz.js","assets/faction-BltxblUO.js","assets/file-qvOJhGA3.js","assets/files-CdfAAl3C.js","assets/fr-DdQ6toiR.js","assets/fxp-CNHNYw_7.js","assets/gameLog-dFk5iafm.js","assets/hooks-BQqt94yn.js","assets/http-BrbySMk8.js","assets/idb-OWIpJU7O.js","assets/index-Chj8U0ni.css","assets/index-NPi2crCk.js","assets/jsx-runtime-NZYk81nU.js","assets/keys-D-MKR9PG.js","assets/layout-BOcuMn65.js","assets/lesson-CBcRYlia.js","assets/levels-DlkUqTaf.js","assets/lit-n-Yt9ZNS.js","assets/live-CeDMYmPL.js","assets/mailbox-BTW9cbXa.js","assets/manifest-BRIPGYy3.js","assets/meshShape-Bl6eUNL2.js","assets/nostr-DmId0Lq7.js","assets/open-CtimmzoE.js","assets/open-Z0phF1iv.js","assets/pack-BOsKa4e4.js","assets/packPins-C5nc-2gM.js","assets/packageChange-Be729-6H.js","assets/page-DfIpk9iV.js","assets/play-DpK9t7IB.js","assets/post-D4EfXWT3.js","assets/preload-helper-BaNbYf_w.js","assets/printPlay-s6yYO8o_.js","assets/react-Cvdyeg_0.js","assets/react-dom-B-VxWsjA.js","assets/react-hsrUxga6.js","assets/relayBusy-DoHBJB33.js","assets/replayFile-CAoe3OrU.js","assets/report-BF9_yNNh.js","assets/rift-lanterns-DLDKmR7R.js","assets/rolldown-runtime-hePW80VL.js","assets/roster-DaMhocLc.js","assets/route-BkBKe2vI.js","assets/rulebook-DYk1I3nk.js","assets/scheduler-C784v2VA.js","assets/secp256k1-yVjC_Axf.js","assets/shelfActions-BtSYDqUW.js","assets/site-CHb1xoFU.js","assets/standIns-BTEgtfF8.js","assets/start-ZtVtmWt2.js","assets/store-BcmH06oP.js","assets/store-BneYCiQ4.js","assets/store-Cp1CRQ7j.js","assets/store-Cq2fXzZQ.js","assets/store-D4cJEuHX.js","assets/store-i4xWLGxX.js","assets/syntax-CEL_Wvla.js","assets/systemLabels-DkcyEaVU.js","assets/systems-qTlcFxwS.js","assets/talk-DLapGMrw.js","assets/three.module-DD1TOtOx.js","assets/thumb-BC8q2BA3.js","assets/trystero-B7o7vSAK.js","assets/webtorrent.min-DeIqevk6.js","assets/worker-Cju-sFDM.js","assets/worker-CtrB5Iye.js","assets/worker-DV1DuzPc.js","assets/worker-DplXsx8A.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","icons/maskable-512.png","index.html","manifest.webmanifest"];
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
