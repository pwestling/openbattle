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
const VERSION = "5b0251dff9d9";
const FILES = ["assets/Board-D-Ywz4k3.js","assets/BufferGeometryUtils-Bg58SzpS.js","assets/CommandPanel-C41ej5nJ.js","assets/CommandPanel-D08WTLj0.js","assets/CommandPanel-Z3gfobLc.js","assets/Editor-CUcMBCH6.js","assets/EventSeat-Bu2h1B2k.js","assets/EventsUI-PIgo5ZvT.js","assets/FigureLibrary-BSLFofxd.js","assets/GameScreen-CdIFyD-4.js","assets/MailLobby-C3eqAsLM.js","assets/Miniatures-CykyiedP.js","assets/OpenTables-Bo7yR8vu.js","assets/PhotoMatch-LaqCNJIf.js","assets/PlayerCard-DQv5NiK6.js","assets/RankedGame-cZGlCa_b.js","assets/RulesPage-D1HK5iZQ.js","assets/StandeeMaker-CZL1IioU.js","assets/TeachRule-DtNBMfwa.js","assets/Workshop-D6zUfjPm.js","assets/_virtual_sandbox-worker-Cr07ZzyT.js","assets/_virtual_soak-worker-pX7t9Nv9.js","assets/actions-FbFIPytD.js","assets/aws4fetch.esm-BLUAl4pF.js","assets/base64-gMTPUZJI.js","assets/book-D9GUQz4H.js","assets/brinewatch-DN2-OwGh.js","assets/browser-UgmTalj_.js","assets/browser-bopAeLbn.js","assets/codec-DOoWeNvh.js","assets/config-Kg6xkhHB.js","assets/core-Dvaa98mY.js","assets/de-C3UD-Hj3.js","assets/dist-WFp3Oeug.js","assets/dist-YYVtoirG.js","assets/dist-lgRNSFRF.js","assets/file-qvOJhGA3.js","assets/files-CdfAAl3C.js","assets/fr-C05XTvk4.js","assets/fxp-CNHNYw_7.js","assets/fxp-DcRaohTd.js","assets/gameLog-D6vEBYAU.js","assets/help-CT0hEx_i.js","assets/http-DWnav0A8.js","assets/idb-OWIpJU7O.js","assets/index-B0zJAkPM.js","assets/index-Cx3-Bc6E.css","assets/jsx-runtime-NZYk81nU.js","assets/keys-D-MKR9PG.js","assets/layout-CwSy17qd.js","assets/lesson-CAvHiKSw.js","assets/levels-DlkUqTaf.js","assets/local-Dptt5pgu.js","assets/mailbox-B1PMYGAM.js","assets/manifest-BRIPGYy3.js","assets/meshShape-gAkVoX9h.js","assets/nostr-CX11T1A9.js","assets/pack-DZ-C9p4X.js","assets/packageChange-Be729-6H.js","assets/page-dZPFjJ2R.js","assets/play-B4g8-XQV.js","assets/post-BvQOP339.js","assets/preload-helper-BaNbYf_w.js","assets/printPlay-BDqCUbcX.js","assets/react-Bu-9VsiK.js","assets/react-Cvdyeg_0.js","assets/react-dom-B-VxWsjA.js","assets/react-hsrUxga6.js","assets/relayBusy-DoHBJB33.js","assets/replayFile-nWN4E2xo.js","assets/report-DP-FHM6Z.js","assets/rift-lanterns-DLDKmR7R.js","assets/rolldown-runtime-hePW80VL.js","assets/roster-CVZButfQ.js","assets/rulebook-DYk1I3nk.js","assets/scheduler-C784v2VA.js","assets/secp256k1-yVjC_Axf.js","assets/shelfActions-DRqkX_MJ.js","assets/showcase-Dcyx4k9V.js","assets/site-CHb1xoFU.js","assets/sound-BYXSO4hD.js","assets/standIns-BHeYT5qd.js","assets/store-4vv-seiT.js","assets/store-BRSoJIzU.js","assets/store-C2MpAB39.js","assets/store-CzHrPc4w.js","assets/store-DtXO4j54.js","assets/syntax-CEL_Wvla.js","assets/systemLabels-BLEBzq-u.js","assets/systems-Bt-FrvbM.js","assets/systems-C99XBd1b.js","assets/systems-CxjgZ_RF.js","assets/talk-C_Q5gN87.js","assets/three.module-BnHMTVNq.js","assets/thumb-CW8-61n-.js","assets/trystero-BPhiUh8S.js","assets/trystero-CQejBhJ5.js","assets/trystero-Rj72XRLy.js","assets/webtorrent.min-DeIqevk6.js","assets/worker-BwZaDTPc.js","assets/worker-CrA9Yml1.js","assets/worker-CtrB5Iye.js","assets/worker-DV1DuzPc.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","icons/maskable-512.png","index.html","manifest.webmanifest"];
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
