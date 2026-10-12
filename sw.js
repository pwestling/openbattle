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
const VERSION = "1b2e2db913bb";
const FILES = ["assets/Board-RoMPHjmD.js","assets/Branch-BFpry2Hc.js","assets/BufferGeometryUtils-gzGtEl-O.js","assets/CommandPanel-BdJtToVB.js","assets/CommandPanel-Bf_-iFp9.js","assets/CommandPanel-DePQT3kB.js","assets/CoreAbilities-B6mMTDfj.js","assets/Editor-B1G0KQBQ.js","assets/EventSeat-BveqEYUs.js","assets/EventsUI-gyWCbeS7.js","assets/FigureLibrary-ec2RFpxd.js","assets/Game-toSijFlJ.js","assets/GameScreen-Cv7ax81H.js","assets/MailLobby-DHCnBwxB.js","assets/Miniatures-DTXZA1Dl.js","assets/NextApp-CLX-Ctjo.js","assets/NextApp-DPZ13xtn.css","assets/OpenTables-Ddlt9vDY.js","assets/Packages-C8JJx3qU.js","assets/PhotoMatch-Clw8CBS4.js","assets/PlayerCard-Bwd57OqL.js","assets/Qd6Card-C4ukgK_i.js","assets/Qd6Card-CO6t8FWE.js","assets/Qd6Card-DbMcQGfu.js","assets/RankedGame-CYHTTpu4.js","assets/RoundPanel-CYTzm7e3.js","assets/RoundPanel-CgZ4st_u.js","assets/RoundPanel-DwBPNl_b.js","assets/RulesPage-DE_bo-6v.js","assets/StandeeMaker-1fVYNurH.js","assets/TeachRule-Bl8D9j-0.js","assets/Workshop-BjfiwGG_.js","assets/_virtual_sandbox-worker-CQyczKOb.js","assets/_virtual_soak-worker-Cn6IcrC2.js","assets/actions-ClJ2Fb02.js","assets/aws4fetch.esm-BLUAl4pF.js","assets/base64-gMTPUZJI.js","assets/board-DHcPvEZb.js","assets/book-CmS1uFGu.js","assets/brinewatch-DN2-OwGh.js","assets/browser-UgmTalj_.js","assets/browser-bopAeLbn.js","assets/charge-CzDcZRod.js","assets/codec-DOoWeNvh.js","assets/config-Kg6xkhHB.js","assets/core-WuuK-D22.js","assets/de-MUnUCfSn.js","assets/demo-CDzkBRru.js","assets/dist-WFp3Oeug.js","assets/dist-YYVtoirG.js","assets/dist-lgRNSFRF.js","assets/events-9ce18a08.esm-D-QCksbz.js","assets/faction-DRxgnvGj.js","assets/file-qvOJhGA3.js","assets/files-CdfAAl3C.js","assets/fr-Bx74U8B5.js","assets/fxp-CNHNYw_7.js","assets/fxp-DcRaohTd.js","assets/gameLog-Db3aD9AH.js","assets/hooks-B3l7iILZ.js","assets/hooks-CoFPDCno.js","assets/hooks-DmAWjdnw.js","assets/http-CpVzz9r4.js","assets/idb-OWIpJU7O.js","assets/index-C0kFnwDZ.js","assets/index-Chj8U0ni.css","assets/jsx-runtime-NZYk81nU.js","assets/keys-D-MKR9PG.js","assets/layout-CLnbA7ze.js","assets/lesson-DLOUT8NJ.js","assets/levels-DlkUqTaf.js","assets/lit-n-Yt9ZNS.js","assets/live-Byndf3Hw.js","assets/local-BAvt5eBj.js","assets/mailbox-BleIqrzz.js","assets/manifest-BRIPGYy3.js","assets/meshShape-CEE7iRHX.js","assets/nostr-Ez9YF5-7.js","assets/open-BmD8m_6G.js","assets/open-Z0phF1iv.js","assets/pack-CnNNkPdo.js","assets/packPins-Dtu2tIBX.js","assets/packageChange-Be729-6H.js","assets/page-BBYxhI_U.js","assets/play-DHsYqGMQ.js","assets/post-DZTCqcHW.js","assets/preload-helper-BaNbYf_w.js","assets/printPlay-DSAsQnsC.js","assets/react-Bu-9VsiK.js","assets/react-Cvdyeg_0.js","assets/react-LRsbgCie.js","assets/react-dom-B-VxWsjA.js","assets/react-hsrUxga6.js","assets/relayBusy-DoHBJB33.js","assets/replayFile-BVrVJNih.js","assets/report-BYpHAQnL.js","assets/rift-lanterns-DLDKmR7R.js","assets/rolldown-runtime-hePW80VL.js","assets/roster-CVZButfQ.js","assets/route-BTUck7qD.js","assets/rulebook-DYk1I3nk.js","assets/scheduler-C784v2VA.js","assets/secp256k1-yVjC_Axf.js","assets/shelfActions-CziIzMyy.js","assets/showcase-BVyZ9Omh.js","assets/site-CHb1xoFU.js","assets/standIns-BTEgtfF8.js","assets/start-hxqrBys7.js","assets/store-BJF68AKJ.js","assets/store-BZqPFL1_.js","assets/store-BebfufTM.js","assets/store-Bl-V-_k2.js","assets/store-CEUDl1kI.js","assets/store-gKoPPXb8.js","assets/syntax-CEL_Wvla.js","assets/systemLabels-Cm2MtFoT.js","assets/systems-C37ON4en.js","assets/systems-D02mRJVf.js","assets/systems-DtPAgxVd.js","assets/talk-CPyrPw8-.js","assets/three.module-DD1TOtOx.js","assets/thumb-B-UxXxrt.js","assets/trystero-CQejBhJ5.js","assets/trystero-LIsX6Feh.js","assets/webtorrent.min-DeIqevk6.js","assets/worker-BgoXWRio.js","assets/worker-C7xr1RVs.js","assets/worker-CtrB5Iye.js","assets/worker-DV1DuzPc.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","icons/maskable-512.png","index.html","manifest.webmanifest"];
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
