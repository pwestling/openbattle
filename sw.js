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
const VERSION = "785e42e61c50";
const FILES = ["assets/Board-CBtjaEGR.js","assets/Branch-CEEkiLXE.js","assets/BufferGeometryUtils-gzGtEl-O.js","assets/CommandPanel-DgLx8_nN.js","assets/CommandPanel-DozGnZxr.js","assets/CommandPanel-c8r1MBMW.js","assets/CoreAbilities-DI4eGUbR.js","assets/Editor-7vrBFZ4v.js","assets/EventSeat-DSZDmRBf.js","assets/EventsUI-7gyYGCQb.js","assets/FigureLibrary-OJTnFvX0.js","assets/Game-C-aeCu9y.js","assets/GameScreen-CKszb22D.js","assets/MailLobby-CQJgQsLE.js","assets/Miniatures-CVei3k2n.js","assets/NextApp-CD4QHJQm.js","assets/NextApp-DTjdDICv.css","assets/OpenTables-Bqc55CFz.js","assets/Packages-hzKDf5CK.js","assets/PhotoMatch-D3vvGuOH.js","assets/PlayerCard-C6vhOM6W.js","assets/Qd6Card-B7ytZEhA.js","assets/Qd6Card-BeUcyQSb.js","assets/Qd6Card-BtY8Qyuv.js","assets/RankedGame-DvDOc7DR.js","assets/RoundPanel-B1WcM_ZG.js","assets/RoundPanel-BkLPUYvh.js","assets/RoundPanel-o0UAj4he.js","assets/RulesPage-BWDLeH4d.js","assets/StandeeMaker-CNwGbn_g.js","assets/TeachRule-Sex0-Wla.js","assets/Workshop-BPHYKSgg.js","assets/_virtual_sandbox-worker-ry7Mxznx.js","assets/_virtual_soak-worker-w8MyBW02.js","assets/actions-_4yzISWN.js","assets/aws4fetch.esm-BLUAl4pF.js","assets/base64-gMTPUZJI.js","assets/board-CeTO3oCK.js","assets/book-BGeY7fD1.js","assets/brinewatch-DN2-OwGh.js","assets/browser-UgmTalj_.js","assets/browser-bopAeLbn.js","assets/charge-CcvaRKv7.js","assets/codec-DOoWeNvh.js","assets/config-Kg6xkhHB.js","assets/core-Dqiqw8Fv.js","assets/de-tj_6FT04.js","assets/demo-DX1igtLb.js","assets/dist-WFp3Oeug.js","assets/dist-YYVtoirG.js","assets/dist-lgRNSFRF.js","assets/events-9ce18a08.esm-D-QCksbz.js","assets/faction-BrGOWGTw.js","assets/file-qvOJhGA3.js","assets/files-CdfAAl3C.js","assets/fr-Bc_I1Rwd.js","assets/fxp-CNHNYw_7.js","assets/fxp-DcRaohTd.js","assets/gameLog-B2hzswyh.js","assets/hooks-Bot7o8ql.js","assets/hooks-DU3L_D6F.js","assets/hooks-DeA5rpSh.js","assets/http-BvdhKV83.js","assets/idb-OWIpJU7O.js","assets/index-BpV18kb0.js","assets/index-Chj8U0ni.css","assets/jsx-runtime-NZYk81nU.js","assets/keys-D-MKR9PG.js","assets/layout-DUSVlmxe.js","assets/lesson-DZ6ZUajB.js","assets/levels-DlkUqTaf.js","assets/lit-n-Yt9ZNS.js","assets/live-Df4nyGjI.js","assets/local-CDfGaRE7.js","assets/mailbox-DOxqwkKv.js","assets/manifest-BRIPGYy3.js","assets/meshShape-5_mjG2JD.js","assets/nostr-D9ct2d1Z.js","assets/open-Bt5IhzB9.js","assets/open-Z0phF1iv.js","assets/pack-Ca3DlVtA.js","assets/packPins-CxTQx_o-.js","assets/packageChange-Be729-6H.js","assets/page-J8F_etXG.js","assets/play-Bf9O0rlh.js","assets/post-tdWdXBnV.js","assets/preload-helper-BaNbYf_w.js","assets/printPlay-tnkDZz3W.js","assets/react-Bu-9VsiK.js","assets/react-Cvdyeg_0.js","assets/react-LRsbgCie.js","assets/react-dom-B-VxWsjA.js","assets/react-hsrUxga6.js","assets/relayBusy-DoHBJB33.js","assets/replayFile-DF1Vvcnp.js","assets/report-B3XI_4XW.js","assets/rift-lanterns-DLDKmR7R.js","assets/rolldown-runtime-hePW80VL.js","assets/roster-CVZButfQ.js","assets/route-CGouJQuS.js","assets/rulebook-DYk1I3nk.js","assets/scheduler-C784v2VA.js","assets/secp256k1-yVjC_Axf.js","assets/shelfActions-C00_cmwD.js","assets/showcase-BVyZ9Omh.js","assets/site-CHb1xoFU.js","assets/standIns-BTEgtfF8.js","assets/start-B20TJ4dA.js","assets/store-BVI_7RTk.js","assets/store-BbNS-mA7.js","assets/store-Bk_aQyPA.js","assets/store-D6lCKQqt.js","assets/store-DmoRU1QF.js","assets/store-Dxep3ruD.js","assets/syntax-CEL_Wvla.js","assets/systemLabels-DIee_qPt.js","assets/systems-BzuejaDC.js","assets/systems-CqWbvYQe.js","assets/systems-DRA8kRB4.js","assets/talk-D1kfcUX1.js","assets/three.module-DD1TOtOx.js","assets/thumb-lSeR50x8.js","assets/trystero-CQejBhJ5.js","assets/trystero-LIsX6Feh.js","assets/webtorrent.min-DeIqevk6.js","assets/worker-BURr0lB8.js","assets/worker-CtrB5Iye.js","assets/worker-DQDDjOu-.js","assets/worker-DV1DuzPc.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","icons/maskable-512.png","index.html","manifest.webmanifest"];
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
