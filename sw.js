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
const VERSION = "6a9aeee147e5";
const FILES = ["assets/Board-DK44A-sJ.js","assets/Branch-lzqlrPHp.js","assets/BufferGeometryUtils-gzGtEl-O.js","assets/CommandPanel-BCQ94GrG.js","assets/CommandPanel-COfFNvHd.js","assets/CommandPanel-CQYAoE2G.js","assets/CoreAbilities-YGHtXXYf.js","assets/Editor-YGwJBEjk.js","assets/EventSeat-B-kDBddY.js","assets/EventsUI-QpTbSmlm.js","assets/FigureLibrary-DwzIs1GT.js","assets/Game-B3nPQZbX.js","assets/GameScreen-C5sw0ddH.js","assets/MailLobby-Bm1PxfY-.js","assets/Miniatures-mh9M1s0u.js","assets/NextApp-D-RCo_jH.js","assets/NextApp-DPZ13xtn.css","assets/OpenTables-B8O98l5O.js","assets/Packages-DFDPeSRZ.js","assets/PhotoMatch-BTuYAMo6.js","assets/PlayerCard-B0jwPPEN.js","assets/Qd6Card-D4-EyOjd.js","assets/Qd6Card-IVrrnoXi.js","assets/Qd6Card-XOCk2pHU.js","assets/RankedGame-BtLXD5eN.js","assets/RoundPanel-CKc2dtge.js","assets/RoundPanel-CPp1pFOj.js","assets/RoundPanel-CkafMDqO.js","assets/RulesPage-DE_bo-6v.js","assets/StandeeMaker-CSub-1G3.js","assets/TeachRule-DBbLVfW_.js","assets/Workshop-BVTDPab-.js","assets/_virtual_sandbox-worker-CQyczKOb.js","assets/_virtual_soak-worker-Z5RxwagQ.js","assets/actions-9x-offy-.js","assets/aws4fetch.esm-BLUAl4pF.js","assets/base64-gMTPUZJI.js","assets/board-smpJLNOD.js","assets/book-CmS1uFGu.js","assets/brinewatch-DN2-OwGh.js","assets/browser-UgmTalj_.js","assets/browser-bopAeLbn.js","assets/charge-CzDcZRod.js","assets/codec-DOoWeNvh.js","assets/config-Kg6xkhHB.js","assets/core-WuuK-D22.js","assets/de-MUnUCfSn.js","assets/demo-BN8XJu5F.js","assets/dist-WFp3Oeug.js","assets/dist-YYVtoirG.js","assets/dist-lgRNSFRF.js","assets/events-9ce18a08.esm-D-QCksbz.js","assets/faction-m5vb0Lyp.js","assets/file-qvOJhGA3.js","assets/files-CdfAAl3C.js","assets/fr-Bx74U8B5.js","assets/fxp-CNHNYw_7.js","assets/fxp-DcRaohTd.js","assets/gameLog-BTMpqcca.js","assets/hooks--AzS_Kk2.js","assets/hooks-ByPSo7J8.js","assets/hooks-DXj7Lb4m.js","assets/http-CpVzz9r4.js","assets/idb-OWIpJU7O.js","assets/index-Chj8U0ni.css","assets/index-DELMe3zs.js","assets/jsx-runtime-NZYk81nU.js","assets/keys-D-MKR9PG.js","assets/layout-CLnbA7ze.js","assets/lesson-DS61Ofxv.js","assets/levels-DlkUqTaf.js","assets/lit-n-Yt9ZNS.js","assets/live-kiIUyif2.js","assets/local-BAvt5eBj.js","assets/mailbox-BleIqrzz.js","assets/manifest-BRIPGYy3.js","assets/meshShape-DS42sCz-.js","assets/nostr-Ez9YF5-7.js","assets/open-Ce20t_PR.js","assets/open-Z0phF1iv.js","assets/pack-HWQJWBkt.js","assets/packPins-D-s7eRxM.js","assets/packageChange-Be729-6H.js","assets/page-s1XfH0B-.js","assets/play-Dbgu3cmj.js","assets/post-DZTCqcHW.js","assets/preload-helper-BaNbYf_w.js","assets/printPlay-DSAsQnsC.js","assets/react-Bu-9VsiK.js","assets/react-Cvdyeg_0.js","assets/react-LRsbgCie.js","assets/react-dom-B-VxWsjA.js","assets/react-hsrUxga6.js","assets/relayBusy-DoHBJB33.js","assets/replayFile-g-ujrNel.js","assets/report-BQsmycT2.js","assets/rift-lanterns-DLDKmR7R.js","assets/rolldown-runtime-hePW80VL.js","assets/roster-CVZButfQ.js","assets/route-eUWmYz8p.js","assets/rulebook-DYk1I3nk.js","assets/scheduler-C784v2VA.js","assets/secp256k1-yVjC_Axf.js","assets/shelfActions-CD1vRRyr.js","assets/showcase-BVyZ9Omh.js","assets/site-CHb1xoFU.js","assets/standIns-BTEgtfF8.js","assets/start-DNOH12IU.js","assets/store-88nV7qTN.js","assets/store-B1BPUMRY.js","assets/store-BK1MCkc6.js","assets/store-BebfufTM.js","assets/store-D9MG2_Ls.js","assets/store-DEYySbMd.js","assets/syntax-CEL_Wvla.js","assets/systemLabels-Cm2MtFoT.js","assets/systems-BekJ5RAw.js","assets/systems-CiWUAL8q.js","assets/systems-De6DRhdb.js","assets/talk-BAiOTfPO.js","assets/three.module-DD1TOtOx.js","assets/thumb-DKr31j1d.js","assets/trystero-CQejBhJ5.js","assets/trystero-LIsX6Feh.js","assets/webtorrent.min-DeIqevk6.js","assets/worker-Bw5H2_MA.js","assets/worker-CtrB5Iye.js","assets/worker-DV1DuzPc.js","assets/worker-XBfvm46j.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","icons/maskable-512.png","index.html","manifest.webmanifest"];
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
