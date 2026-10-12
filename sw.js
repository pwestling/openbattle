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
const VERSION = "b7f9d2d0bbd0";
const FILES = ["assets/Board-D1UJPpRA.js","assets/Branch-DSwYE4Vv.js","assets/BufferGeometryUtils-gzGtEl-O.js","assets/CommandPanel-COwkR5Np.js","assets/CommandPanel-atEduYK1.js","assets/CommandPanel-pZ2aXXvR.js","assets/CoreAbilities-Dz1PrDe2.js","assets/Editor-BqsSEPnj.js","assets/EventSeat-C2OZxhHo.js","assets/EventsUI-BxmK9DTL.js","assets/FigureLibrary-BPxZV_qO.js","assets/Game-pLjYX6EC.js","assets/GameScreen-DV8iU8R2.js","assets/MailLobby-CIltQEh8.js","assets/Miniatures-DJqOtIPi.js","assets/NextApp-CZfGknj9.css","assets/NextApp-IJdxbaPk.js","assets/OpenTables-PZY_cikU.js","assets/Packages-V1JVyINF.js","assets/PhotoMatch-Bynh19R2.js","assets/PlayerCard-BCXSZ2Cn.js","assets/Qd6Card-C2dKRPoR.js","assets/Qd6Card-CEUOtJ-1.js","assets/Qd6Card-Cd5gNfup.js","assets/RankedGame-kre7pCdj.js","assets/RoundPanel-BVUCJNT8.js","assets/RoundPanel-CzAPjlmM.js","assets/RoundPanel-jbB98SWA.js","assets/RulesLine-BxsxJv-a.js","assets/RulesPage-DtD2lRy2.js","assets/StandeeMaker-X0wWEtSS.js","assets/TeachRule-DKr-Eygj.js","assets/Workshop-Ca2IJLJy.js","assets/_virtual_sandbox-worker-ry7Mxznx.js","assets/_virtual_soak-worker-Dgdr-P6Z.js","assets/actions-Bp27akb-.js","assets/aws4fetch.esm-BLUAl4pF.js","assets/base64-gMTPUZJI.js","assets/board-FwnqDZfN.js","assets/book-ZnPm2ThJ.js","assets/brinewatch-DN2-OwGh.js","assets/browser-UgmTalj_.js","assets/browser-bopAeLbn.js","assets/charge-DO4TNUyQ.js","assets/codec-DOoWeNvh.js","assets/config-Kg6xkhHB.js","assets/core-CkySYgfG.js","assets/de-CFYilQdx.js","assets/demo-CV-kHDf0.js","assets/dist-WFp3Oeug.js","assets/dist-YYVtoirG.js","assets/dist-lgRNSFRF.js","assets/events-9ce18a08.esm-D-QCksbz.js","assets/faction-nQV7VAQY.js","assets/file-qvOJhGA3.js","assets/files-CdfAAl3C.js","assets/flag-BdoWxvDG.js","assets/fr-CZb3ESRF.js","assets/fxp-CNHNYw_7.js","assets/fxp-DcRaohTd.js","assets/gameLog-C7lBRTrO.js","assets/hooks-4P7yJBRw.js","assets/hooks-CBUK12OF.js","assets/hooks-Clfvt_S1.js","assets/http-BpsFx90h.js","assets/idb-OWIpJU7O.js","assets/index-Chj8U0ni.css","assets/index-ap31YYD6.js","assets/jsx-runtime-NZYk81nU.js","assets/keys-D-MKR9PG.js","assets/layout-66bjxL3z.js","assets/lesson-CeHrFJ6p.js","assets/levels-DlkUqTaf.js","assets/live-Du1lQlrV.js","assets/local-DljYPyRz.js","assets/mailbox-CVqvFWik.js","assets/manifest-BRIPGYy3.js","assets/meshShape-VVefRz6l.js","assets/nostr-C-NMRd6E.js","assets/open-Dhk5Avu4.js","assets/open-Z0phF1iv.js","assets/pack-BsOFMrJd.js","assets/packPins-DNITUyBg.js","assets/packageChange-Be729-6H.js","assets/page-BuCiaQm9.js","assets/play-D5iUKxPk.js","assets/post-hw-cqySA.js","assets/preload-helper-BaNbYf_w.js","assets/printPlay-DmiqMjzX.js","assets/react-Bu-9VsiK.js","assets/react-Cvdyeg_0.js","assets/react-LRsbgCie.js","assets/react-dom-B-VxWsjA.js","assets/react-hsrUxga6.js","assets/relayBusy-DoHBJB33.js","assets/replayFile-D-KOW2-F.js","assets/report-oyymtgey.js","assets/rift-lanterns-DLDKmR7R.js","assets/rolldown-runtime-hePW80VL.js","assets/roster-CVZButfQ.js","assets/route-BFJgYI8T.js","assets/rulebook-DYk1I3nk.js","assets/scheduler-C784v2VA.js","assets/secp256k1-yVjC_Axf.js","assets/shelfActions-D5HarIIw.js","assets/showcase-BVyZ9Omh.js","assets/site-CHb1xoFU.js","assets/standIns-BTEgtfF8.js","assets/store-C-AxSIEM.js","assets/store-C1KLnH-7.js","assets/store-CHws1nFy.js","assets/store-I8Ak_9Ot.js","assets/store-bq-2fw76.js","assets/store-c8H7Ao0i.js","assets/syntax-CEL_Wvla.js","assets/systemLabels-DyHSiLwd.js","assets/systems-Ba86aKhp.js","assets/systems-Bt4zE8Xy.js","assets/systems-DBYQFXgv.js","assets/talk-DnEHk0Bx.js","assets/three.module-DD1TOtOx.js","assets/thumb-jNffhEt_.js","assets/trystero-CQejBhJ5.js","assets/trystero-LIsX6Feh.js","assets/webtorrent.min-DeIqevk6.js","assets/worker-CnjakJF1.js","assets/worker-CtJkJ255.js","assets/worker-CtrB5Iye.js","assets/worker-DV1DuzPc.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","icons/maskable-512.png","index.html","manifest.webmanifest"];
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
