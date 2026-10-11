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
const VERSION = "2f3c52e1b989";
const FILES = ["assets/Board-Basn3LkK.js","assets/Branch-DWPqZxxB.js","assets/BufferGeometryUtils-gzGtEl-O.js","assets/CommandPanel-Cq1A-90I.js","assets/CommandPanel-D9g7IQ7o.js","assets/CommandPanel-DE8wxHIZ.js","assets/Editor-Dnj_rNFv.js","assets/EventSeat-DG5jPoTw.js","assets/EventsUI-qyyISZIB.js","assets/FigureLibrary-CQ5ndwul.js","assets/Game-DRWbwqz3.js","assets/GameScreen-B0hjcorN.js","assets/MailLobby-BR_vU_MR.js","assets/Miniatures-CmOiZKg2.js","assets/NextApp-BF6S2Q8Y.css","assets/NextApp-DsLWF_iS.js","assets/OpenTables-Nl4aN7A-.js","assets/PhotoMatch-CfEX4es_.js","assets/PlayerCard-CgQO54lO.js","assets/RankedGame-q8dVXTu8.js","assets/RulesPage-B6EXTac1.js","assets/StandeeMaker-BOV8ViM1.js","assets/TeachRule-NPaYpFlo.js","assets/Workshop-awDPsbnx.js","assets/_virtual_sandbox-worker-UEAHsTPi.js","assets/_virtual_soak-worker-DUMg1NJr.js","assets/actions-CIf2MyRJ.js","assets/aws4fetch.esm-BLUAl4pF.js","assets/base64-gMTPUZJI.js","assets/board-B5hLMzZh.js","assets/book-umszswat.js","assets/brinewatch-DN2-OwGh.js","assets/browser-UgmTalj_.js","assets/browser-bopAeLbn.js","assets/codec-DOoWeNvh.js","assets/config-Kg6xkhHB.js","assets/core-Byh2MzVQ.js","assets/de-DvkExE0D.js","assets/demo-BGTEbKOF.js","assets/dist-WFp3Oeug.js","assets/dist-YYVtoirG.js","assets/dist-lgRNSFRF.js","assets/events-9ce18a08.esm-D-QCksbz.js","assets/file-qvOJhGA3.js","assets/files-CdfAAl3C.js","assets/flag-BdoWxvDG.js","assets/fr-C-XfWOSV.js","assets/fxp-CNHNYw_7.js","assets/fxp-DcRaohTd.js","assets/gameLog-DTCTbP20.js","assets/help-BPLlTID2.js","assets/http-DFroT5ou.js","assets/idb-OWIpJU7O.js","assets/index-BH23y70G.css","assets/index-V3YeUN7p.js","assets/jsx-runtime-NZYk81nU.js","assets/keys-D-MKR9PG.js","assets/layout-BPuCyJXt.js","assets/lesson-Btn5rffT.js","assets/levels-DlkUqTaf.js","assets/live-DqxqzUf9.js","assets/local-BWGMeyVW.js","assets/mailbox-BsXS8qEt.js","assets/manifest-BRIPGYy3.js","assets/meshShape-Y3O7L2RZ.js","assets/nostr-DKAO2ZJ1.js","assets/open-Z0phF1iv.js","assets/open-i92Dm1Ya.js","assets/pack-wFnSwfvE.js","assets/packageChange-Be729-6H.js","assets/page-WhabKhIy.js","assets/play-CsCvA-MH.js","assets/post-Bp2wPXgF.js","assets/preload-helper-BaNbYf_w.js","assets/printPlay-C0b5UUpK.js","assets/react-Bu-9VsiK.js","assets/react-Cvdyeg_0.js","assets/react-dom-B-VxWsjA.js","assets/react-hsrUxga6.js","assets/relayBusy-DoHBJB33.js","assets/replayFile-CzInKvvl.js","assets/report-L5vyzcy0.js","assets/rift-lanterns-DLDKmR7R.js","assets/rolldown-runtime-hePW80VL.js","assets/roster-CVZButfQ.js","assets/route-kJnAIPST.js","assets/rulebook-DYk1I3nk.js","assets/scheduler-C784v2VA.js","assets/secp256k1-yVjC_Axf.js","assets/shelfActions-PKt_ueIh.js","assets/showcase-BVyZ9Omh.js","assets/site-CHb1xoFU.js","assets/standIns-BTEgtfF8.js","assets/store-B-cyAmrD.js","assets/store-BeYdD3Bf.js","assets/store-C7GVOaHE.js","assets/store-CVr7J6V_.js","assets/store-D5WUI5Pq.js","assets/store-zlocupGe.js","assets/syntax-CEL_Wvla.js","assets/systemLabels-6Sb8WCEW.js","assets/systems-BatpSjOi.js","assets/systems-CNzGzj3g.js","assets/systems-HHXbQQp3.js","assets/talk-N2W0k-jh.js","assets/three.module-DD1TOtOx.js","assets/thumb-CKuWnX8P.js","assets/trystero-CQejBhJ5.js","assets/trystero-Cnwey0aw.js","assets/trystero-GP4WJuD-.js","assets/webtorrent.min-DeIqevk6.js","assets/worker-CM5edo1v.js","assets/worker-CtrB5Iye.js","assets/worker-DV1DuzPc.js","assets/worker-Dz9_PP4S.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","icons/maskable-512.png","index.html","manifest.webmanifest"];
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
