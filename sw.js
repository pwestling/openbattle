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
const VERSION = "eaf8e0317648";
const FILES = ["assets/Board-DQmjOKwV.js","assets/BufferGeometryUtils-Bg58SzpS.js","assets/CommandPanel-CeqJAV-Z.js","assets/CommandPanel-Db4hcb9J.js","assets/CommandPanel-ixL3eZ0c.js","assets/Editor-CV4i7-dg.js","assets/EventSeat-CdK-Qci3.js","assets/EventsUI-BYXohFgp.js","assets/FigureLibrary-D5fTWTXq.js","assets/GameScreen-C7Hikivv.js","assets/MailLobby-CnxHqW6m.js","assets/Miniatures-DyM8UhhD.js","assets/OpenTables-M3E1UYIc.js","assets/PhotoMatch-igwZrIPy.js","assets/PlayerCard-fQlW_Mfa.js","assets/RankedGame-Cr5Jvgg8.js","assets/RulesPage-DSrl8Xzq.js","assets/StandeeMaker-11rStua-.js","assets/TeachRule-CO4uD5Ho.js","assets/Workshop-DKYz1KpZ.js","assets/_virtual_sandbox-worker-Cr07ZzyT.js","assets/_virtual_soak-worker-Pb_jgC6d.js","assets/actions-DchW9jLJ.js","assets/aws4fetch.esm-BLUAl4pF.js","assets/base64-gMTPUZJI.js","assets/book-Bl9HGaMT.js","assets/brinewatch-DN2-OwGh.js","assets/browser-UgmTalj_.js","assets/browser-bopAeLbn.js","assets/codec-DOoWeNvh.js","assets/config-Kg6xkhHB.js","assets/core-BTPqFEWT.js","assets/de-LUPWLMZ7.js","assets/dist-WFp3Oeug.js","assets/dist-YYVtoirG.js","assets/dist-lgRNSFRF.js","assets/file-qvOJhGA3.js","assets/files-CdfAAl3C.js","assets/fr-CRAso3MP.js","assets/fxp-CNHNYw_7.js","assets/fxp-DcRaohTd.js","assets/gameLog-YCyAJhtz.js","assets/help-CyqeNgNl.js","assets/http-CRma7qjg.js","assets/idb-OWIpJU7O.js","assets/index-BebH6uh4.css","assets/index-DL6nuT38.js","assets/jsx-runtime-NZYk81nU.js","assets/keys-D-MKR9PG.js","assets/layout-CPL-IDB4.js","assets/lesson-D_EjaHrn.js","assets/levels-DlkUqTaf.js","assets/local-By3grld9.js","assets/mailbox-2lEQBXc3.js","assets/manifest-BRIPGYy3.js","assets/meshShape-DLnuWPxb.js","assets/nostr-HCvy0oPS.js","assets/open-Z0phF1iv.js","assets/pack-C_vSt2Zc.js","assets/packageChange-Be729-6H.js","assets/page-CGHnGcwR.js","assets/play-DlxM3DZY.js","assets/post-E-8sNOns.js","assets/preload-helper-BaNbYf_w.js","assets/printPlay-BTmfw4R2.js","assets/react-Bu-9VsiK.js","assets/react-Cvdyeg_0.js","assets/react-dom-B-VxWsjA.js","assets/react-hsrUxga6.js","assets/relayBusy-DoHBJB33.js","assets/replayFile-FlMJAo82.js","assets/report-CtsoyLmW.js","assets/rift-lanterns-DLDKmR7R.js","assets/rolldown-runtime-hePW80VL.js","assets/roster-CVZButfQ.js","assets/route-Bktf6vlk.js","assets/rulebook-DYk1I3nk.js","assets/scheduler-C784v2VA.js","assets/secp256k1-yVjC_Axf.js","assets/shelfActions-KjuT9AGQ.js","assets/showcase-Dcyx4k9V.js","assets/site-CHb1xoFU.js","assets/sound-BYXSO4hD.js","assets/standIns-BHeYT5qd.js","assets/store-CfzjiuVb.js","assets/store-DgMBdT9Y.js","assets/store-DuhCM0AQ.js","assets/store-QVbF7xXS.js","assets/store-oausLpHf.js","assets/syntax-CEL_Wvla.js","assets/systemLabels-CRxgalaP.js","assets/systems-BEy8lwZr.js","assets/systems-BgJUoqqd.js","assets/systems-yj-_wnPI.js","assets/talk-BFUHjkyl.js","assets/three.module-BnHMTVNq.js","assets/thumb-CW5aYUX_.js","assets/trystero-CA71wjSg.js","assets/trystero-CQejBhJ5.js","assets/trystero-iXLzYYe0.js","assets/webtorrent.min-DeIqevk6.js","assets/worker-CtrB5Iye.js","assets/worker-DL7wxhkr.js","assets/worker-DV1DuzPc.js","assets/worker-f6_mvtIJ.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","icons/maskable-512.png","index.html","manifest.webmanifest"];
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
