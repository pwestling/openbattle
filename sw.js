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
const VERSION = "24c1909496c7";
const FILES = ["assets/Board-u5ZvnnkR.js","assets/Branch-BTuVHVjo.js","assets/BufferGeometryUtils-gzGtEl-O.js","assets/CommandPanel-C6FEXFYt.js","assets/CommandPanel-D_kPEl1b.js","assets/CommandPanel-EaIepXCd.js","assets/CoreAbilities-B62gvrh1.js","assets/Editor-DPw7NYLB.js","assets/EventSeat-kD43X3Pt.js","assets/EventsUI-DYWJRp4S.js","assets/FigureLibrary-DltxAOzg.js","assets/Game-C2y--5YF.js","assets/GameScreen-DmIgxrHi.js","assets/MailLobby-ynwB_QNr.js","assets/Miniatures-DdMm0a_0.js","assets/NextApp-3LuE73x6.js","assets/NextApp-DPZ13xtn.css","assets/OpenTables-Bs4txEaq.js","assets/Packages-xIeO6MJZ.js","assets/PhotoMatch-COzNzGht.js","assets/PlayerCard-CQy89Hak.js","assets/Qd6Card-Be737bOY.js","assets/Qd6Card-CsMKN4_k.js","assets/Qd6Card-yq7FGVIJ.js","assets/RankedGame-CB4auHts.js","assets/RoundPanel-BseqL-77.js","assets/RoundPanel-DMpO6X_h.js","assets/RoundPanel-v5MZ8XGB.js","assets/RulesPage-C_jkU5ZR.js","assets/StandeeMaker-sIY1jXfC.js","assets/TeachRule-C3UVJLxD.js","assets/Workshop-CNaUz4BM.js","assets/_virtual_sandbox-worker-CQyczKOb.js","assets/_virtual_soak-worker-Br_Z_OOd.js","assets/actions-BZoglHcl.js","assets/aws4fetch.esm-BLUAl4pF.js","assets/base64-gMTPUZJI.js","assets/board-MTCf1Tjc.js","assets/book-Cik45P1T.js","assets/brinewatch-DN2-OwGh.js","assets/browser-UgmTalj_.js","assets/browser-bopAeLbn.js","assets/charge-BM6DuHB2.js","assets/codec-DOoWeNvh.js","assets/config-Kg6xkhHB.js","assets/core-UMzFPcSu.js","assets/de-Cwr70wP1.js","assets/demo-BzGZerZX.js","assets/dist-WFp3Oeug.js","assets/dist-YYVtoirG.js","assets/dist-lgRNSFRF.js","assets/events-9ce18a08.esm-D-QCksbz.js","assets/faction-DM1QQq5X.js","assets/file-qvOJhGA3.js","assets/files-CdfAAl3C.js","assets/fr-eJI1vY2z.js","assets/fxp-CNHNYw_7.js","assets/fxp-DcRaohTd.js","assets/gameLog-CanOAwAP.js","assets/hooks-BK0Xc28Q.js","assets/hooks-DLa9xUne.js","assets/hooks-DvjGpOTT.js","assets/http-WjawS2Gy.js","assets/idb-OWIpJU7O.js","assets/index-Chj8U0ni.css","assets/index-f2_we0dn.js","assets/jsx-runtime-NZYk81nU.js","assets/keys-D-MKR9PG.js","assets/layout-BSBSiJMF.js","assets/lesson-PruXDb20.js","assets/levels-DlkUqTaf.js","assets/lit-n-Yt9ZNS.js","assets/live-Crvh5D0e.js","assets/local-Bes0BE9W.js","assets/mailbox-CRsvIHvp.js","assets/manifest-BRIPGYy3.js","assets/meshShape-Dg6vqdBX.js","assets/nostr-zrWtkUsR.js","assets/open-CfgRRhof.js","assets/open-Z0phF1iv.js","assets/pack-BKsThZW7.js","assets/packPins-B1xGxEDv.js","assets/packageChange-Be729-6H.js","assets/page-1BdVR23L.js","assets/play-066C30WD.js","assets/post-DXNVWZP_.js","assets/preload-helper-BaNbYf_w.js","assets/printPlay-WNo5UkWU.js","assets/react-Bu-9VsiK.js","assets/react-Cvdyeg_0.js","assets/react-LRsbgCie.js","assets/react-dom-B-VxWsjA.js","assets/react-hsrUxga6.js","assets/relayBusy-DoHBJB33.js","assets/replayFile-Dm5t4u9j.js","assets/report-DQxR8Gzy.js","assets/rift-lanterns-DLDKmR7R.js","assets/rolldown-runtime-hePW80VL.js","assets/roster-CVZButfQ.js","assets/route-BGjZxN26.js","assets/rulebook-DYk1I3nk.js","assets/scheduler-C784v2VA.js","assets/secp256k1-yVjC_Axf.js","assets/shelfActions-Dfgvi9ks.js","assets/showcase-BVyZ9Omh.js","assets/site-CHb1xoFU.js","assets/standIns-BTEgtfF8.js","assets/start-CaeHYB89.js","assets/store-A5D6yhKM.js","assets/store-C4Ka6yjO.js","assets/store-CKHCfKi5.js","assets/store-CNGJCl0R.js","assets/store-CmGWZ-Mo.js","assets/store-D3iMXGJW.js","assets/syntax-CEL_Wvla.js","assets/systemLabels-ADZjw0mE.js","assets/systems-BI7bV1nY.js","assets/systems-BcbQw9Gy.js","assets/systems-njfloP6r.js","assets/talk-Do53bV5N.js","assets/three.module-DD1TOtOx.js","assets/thumb-CL4suRvH.js","assets/trystero-CQejBhJ5.js","assets/trystero-LIsX6Feh.js","assets/webtorrent.min-DeIqevk6.js","assets/worker-CtrB5Iye.js","assets/worker-DIqOK3aF.js","assets/worker-DV1DuzPc.js","assets/worker-_2qZYdNL.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","icons/maskable-512.png","index.html","manifest.webmanifest"];
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
