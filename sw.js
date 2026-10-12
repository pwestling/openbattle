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
const VERSION = "30b578548946";
const FILES = ["assets/Board-DQEPg_js.js","assets/Branch-Bc1jOuDN.js","assets/BufferGeometryUtils-gzGtEl-O.js","assets/CommandPanel-C5RCNXX7.js","assets/CommandPanel-PoR2NarN.js","assets/CommandPanel-wPE0JPyT.js","assets/CoreAbilities-cNyaimRk.js","assets/Editor-vY_wwjor.js","assets/EventSeat-gvWwkGZ6.js","assets/EventsUI-T4NUllWO.js","assets/FigureLibrary-DL1LjOfz.js","assets/Game-CzNJkXao.js","assets/GameScreen-CaQJBBvt.js","assets/MailLobby-04Mc20ih.js","assets/Miniatures-JhBaqBvQ.js","assets/NextApp-C6C3HxyA.css","assets/NextApp-CHT9sOeK.js","assets/OpenTables-DyLUtsTZ.js","assets/Packages-Bwqe2Z9i.js","assets/PhotoMatch-4D6HACcD.js","assets/PlayerCard-CC39THgr.js","assets/Qd6Card-52LOFN_8.js","assets/Qd6Card-CdpG3Ate.js","assets/Qd6Card-fd7xIRvH.js","assets/RankedGame-4ZP9sFJX.js","assets/RoundPanel-Bc8Is7Hp.js","assets/RoundPanel-CWXCvPm3.js","assets/RoundPanel-__93BMW7.js","assets/RulesPage-97MSo5sY.js","assets/StandeeMaker-XnhZp875.js","assets/TeachRule-B5DDAwNX.js","assets/Workshop-e6mEGc9J.js","assets/_virtual_sandbox-worker-D7LJ9lgH.js","assets/_virtual_soak-worker-D1tD6NzA.js","assets/actions-DuBjPPVB.js","assets/aws4fetch.esm-BLUAl4pF.js","assets/base64-gMTPUZJI.js","assets/board-BXjla7K8.js","assets/book-BFQBEwWU.js","assets/brinewatch-DN2-OwGh.js","assets/browser-UgmTalj_.js","assets/browser-bopAeLbn.js","assets/charge-C5lADlel.js","assets/codec-DOoWeNvh.js","assets/config-Kg6xkhHB.js","assets/core-TAh7tNY5.js","assets/de-Chd7Tl-0.js","assets/demo-teNrL9Os.js","assets/dist-WFp3Oeug.js","assets/dist-YYVtoirG.js","assets/dist-lgRNSFRF.js","assets/events-9ce18a08.esm-D-QCksbz.js","assets/faction-DX31N-B_.js","assets/file-qvOJhGA3.js","assets/files-CdfAAl3C.js","assets/fr-BtCICrA1.js","assets/fxp-CNHNYw_7.js","assets/fxp-DcRaohTd.js","assets/gameLog-DyyxLa98.js","assets/hooks-BOx0jQm4.js","assets/hooks-DkdsfTse.js","assets/hooks-jKHhjDqM.js","assets/http-DXBhDLDH.js","assets/idb-OWIpJU7O.js","assets/index-Chj8U0ni.css","assets/index-nbpSGaQK.js","assets/jsx-runtime-NZYk81nU.js","assets/keys-D-MKR9PG.js","assets/layout-BJZ0_pUA.js","assets/lesson-C74UOffG.js","assets/levels-DlkUqTaf.js","assets/lit-n-Yt9ZNS.js","assets/live-BD1Kf3m8.js","assets/local-GsUdvVFa.js","assets/mailbox-CnjjhzeY.js","assets/manifest-BRIPGYy3.js","assets/meshShape-CM0dmjIo.js","assets/nostr-JhobV8o-.js","assets/open-BRdrLtFO.js","assets/open-Z0phF1iv.js","assets/pack-DsrwjM9E.js","assets/packPins-BlhnRpTz.js","assets/packageChange-Be729-6H.js","assets/page-BAn4Iq3N.js","assets/play-CuqHBvAs.js","assets/post-DyHHGBkS.js","assets/preload-helper-BaNbYf_w.js","assets/printPlay-CSRPq7jj.js","assets/react-Bu-9VsiK.js","assets/react-Cvdyeg_0.js","assets/react-LRsbgCie.js","assets/react-dom-B-VxWsjA.js","assets/react-hsrUxga6.js","assets/relayBusy-DoHBJB33.js","assets/replayFile-Ch7NYaa-.js","assets/report-DJTBjD9d.js","assets/rift-lanterns-DLDKmR7R.js","assets/rolldown-runtime-hePW80VL.js","assets/roster-CVZButfQ.js","assets/route-h2PEW5sR.js","assets/rulebook-DYk1I3nk.js","assets/scheduler-C784v2VA.js","assets/secp256k1-yVjC_Axf.js","assets/shelfActions-DG5eZKZG.js","assets/showcase-BVyZ9Omh.js","assets/site-CHb1xoFU.js","assets/standIns-BTEgtfF8.js","assets/start-qYBinU4s.js","assets/store-C6s-xl_h.js","assets/store-Cc1MLJga.js","assets/store-CxCjCDmK.js","assets/store-DybpD1mT.js","assets/store-WxJQv0qS.js","assets/store-rofak1a7.js","assets/syntax-CEL_Wvla.js","assets/systemLabels-C5pv3gzx.js","assets/systems-Bhi3tGNd.js","assets/systems-ClGdaxfQ.js","assets/systems-E2w2DaKP.js","assets/talk-CpY0II_3.js","assets/three.module-DD1TOtOx.js","assets/thumb-yMlvhDbd.js","assets/trystero-B7o7vSAK.js","assets/trystero-DUAGCRo6.js","assets/webtorrent.min-DeIqevk6.js","assets/worker-BK3y5BdC.js","assets/worker-C_56-9Xm.js","assets/worker-CtrB5Iye.js","assets/worker-DV1DuzPc.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","icons/maskable-512.png","index.html","manifest.webmanifest"];
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
