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
const VERSION = "7b108ae14267";
const FILES = ["assets/Board-CHnROxEA.js","assets/BufferGeometryUtils-gzGtEl-O.js","assets/CommandPanel-DHH1xZf1.js","assets/CommandPanel-DiFSWF_w.js","assets/CommandPanel-i0CKCuy6.js","assets/Editor-ZA7Sm09L.js","assets/EventSeat-CXil62a4.js","assets/EventsUI-BbkQpMnn.js","assets/FigureLibrary-Bjce-IL3.js","assets/GameScreen-9cdCdPrB.js","assets/MailLobby-Bvbtprdo.js","assets/Miniatures-BYMFH-ML.js","assets/OpenTables-BdqU7ysE.js","assets/PhotoMatch-e0QLVYR1.js","assets/PlayerCard-CDvmivQZ.js","assets/RankedGame-BHMXleuQ.js","assets/RulesPage-wXudNsXp.js","assets/StandeeMaker-B1JIYEpk.js","assets/TeachRule-Dk4aoGj0.js","assets/Workshop-BU_awdIN.js","assets/_virtual_sandbox-worker-BeBMaQy2.js","assets/_virtual_soak-worker-Dr7OHzyO.js","assets/actions-BH7hdQk0.js","assets/aws4fetch.esm-BLUAl4pF.js","assets/base64-gMTPUZJI.js","assets/book-Clq3dw5R.js","assets/brinewatch-DN2-OwGh.js","assets/browser-UgmTalj_.js","assets/browser-bopAeLbn.js","assets/codec-DOoWeNvh.js","assets/config-Kg6xkhHB.js","assets/core-_RbZoQjL.js","assets/de-Bliir7a9.js","assets/dist-WFp3Oeug.js","assets/dist-YYVtoirG.js","assets/dist-lgRNSFRF.js","assets/file-qvOJhGA3.js","assets/files-CdfAAl3C.js","assets/fr-BMwRfX5v.js","assets/fxp-CNHNYw_7.js","assets/fxp-DcRaohTd.js","assets/gameLog-CtE1YccO.js","assets/help-g_42IipZ.js","assets/http-ODDP3l11.js","assets/idb-OWIpJU7O.js","assets/index-BNwf29Nd.css","assets/index-BoQEf1Md.js","assets/jsx-runtime-NZYk81nU.js","assets/keys-D-MKR9PG.js","assets/layout-C_GPV6iD.js","assets/lesson-jtTaLU8Q.js","assets/levels-DlkUqTaf.js","assets/local-TO5VgOoq.js","assets/mailbox-MA5Q5WEB.js","assets/manifest-BRIPGYy3.js","assets/meshShape-D9NJsBzI.js","assets/nostr-xenwGttx.js","assets/open-Z0phF1iv.js","assets/pack-2hfHNRLP.js","assets/packageChange-Be729-6H.js","assets/page-DxU5LqiI.js","assets/play-up0ZkHsB.js","assets/post-aJO5JhOB.js","assets/preload-helper-BaNbYf_w.js","assets/printPlay-W4AFFpb7.js","assets/react-Bu-9VsiK.js","assets/react-Cvdyeg_0.js","assets/react-dom-B-VxWsjA.js","assets/react-hsrUxga6.js","assets/relayBusy-DoHBJB33.js","assets/replayFile-D9UG92O3.js","assets/report-Bp1_wgob.js","assets/rift-lanterns-DLDKmR7R.js","assets/rolldown-runtime-hePW80VL.js","assets/roster-CVZButfQ.js","assets/route-BWPe4Nbb.js","assets/rulebook-DYk1I3nk.js","assets/scheduler-C784v2VA.js","assets/secp256k1-yVjC_Axf.js","assets/shelfActions-F87fXK8s.js","assets/showcase-BVyZ9Omh.js","assets/site-CHb1xoFU.js","assets/standIns-BTEgtfF8.js","assets/store-7T3wMHon.js","assets/store-CENurhWO.js","assets/store-CHHwrwSb.js","assets/store-YotDuYmX.js","assets/store-gpHgzhLy.js","assets/syntax-CEL_Wvla.js","assets/systemLabels-Ccu8BQar.js","assets/systems-B-XANJgH.js","assets/systems-CQikxMWs.js","assets/systems-Ce_ewKh9.js","assets/talk-Bt-uki-r.js","assets/three.module-DD1TOtOx.js","assets/thumb-BNQA2KRx.js","assets/trystero-BV7oqZwl.js","assets/trystero-CQejBhJ5.js","assets/trystero-oYdmtPF6.js","assets/webtorrent.min-DeIqevk6.js","assets/worker-BQvbbkGM.js","assets/worker-CtrB5Iye.js","assets/worker-DV1DuzPc.js","assets/worker-ncQUYJlc.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","icons/maskable-512.png","index.html","manifest.webmanifest"];
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
