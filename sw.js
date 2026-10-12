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
const VERSION = "279f40f145cc";
const FILES = ["assets/Board-DdWOaCim.js","assets/Branch-D5N76Oo7.js","assets/BufferGeometryUtils-gzGtEl-O.js","assets/CommandPanel-BgTHH-Gn.js","assets/CommandPanel-CXqub8sT.js","assets/CommandPanel-egg36QNh.js","assets/CoreAbilities-ZvcnAR7x.js","assets/Editor-Bz2O2AiP.js","assets/EventSeat-C235TqFM.js","assets/EventsUI-BZ5WJzwl.js","assets/FigureLibrary-BpsU3fxs.js","assets/Game-gHr7BjbK.js","assets/GameScreen-B2QJuTWF.js","assets/MailLobby-BhITxO9R.js","assets/Miniatures-Cw0yvt2K.js","assets/NextApp-Byo6aHZn.css","assets/NextApp-KtQSzV7x.js","assets/OpenTables-BsKY83_7.js","assets/Packages-BVD9dRcw.js","assets/PhotoMatch-rPWNovje.js","assets/PlayerCard-CLybWXSs.js","assets/Qd6Card-BQsCeWm8.js","assets/Qd6Card-CIMA4BoL.js","assets/Qd6Card-DoI9o1XY.js","assets/RankedGame-Bi5Vftdh.js","assets/RoundPanel-B1MLi3Lp.js","assets/RoundPanel-CXZI3x7I.js","assets/RoundPanel-TO02tQGl.js","assets/RulesPage-97MSo5sY.js","assets/StandeeMaker-DHBEYKkt.js","assets/TeachRule-BmfOyndS.js","assets/Workshop-QELtRrG8.js","assets/_virtual_sandbox-worker-D7LJ9lgH.js","assets/_virtual_soak-worker-BxdlIszh.js","assets/actions-CWR4eNO9.js","assets/aws4fetch.esm-BLUAl4pF.js","assets/base64-gMTPUZJI.js","assets/board-BK2oh2tX.js","assets/book-BFQBEwWU.js","assets/brinewatch-DN2-OwGh.js","assets/browser-UgmTalj_.js","assets/browser-bopAeLbn.js","assets/charge-C5lADlel.js","assets/codec-DOoWeNvh.js","assets/config-Kg6xkhHB.js","assets/core-TAh7tNY5.js","assets/de-Chd7Tl-0.js","assets/demo-PPBguUFP.js","assets/dist-WFp3Oeug.js","assets/dist-YYVtoirG.js","assets/dist-lgRNSFRF.js","assets/events-9ce18a08.esm-D-QCksbz.js","assets/faction-CMz1vtmb.js","assets/file-qvOJhGA3.js","assets/files-CdfAAl3C.js","assets/fr-BtCICrA1.js","assets/fxp-CNHNYw_7.js","assets/fxp-DcRaohTd.js","assets/gameLog-37WVDO2C.js","assets/hooks-Bl41txHu.js","assets/hooks-BmnL9pKE.js","assets/hooks-D5ooBzPZ.js","assets/http-DXBhDLDH.js","assets/idb-OWIpJU7O.js","assets/index-BePCAQOD.js","assets/index-Chj8U0ni.css","assets/jsx-runtime-NZYk81nU.js","assets/keys-D-MKR9PG.js","assets/layout-BJZ0_pUA.js","assets/lesson-C4Rd-Z5y.js","assets/levels-DlkUqTaf.js","assets/lit-n-Yt9ZNS.js","assets/live-Dy8ONdJx.js","assets/local-GsUdvVFa.js","assets/mailbox-CnjjhzeY.js","assets/manifest-BRIPGYy3.js","assets/meshShape-ZqSTYBc8.js","assets/nostr-JhobV8o-.js","assets/open-FhHfVsai.js","assets/open-Z0phF1iv.js","assets/pack-BIcmd4K7.js","assets/packPins-0OUxFznl.js","assets/packageChange-Be729-6H.js","assets/page-BW6Wfn1s.js","assets/play-Mt5t7rQ8.js","assets/post-DyHHGBkS.js","assets/preload-helper-BaNbYf_w.js","assets/printPlay-CSRPq7jj.js","assets/react-Bu-9VsiK.js","assets/react-Cvdyeg_0.js","assets/react-LRsbgCie.js","assets/react-dom-B-VxWsjA.js","assets/react-hsrUxga6.js","assets/relayBusy-DoHBJB33.js","assets/replayFile-DFfxNJG5.js","assets/report-CDLZrjW_.js","assets/rift-lanterns-DLDKmR7R.js","assets/rolldown-runtime-hePW80VL.js","assets/roster-CVZButfQ.js","assets/route-DEgYhqUZ.js","assets/rulebook-DYk1I3nk.js","assets/scheduler-C784v2VA.js","assets/secp256k1-yVjC_Axf.js","assets/shelfActions-wllDqA2d.js","assets/showcase-BVyZ9Omh.js","assets/site-CHb1xoFU.js","assets/standIns-BTEgtfF8.js","assets/start-D8BTgMRT.js","assets/store-1xwHJ7iL.js","assets/store-30SLft63.js","assets/store-B9tzGRnL.js","assets/store-Cc1MLJga.js","assets/store-D__TR36Q.js","assets/store-Dlb3_NQS.js","assets/syntax-CEL_Wvla.js","assets/systemLabels-C5pv3gzx.js","assets/systems-4PvdrXvq.js","assets/systems-CRMy2vz3.js","assets/systems-TBlyKINX.js","assets/talk-Cnhgg62H.js","assets/three.module-DD1TOtOx.js","assets/thumb-DFTN48Jo.js","assets/trystero-B7o7vSAK.js","assets/trystero-DUAGCRo6.js","assets/webtorrent.min-DeIqevk6.js","assets/worker-CsIWenQw.js","assets/worker-CtrB5Iye.js","assets/worker-DPC0th0f.js","assets/worker-DV1DuzPc.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","icons/maskable-512.png","index.html","manifest.webmanifest"];
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
