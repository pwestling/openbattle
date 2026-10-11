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
const VERSION = "6da56430d82a";
const FILES = ["assets/Board-Bc8I71PR.js","assets/Branch-ByARXvLV.js","assets/BufferGeometryUtils-gzGtEl-O.js","assets/CommandPanel-022OdF-5.js","assets/CommandPanel-DyndYfHr.js","assets/CommandPanel-hgC_U91s.js","assets/Editor-eNc3judt.js","assets/EventSeat-LpBK2y-r.js","assets/EventsUI-bvqOfsGl.js","assets/FigureLibrary-DlgH1rYz.js","assets/Game-CSnpFmcB.js","assets/GameScreen-FIj51Ifk.js","assets/MailLobby-BjQZdvA-.js","assets/Miniatures-8qgJmnXW.js","assets/NextApp-D7yV_gie.js","assets/NextApp-fNk1vH5D.css","assets/OpenTables-DevG71lF.js","assets/PhotoMatch-oq72Vgdn.js","assets/PlayerCard-Bda-Woyv.js","assets/RankedGame-ql37bfJV.js","assets/RulesPage-BgPoKkyZ.js","assets/StandeeMaker-DCa0jJGG.js","assets/TeachRule-CLwOrORf.js","assets/Workshop-O1q4WCps.js","assets/_virtual_sandbox-worker-UEAHsTPi.js","assets/_virtual_soak-worker-Bm0NwIVl.js","assets/actions-Cqmtopq4.js","assets/aws4fetch.esm-BLUAl4pF.js","assets/base64-gMTPUZJI.js","assets/board-CiassYR9.js","assets/book-DxB_QuzM.js","assets/brinewatch-DN2-OwGh.js","assets/browser-UgmTalj_.js","assets/browser-bopAeLbn.js","assets/codec-DOoWeNvh.js","assets/config-Kg6xkhHB.js","assets/core-DUu43Way.js","assets/de-Nf2vdeAl.js","assets/demo-DAiwoX2R.js","assets/dist-WFp3Oeug.js","assets/dist-YYVtoirG.js","assets/dist-lgRNSFRF.js","assets/events-9ce18a08.esm-D-QCksbz.js","assets/file-qvOJhGA3.js","assets/files-CdfAAl3C.js","assets/flag-BdoWxvDG.js","assets/fr-B3FBXjT0.js","assets/fxp-CNHNYw_7.js","assets/fxp-DcRaohTd.js","assets/gameLog-Co2HLptY.js","assets/help-CQhE8UMp.js","assets/http-DptXoNq_.js","assets/idb-OWIpJU7O.js","assets/index-BH23y70G.css","assets/index-CLzthBmG.js","assets/jsx-runtime-NZYk81nU.js","assets/keys-D-MKR9PG.js","assets/layout-Dn8qn8dH.js","assets/lesson-BIZZ2FRF.js","assets/levels-DlkUqTaf.js","assets/live-hO2QIFCG.js","assets/local-hIHTs2_Z.js","assets/mailbox-wWsaVatB.js","assets/manifest-BRIPGYy3.js","assets/meshShape-D506V-v4.js","assets/nostr-DbKJDcnf.js","assets/open-CY0POPgu.js","assets/open-Z0phF1iv.js","assets/pack-CjG33yvs.js","assets/packageChange-Be729-6H.js","assets/page-VFCP04lA.js","assets/play-xHw8iHqv.js","assets/post-DNlDAwBv.js","assets/preload-helper-BaNbYf_w.js","assets/printPlay-Bm3d9DtD.js","assets/react-Bu-9VsiK.js","assets/react-Cvdyeg_0.js","assets/react-dom-B-VxWsjA.js","assets/react-hsrUxga6.js","assets/relayBusy-DoHBJB33.js","assets/replayFile-CsetEx-T.js","assets/report-BGrKc5oI.js","assets/rift-lanterns-DLDKmR7R.js","assets/rolldown-runtime-hePW80VL.js","assets/roster-CVZButfQ.js","assets/route-CLeJaNR6.js","assets/rulebook-DYk1I3nk.js","assets/scheduler-C784v2VA.js","assets/secp256k1-yVjC_Axf.js","assets/shelfActions-Bdn1PRLb.js","assets/showcase-BVyZ9Omh.js","assets/site-CHb1xoFU.js","assets/standIns-BTEgtfF8.js","assets/store-2LQj53_F.js","assets/store-BdWdsyin.js","assets/store-CgWAtmYb.js","assets/store-DCNP43UF.js","assets/store-DHIyDsYL.js","assets/store-fi52JHcg.js","assets/syntax-CEL_Wvla.js","assets/systemLabels-CcE0jL33.js","assets/systems-BFOHv3RX.js","assets/systems-C-x4Oze6.js","assets/systems-aCjEq2JE.js","assets/talk-JhsZ-jOv.js","assets/three.module-DD1TOtOx.js","assets/thumb-CO8tFfko.js","assets/trystero-C2nsm4bt.js","assets/trystero-CQejBhJ5.js","assets/trystero-ZIUMXu0C.js","assets/webtorrent.min-DeIqevk6.js","assets/worker-CtrB5Iye.js","assets/worker-DV1DuzPc.js","assets/worker-Dt2syYwm.js","assets/worker-E7xdOZwC.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","icons/maskable-512.png","index.html","manifest.webmanifest"];
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
