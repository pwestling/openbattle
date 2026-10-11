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
const VERSION = "2d12eb13ded8";
const FILES = ["assets/Board-D0KJzl9y.js","assets/Branch-BFSdNt1h.js","assets/BufferGeometryUtils-gzGtEl-O.js","assets/CommandPanel-C17oc6vq.js","assets/CommandPanel-D804zXU_.js","assets/CommandPanel-DN8NrcSV.js","assets/Editor-CJME5jJv.js","assets/EventSeat-DSTjqlBu.js","assets/EventsUI-Chp4XLLZ.js","assets/FigureLibrary-DdND_RiQ.js","assets/Game-D14DU0K2.js","assets/GameScreen-Dnz6dqGF.js","assets/MailLobby-Bvz0AMtL.js","assets/Miniatures-DPcrB9si.js","assets/NextApp-BeFB9kjg.css","assets/NextApp-Dfgqy0rQ.js","assets/OpenTables-BQeED_ZI.js","assets/PhotoMatch-D9ZcaFBD.js","assets/PlayerCard-BOt9e2LC.js","assets/RankedGame-BLtwHiIj.js","assets/RulesPage-D0HkbKQ1.js","assets/StandeeMaker-D1Yu5Hr1.js","assets/TeachRule-BOBkSQcG.js","assets/Workshop-YoNoxJhW.js","assets/_virtual_sandbox-worker-UEAHsTPi.js","assets/_virtual_soak-worker-BXfkksmD.js","assets/actions-BRQ1YbkX.js","assets/aws4fetch.esm-BLUAl4pF.js","assets/base64-gMTPUZJI.js","assets/board-BEFA-Fao.js","assets/book-B6QfJzsw.js","assets/brinewatch-DN2-OwGh.js","assets/browser-UgmTalj_.js","assets/browser-bopAeLbn.js","assets/codec-DOoWeNvh.js","assets/config-Kg6xkhHB.js","assets/core-DntTRlHU.js","assets/de-zrLhrcWd.js","assets/demo-BNNAQfZD.js","assets/dist-WFp3Oeug.js","assets/dist-YYVtoirG.js","assets/dist-lgRNSFRF.js","assets/events-9ce18a08.esm-D-QCksbz.js","assets/faction-2plS-Txd.js","assets/file-qvOJhGA3.js","assets/files-CdfAAl3C.js","assets/flag-BdoWxvDG.js","assets/fr-DkO4fb6j.js","assets/fxp-CNHNYw_7.js","assets/fxp-DcRaohTd.js","assets/gameLog-BFEfvFGg.js","assets/help-DWuh3OUj.js","assets/hooks-KMH_MrwT.js","assets/http-DgxS2hl4.js","assets/idb-OWIpJU7O.js","assets/index-BH23y70G.css","assets/index-C9SAKujs.js","assets/jsx-runtime-NZYk81nU.js","assets/keys-D-MKR9PG.js","assets/layout-DBWhvamS.js","assets/lesson-BHHKP5_F.js","assets/levels-DlkUqTaf.js","assets/live-WcI_z4rW.js","assets/local-DN09-ZLh.js","assets/mailbox-Ca6O_C3M.js","assets/manifest-BRIPGYy3.js","assets/meshShape-erti9li4.js","assets/nostr-DBNmr54P.js","assets/open-Z0phF1iv.js","assets/open-ixEzIT2N.js","assets/pack-D0Ftozj_.js","assets/packPins-_L_bgSYj.js","assets/packageChange-Be729-6H.js","assets/page-_-8-UxJ_.js","assets/play-D2hu2s3A.js","assets/post-LTnAjyUU.js","assets/preload-helper-BaNbYf_w.js","assets/printPlay-BzMVHHW8.js","assets/react-Bu-9VsiK.js","assets/react-Cvdyeg_0.js","assets/react-dom-B-VxWsjA.js","assets/react-hsrUxga6.js","assets/relayBusy-DoHBJB33.js","assets/replayFile-BzaFEFmr.js","assets/report-B5V4leVW.js","assets/rift-lanterns-DLDKmR7R.js","assets/riftLanterns-DG84ihbK.js","assets/rolldown-runtime-hePW80VL.js","assets/roster-CVZButfQ.js","assets/route-TP-mq2S3.js","assets/rulebook-DYk1I3nk.js","assets/scheduler-C784v2VA.js","assets/secp256k1-yVjC_Axf.js","assets/shelfActions-CgnjDtdi.js","assets/showcase-BVyZ9Omh.js","assets/site-CHb1xoFU.js","assets/standIns-BTEgtfF8.js","assets/store-54tHMgzs.js","assets/store-BT-h02yf.js","assets/store-BtEMqwkd.js","assets/store-CWcSaGmI.js","assets/store-DfdhWNVu.js","assets/store-DvlFgU3p.js","assets/syntax-CEL_Wvla.js","assets/systemLabels-dqFRCZef.js","assets/systems-BVALkMSY.js","assets/systems-Byq17nht.js","assets/systems-CQHYpeGB.js","assets/talk-ClIUS7hk.js","assets/three.module-DD1TOtOx.js","assets/thumb-BTAEcoKE.js","assets/trystero-CQejBhJ5.js","assets/trystero-CwdSP3nO.js","assets/trystero-Ds0ZPr2E.js","assets/webtorrent.min-DeIqevk6.js","assets/worker-B5taqQap.js","assets/worker-CtrB5Iye.js","assets/worker-DV1DuzPc.js","assets/worker-jJgnLaiB.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","icons/maskable-512.png","index.html","manifest.webmanifest"];
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
