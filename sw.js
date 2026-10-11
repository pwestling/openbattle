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
const VERSION = "3a0c88667c92";
const FILES = ["assets/Board-D5BjF6Rs.js","assets/Branch-DotOzdhN.js","assets/BufferGeometryUtils-gzGtEl-O.js","assets/CommandPanel-BH_VihQy.js","assets/CommandPanel-D2OMRJoU.js","assets/CommandPanel-Ly72J0sM.js","assets/Editor-FlEgX1nz.js","assets/EventSeat-4BRGaRr1.js","assets/EventsUI-DjfJeWcK.js","assets/FigureLibrary-_D6Cnk_p.js","assets/Game-DG4qlvkx.js","assets/GameScreen-uGB8sUBi.js","assets/MailLobby-BtgVC47q.js","assets/Miniatures--1l8pP-H.js","assets/NextApp-BeFB9kjg.css","assets/NextApp-BjA_dnU5.js","assets/OpenTables-Ci3zTrWD.js","assets/PhotoMatch-tIEagjjj.js","assets/PlayerCard-D2960I5q.js","assets/RankedGame-Bio94YQv.js","assets/RulesPage-SsJOzzLm.js","assets/StandeeMaker-D5AVnpu8.js","assets/TeachRule-DnGKFnmQ.js","assets/Workshop-BydnWCvA.js","assets/_virtual_sandbox-worker-UEAHsTPi.js","assets/_virtual_soak-worker-Cs0BNELB.js","assets/actions-rLk9C7e0.js","assets/aws4fetch.esm-BLUAl4pF.js","assets/base64-gMTPUZJI.js","assets/board-B4QxZ0tx.js","assets/book-CEGukxWd.js","assets/brinewatch-DN2-OwGh.js","assets/browser-UgmTalj_.js","assets/browser-bopAeLbn.js","assets/codec-DOoWeNvh.js","assets/config-Kg6xkhHB.js","assets/core-D8NhQJ6q.js","assets/de-BrNCbuGo.js","assets/demo-vko1-KvA.js","assets/dist-WFp3Oeug.js","assets/dist-YYVtoirG.js","assets/dist-lgRNSFRF.js","assets/events-9ce18a08.esm-D-QCksbz.js","assets/faction-DOM31j7m.js","assets/file-qvOJhGA3.js","assets/files-CdfAAl3C.js","assets/flag-BdoWxvDG.js","assets/fr-DvFONwi8.js","assets/fxp-CNHNYw_7.js","assets/fxp-DcRaohTd.js","assets/gameLog-WuGIW00u.js","assets/help-DQGGk_T1.js","assets/hooks-BX7lLMxP.js","assets/http-Dgs8T45A.js","assets/idb-OWIpJU7O.js","assets/index-BH23y70G.css","assets/index-D3Ds7ABV.js","assets/jsx-runtime-NZYk81nU.js","assets/keys-D-MKR9PG.js","assets/layout-CpoJM9In.js","assets/lesson-B_dRTDa5.js","assets/levels-DlkUqTaf.js","assets/live-BH2iQuxP.js","assets/local-DVsxFjYE.js","assets/mailbox-BfGd-z38.js","assets/manifest-BRIPGYy3.js","assets/meshShape-BOfUQWTu.js","assets/nostr-DxudUsee.js","assets/open-C1Ee3leg.js","assets/open-Z0phF1iv.js","assets/pack-Bz79hK8X.js","assets/packPins-BbAent4E.js","assets/packageChange-Be729-6H.js","assets/page-D3XTirE-.js","assets/play-SplMxjg4.js","assets/post-Bft1t4Z1.js","assets/preload-helper-BaNbYf_w.js","assets/printPlay-BAbA2NV5.js","assets/react-Bu-9VsiK.js","assets/react-Cvdyeg_0.js","assets/react-dom-B-VxWsjA.js","assets/react-hsrUxga6.js","assets/relayBusy-DoHBJB33.js","assets/replayFile-Dn0ZqcH9.js","assets/report-aKcr85WT.js","assets/rift-lanterns-DLDKmR7R.js","assets/riftLanterns-CeR-CPxw.js","assets/rolldown-runtime-hePW80VL.js","assets/roster-CVZButfQ.js","assets/route-BRfm1CyQ.js","assets/rulebook-DYk1I3nk.js","assets/scheduler-C784v2VA.js","assets/secp256k1-yVjC_Axf.js","assets/shelfActions-BGuq4Owa.js","assets/showcase-BVyZ9Omh.js","assets/site-CHb1xoFU.js","assets/standIns-BTEgtfF8.js","assets/store-BSn2VpHm.js","assets/store-CFs4shgG.js","assets/store-CJOqNM-u.js","assets/store-DEzjS1uS.js","assets/store-DHgnS1iP.js","assets/store-yB9mpOJQ.js","assets/syntax-CEL_Wvla.js","assets/systemLabels-uD67WZE1.js","assets/systems-B5wuObUo.js","assets/systems-CgjmCGTd.js","assets/systems-CrFWAp-E.js","assets/talk-Dq1Vp4Yu.js","assets/three.module-DD1TOtOx.js","assets/thumb-ddlBqHUU.js","assets/trystero-Br3DLSyz.js","assets/trystero-CQejBhJ5.js","assets/trystero-DWSdmVlk.js","assets/webtorrent.min-DeIqevk6.js","assets/worker-BmsWxCMN.js","assets/worker-CtrB5Iye.js","assets/worker-DV1DuzPc.js","assets/worker-X4NcsHxs.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","icons/maskable-512.png","index.html","manifest.webmanifest"];
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
