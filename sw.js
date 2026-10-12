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
const VERSION = "8ecdb84591a6";
const FILES = ["assets/Board-D_GI31Ry.js","assets/Branch-q-vteFf3.js","assets/BufferGeometryUtils-gzGtEl-O.js","assets/CommandPanel-4ZbeiNpi.js","assets/CommandPanel-BFV-5Ov6.js","assets/CommandPanel-Cnrd0ko4.js","assets/Editor-Chby8VH4.js","assets/EventSeat-BjfXE7EP.js","assets/EventsUI-BnmTkAtG.js","assets/FigureLibrary-BqNpwDoM.js","assets/Game-D1_dFasx.js","assets/GameScreen-CjEdjWce.js","assets/MailLobby-BM28yvg5.js","assets/Miniatures-BkRg_Ym-.js","assets/NextApp-CZfGknj9.css","assets/NextApp-DzP0LBT3.js","assets/OpenTables-DzP3q5BI.js","assets/PhotoMatch-DyzM3Orh.js","assets/PlayerCard-so0chFdo.js","assets/RankedGame-Cv2E8qmw.js","assets/RulesPage-DWXML01R.js","assets/StandeeMaker-B1WSToeo.js","assets/TeachRule-DOC2rb2G.js","assets/Workshop-q-JW8CWi.js","assets/_virtual_sandbox-worker-CQ-LclbH.js","assets/_virtual_soak-worker-CLVar1Nw.js","assets/actions-C_GrnYTA.js","assets/aws4fetch.esm-BLUAl4pF.js","assets/base64-gMTPUZJI.js","assets/board-BICqA6YE.js","assets/book-C6r8Z_UY.js","assets/brinewatch-DN2-OwGh.js","assets/browser-UgmTalj_.js","assets/browser-bopAeLbn.js","assets/codec-DOoWeNvh.js","assets/config-Kg6xkhHB.js","assets/core-VHaT24Ex.js","assets/de-CDMHa_kP.js","assets/demo-ChyS7Gkg.js","assets/dist-WFp3Oeug.js","assets/dist-YYVtoirG.js","assets/dist-lgRNSFRF.js","assets/events-9ce18a08.esm-D-QCksbz.js","assets/faction-CH6iLuhn.js","assets/file-qvOJhGA3.js","assets/files-CdfAAl3C.js","assets/flag-BdoWxvDG.js","assets/fr-BMS342N4.js","assets/fxp-CNHNYw_7.js","assets/fxp-DcRaohTd.js","assets/gameLog-BV4QW_K7.js","assets/help-Ch4Z4Mxg.js","assets/hooks-DtBBa_Gs.js","assets/http-DHj0Lb4c.js","assets/idb-OWIpJU7O.js","assets/index-QlcDj-HZ.css","assets/index-SOr8eI5Y.js","assets/jsx-runtime-NZYk81nU.js","assets/keys-D-MKR9PG.js","assets/layout-B1vcvBCh.js","assets/lesson-DE_zioBy.js","assets/levels-DlkUqTaf.js","assets/live-6t5MziDC.js","assets/local-Cv9cMUqL.js","assets/mailbox-B2yQGOKJ.js","assets/manifest-BRIPGYy3.js","assets/meshShape-SyA6ec-q.js","assets/nostr-daYLphzP.js","assets/open-B8f8OQlf.js","assets/open-Z0phF1iv.js","assets/pack-D7BsDVID.js","assets/packPins-BY6pLp-r.js","assets/packageChange-Be729-6H.js","assets/page-CJeCdkr1.js","assets/play-CLOmH-DQ.js","assets/post-Brje0y8R.js","assets/preload-helper-BaNbYf_w.js","assets/printPlay-DjaUJluc.js","assets/react-Bu-9VsiK.js","assets/react-Cvdyeg_0.js","assets/react-dom-B-VxWsjA.js","assets/react-hsrUxga6.js","assets/relayBusy-DoHBJB33.js","assets/replayFile-CJDNkyh-.js","assets/report-Bu3rJR5P.js","assets/rift-lanterns-DLDKmR7R.js","assets/riftLanterns-BOBM2JmA.js","assets/rolldown-runtime-hePW80VL.js","assets/roster-CVZButfQ.js","assets/route-oJGqvKqa.js","assets/rulebook-DYk1I3nk.js","assets/scheduler-C784v2VA.js","assets/secp256k1-yVjC_Axf.js","assets/shelfActions-g9HF537P.js","assets/showcase-BVyZ9Omh.js","assets/site-CHb1xoFU.js","assets/standIns-BTEgtfF8.js","assets/store-BQKTibM2.js","assets/store-C6ICEpin.js","assets/store-DJcNE6wq.js","assets/store-Df8Znz9N.js","assets/store-bfE130tu.js","assets/store-xqeR9T1u.js","assets/syntax-CEL_Wvla.js","assets/systemLabels-hoGW-EM2.js","assets/systems-6JmYyW_4.js","assets/systems-yMvMyyeC.js","assets/systems-yvv2UrOI.js","assets/talk-k0ZLHa20.js","assets/three.module-DD1TOtOx.js","assets/thumb-BapceUUd.js","assets/trystero--F5v8SLY.js","assets/trystero-BjQR-XCh.js","assets/trystero-CQejBhJ5.js","assets/webtorrent.min-DeIqevk6.js","assets/worker-BTX3mTyS.js","assets/worker-C5kW5YAj.js","assets/worker-CtrB5Iye.js","assets/worker-DV1DuzPc.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","icons/maskable-512.png","index.html","manifest.webmanifest"];
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
