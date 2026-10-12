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
const VERSION = "93a6c740b3ec";
const FILES = ["assets/Board-BcVZFQGA.js","assets/Branch-6RT0QVfz.js","assets/BufferGeometryUtils-gzGtEl-O.js","assets/CommandPanel-1cb8016R.js","assets/CommandPanel-DOR6AqcV.js","assets/CommandPanel-sq7JycEe.js","assets/CoreAbilities-DqDj2gjh.js","assets/Editor-CKqyfjFj.js","assets/EventSeat-UVybtjd4.js","assets/EventsUI-DNuKZl3V.js","assets/FigureLibrary-CnV7IVBP.js","assets/Game-DPgc5hnX.js","assets/GameScreen-CuR7eJ7e.js","assets/MailLobby-BDvCTEK5.js","assets/Miniatures-CFPHZQVe.js","assets/NextApp-CxmrrIuK.js","assets/NextApp-DTjdDICv.css","assets/OpenTables-DkXvbm2E.js","assets/Packages-BJGiHPnf.js","assets/PhotoMatch-Da5lJS6X.js","assets/PlayerCard-CUE2Yt4X.js","assets/Qd6Card-Bllkptmv.js","assets/Qd6Card-BrrwXAfV.js","assets/Qd6Card-DBv5p9_R.js","assets/RankedGame-B2w6VjhX.js","assets/RoundPanel-CjefeIMp.js","assets/RoundPanel-ClAapIp8.js","assets/RoundPanel-DTnPiFOe.js","assets/RulesPage-Dl238-Nj.js","assets/StandeeMaker-C7lZ27aO.js","assets/TeachRule-98hqdHZT.js","assets/Workshop-Br1saaIM.js","assets/_virtual_sandbox-worker-ry7Mxznx.js","assets/_virtual_soak-worker-B-K4zg3B.js","assets/actions-B7JzbE3_.js","assets/aws4fetch.esm-BLUAl4pF.js","assets/base64-gMTPUZJI.js","assets/board-DelrVyrq.js","assets/book-VMrX3oPM.js","assets/brinewatch-DN2-OwGh.js","assets/browser-UgmTalj_.js","assets/browser-bopAeLbn.js","assets/charge-CmNIEVvE.js","assets/codec-DOoWeNvh.js","assets/config-Kg6xkhHB.js","assets/core-15rGiSlP.js","assets/de-CbcYVFrb.js","assets/demo-XidU4brh.js","assets/dist-WFp3Oeug.js","assets/dist-YYVtoirG.js","assets/dist-lgRNSFRF.js","assets/events-9ce18a08.esm-D-QCksbz.js","assets/faction-Ldhd52yc.js","assets/file-qvOJhGA3.js","assets/files-CdfAAl3C.js","assets/fr-zFyu-m6L.js","assets/fxp-CNHNYw_7.js","assets/fxp-DcRaohTd.js","assets/gameLog-DK1CdsN7.js","assets/hooks-2DuG-Eqz.js","assets/hooks-BUeuhAHg.js","assets/hooks-TZSrpXjE.js","assets/http-BmObfAb1.js","assets/idb-OWIpJU7O.js","assets/index-CYsZyj_k.js","assets/index-Chj8U0ni.css","assets/jsx-runtime-NZYk81nU.js","assets/keys-D-MKR9PG.js","assets/layout-V7VSuSTu.js","assets/lesson-CqYJlMbo.js","assets/levels-DlkUqTaf.js","assets/lit-n-Yt9ZNS.js","assets/live-DnsE5A_a.js","assets/local-s0suICIx.js","assets/mailbox-NrerAT2E.js","assets/manifest-BRIPGYy3.js","assets/meshShape-DHos_uaS.js","assets/nostr-6u-D2_i1.js","assets/open-WdlakbLC.js","assets/open-Z0phF1iv.js","assets/pack-nRIY7dwK.js","assets/packPins-ipsiy409.js","assets/packageChange-Be729-6H.js","assets/page-DUKF7v8i.js","assets/play-Ds2g0gIa.js","assets/post-B02HxW35.js","assets/preload-helper-BaNbYf_w.js","assets/printPlay-C4sgv0R8.js","assets/react-Bu-9VsiK.js","assets/react-Cvdyeg_0.js","assets/react-LRsbgCie.js","assets/react-dom-B-VxWsjA.js","assets/react-hsrUxga6.js","assets/relayBusy-DoHBJB33.js","assets/replayFile-DNqcLvVN.js","assets/report-DedD1IX9.js","assets/rift-lanterns-DLDKmR7R.js","assets/rolldown-runtime-hePW80VL.js","assets/roster-CVZButfQ.js","assets/route-CMBOSJrf.js","assets/rulebook-DYk1I3nk.js","assets/scheduler-C784v2VA.js","assets/secp256k1-yVjC_Axf.js","assets/shelfActions-CNSig14U.js","assets/showcase-BVyZ9Omh.js","assets/site-CHb1xoFU.js","assets/standIns-BTEgtfF8.js","assets/start-C_WOXdj-.js","assets/store-BFy_iKDi.js","assets/store-CnY4Ix8f.js","assets/store-DGLPXsHq.js","assets/store-DbslsF8c.js","assets/store-Q1hQX51F.js","assets/store-xG-CykmB.js","assets/syntax-CEL_Wvla.js","assets/systemLabels-B6-eGN8o.js","assets/systems-BiacTqvJ.js","assets/systems-DDbaj18w.js","assets/systems-DLYZzF4x.js","assets/talk-fedTKoMj.js","assets/three.module-DD1TOtOx.js","assets/thumb-B-kVs0Xl.js","assets/trystero-CQejBhJ5.js","assets/trystero-LIsX6Feh.js","assets/webtorrent.min-DeIqevk6.js","assets/worker-B1kX8PTe.js","assets/worker-B2x_ZnZl.js","assets/worker-CtrB5Iye.js","assets/worker-DV1DuzPc.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","icons/maskable-512.png","index.html","manifest.webmanifest"];
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
