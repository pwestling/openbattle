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
const VERSION = "10977dd45017";
const FILES = ["assets/Board-CqrCPNv7.js","assets/Branch-DrwEQaLB.js","assets/BufferGeometryUtils-gzGtEl-O.js","assets/CommandPanel-Csf3PoEa.js","assets/CommandPanel-DQRSygbO.js","assets/CommandPanel-D_kwjLYX.js","assets/CoreAbilities-DaeYJQuY.js","assets/Editor-6SvoRjZR.js","assets/EventSeat-jAObJBU0.js","assets/EventsUI-B5Q3XoDh.js","assets/FigureLibrary-BAAD0JAi.js","assets/Game-BT1y-_jP.js","assets/GameScreen-CWdq6dFK.js","assets/MailLobby-DDuvKfKJ.js","assets/Miniatures-BFyy9P2t.js","assets/NextApp-DTjdDICv.css","assets/NextApp-GJOXtVnA.js","assets/OpenTables-CwWOx3bM.js","assets/Packages-COEkfB_M.js","assets/PhotoMatch-CqKOxA17.js","assets/PlayerCard-DgLRjXfc.js","assets/Qd6Card-D6OyHwJD.js","assets/Qd6Card-Dt8BMIsK.js","assets/Qd6Card-Z_nJjL1Y.js","assets/RankedGame-rFRAXhfT.js","assets/RoundPanel-BqOmoT-U.js","assets/RoundPanel-CXsBZTWo.js","assets/RoundPanel-DzRdm2ZA.js","assets/RulesPage-CO6IHjwc.js","assets/StandeeMaker-Bw8UUTJr.js","assets/TeachRule-DmwN353A.js","assets/Workshop-wxIMXAe_.js","assets/_virtual_sandbox-worker-ry7Mxznx.js","assets/_virtual_soak-worker-B77Tt20w.js","assets/actions-ChvFw6QA.js","assets/aws4fetch.esm-BLUAl4pF.js","assets/base64-gMTPUZJI.js","assets/board-C3O2XSle.js","assets/book-Cm6hFfzy.js","assets/brinewatch-DN2-OwGh.js","assets/browser-UgmTalj_.js","assets/browser-bopAeLbn.js","assets/charge-ZPBR1pth.js","assets/codec-DOoWeNvh.js","assets/config-Kg6xkhHB.js","assets/core-BNabrLH7.js","assets/de-BGFOjBNP.js","assets/demo-Ad2970Bj.js","assets/dist-WFp3Oeug.js","assets/dist-YYVtoirG.js","assets/dist-lgRNSFRF.js","assets/events-9ce18a08.esm-D-QCksbz.js","assets/faction-BUTvg8Pt.js","assets/file-qvOJhGA3.js","assets/files-CdfAAl3C.js","assets/fr-CWeHMcK5.js","assets/fxp-CNHNYw_7.js","assets/fxp-DcRaohTd.js","assets/gameLog-BX-5yk4a.js","assets/hooks-32p9Czbr.js","assets/hooks-D3O17baW.js","assets/hooks-dZakwBig.js","assets/http-r2VkB6Qm.js","assets/idb-OWIpJU7O.js","assets/index-Chj8U0ni.css","assets/index-DWZ-PBMl.js","assets/jsx-runtime-NZYk81nU.js","assets/keys-D-MKR9PG.js","assets/layout-NGRZzNsU.js","assets/lesson-Bn9lbPZh.js","assets/levels-DlkUqTaf.js","assets/lit-n-Yt9ZNS.js","assets/live-D3ihg-8w.js","assets/local-DYm8hz2T.js","assets/mailbox-BnuZeWoJ.js","assets/manifest-BRIPGYy3.js","assets/meshShape-Dn62K7jf.js","assets/nostr-Dj6dP1eB.js","assets/open-DIKD-w6g.js","assets/open-Z0phF1iv.js","assets/pack-Bh-ISFwa.js","assets/packPins-BWOGfyRb.js","assets/packageChange-Be729-6H.js","assets/page-CCtjcSml.js","assets/play-B2mJ8Ttl.js","assets/post-CxU4YYRW.js","assets/preload-helper-BaNbYf_w.js","assets/printPlay-DoGirMqW.js","assets/react-Bu-9VsiK.js","assets/react-Cvdyeg_0.js","assets/react-LRsbgCie.js","assets/react-dom-B-VxWsjA.js","assets/react-hsrUxga6.js","assets/relayBusy-DoHBJB33.js","assets/replayFile-DSSFI0q4.js","assets/report-CDYz25J0.js","assets/rift-lanterns-DLDKmR7R.js","assets/rolldown-runtime-hePW80VL.js","assets/roster-CVZButfQ.js","assets/route-BKnbx-wU.js","assets/rulebook-DYk1I3nk.js","assets/scheduler-C784v2VA.js","assets/secp256k1-yVjC_Axf.js","assets/shelfActions-u3ljPvgj.js","assets/showcase-BVyZ9Omh.js","assets/site-CHb1xoFU.js","assets/standIns-BTEgtfF8.js","assets/start-CGc0c4OM.js","assets/store-BbhFLChp.js","assets/store-Bj4tR4TO.js","assets/store-CNxxz-hj.js","assets/store-COyS_vCM.js","assets/store-Ce1RfH4Q.js","assets/store-tuEuUzhH.js","assets/syntax-CEL_Wvla.js","assets/systemLabels-DmKTs4zV.js","assets/systems-BhZ62QQm.js","assets/systems-DOV3yuOG.js","assets/systems-_fAInGPo.js","assets/talk-BYB4df-A.js","assets/three.module-DD1TOtOx.js","assets/thumb-BTFyrxQC.js","assets/trystero-CQejBhJ5.js","assets/trystero-LIsX6Feh.js","assets/webtorrent.min-DeIqevk6.js","assets/worker-Bv4MdtFw.js","assets/worker-CtrB5Iye.js","assets/worker-DV1DuzPc.js","assets/worker-IPU97lmA.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","icons/maskable-512.png","index.html","manifest.webmanifest"];
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
