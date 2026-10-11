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
const VERSION = "9e20175f2ed8";
const FILES = ["assets/Board-D9P3APLd.js","assets/Branch-DPqVVZ4o.js","assets/BufferGeometryUtils-gzGtEl-O.js","assets/CommandPanel-ByTdbUaU.js","assets/CommandPanel-CGdnvOiW.js","assets/CommandPanel-DRn4bpJM.js","assets/Editor-TrKyXz20.js","assets/EventSeat-DTwcYncD.js","assets/EventsUI-CMkktF_-.js","assets/FigureLibrary-sFRJDm8T.js","assets/Game-DOnhICRK.js","assets/GameScreen-amVtX45z.js","assets/MailLobby-Di2A1lge.js","assets/Miniatures-DBrGvTgf.js","assets/NextApp-BDCJfis_.css","assets/NextApp-DW7gljwN.js","assets/OpenTables-DT1fIwv3.js","assets/PhotoMatch-BfHuIzVj.js","assets/PlayerCard-8qMqe82A.js","assets/RankedGame-DJ4D7KzI.js","assets/RulesPage-D7J3ApmN.js","assets/StandeeMaker-umuIjUQR.js","assets/TeachRule-BNYLX_oS.js","assets/Workshop-CwMdnQj_.js","assets/_virtual_sandbox-worker-UEAHsTPi.js","assets/_virtual_soak-worker-CmDRO9Z8.js","assets/actions-CCOh13nI.js","assets/aws4fetch.esm-BLUAl4pF.js","assets/base64-gMTPUZJI.js","assets/board-Du3N3wBc.js","assets/book-ZZr8vRCe.js","assets/brinewatch-DN2-OwGh.js","assets/browser-UgmTalj_.js","assets/browser-bopAeLbn.js","assets/codec-DOoWeNvh.js","assets/config-Kg6xkhHB.js","assets/core-rQ4cCMdA.js","assets/de-DuscyTQF.js","assets/demo-BF19SoHo.js","assets/dist-WFp3Oeug.js","assets/dist-YYVtoirG.js","assets/dist-lgRNSFRF.js","assets/events-9ce18a08.esm-D-QCksbz.js","assets/file-qvOJhGA3.js","assets/files-CdfAAl3C.js","assets/flag-BdoWxvDG.js","assets/fr-BshmL9wc.js","assets/fxp-CNHNYw_7.js","assets/fxp-DcRaohTd.js","assets/gameLog-Ds4W4Km9.js","assets/help-U5tadKEg.js","assets/http-Dj4SBmIu.js","assets/idb-OWIpJU7O.js","assets/index-BH23y70G.css","assets/index-D7xoSgdL.js","assets/jsx-runtime-NZYk81nU.js","assets/keys-D-MKR9PG.js","assets/layout-F_JONPHg.js","assets/lesson-BFBatywR.js","assets/levels-DlkUqTaf.js","assets/live-DMb1yGOC.js","assets/local-8PMD_m_E.js","assets/mailbox-BvB57xfv.js","assets/manifest-BRIPGYy3.js","assets/meshShape-D2Cbn2A1.js","assets/nostr-0wjP_bmk.js","assets/open-CCr6-gqX.js","assets/open-Z0phF1iv.js","assets/pack-B7L9246d.js","assets/packageChange-Be729-6H.js","assets/page-DMgJYFAT.js","assets/play-qvf0dBuV.js","assets/post-COOABoDT.js","assets/preload-helper-BaNbYf_w.js","assets/printPlay-B90gKv1C.js","assets/react-Bu-9VsiK.js","assets/react-Cvdyeg_0.js","assets/react-dom-B-VxWsjA.js","assets/react-hsrUxga6.js","assets/relayBusy-DoHBJB33.js","assets/replayFile-DRj3QIHh.js","assets/report-DTNSxlKz.js","assets/rift-lanterns-DLDKmR7R.js","assets/rolldown-runtime-hePW80VL.js","assets/roster-CVZButfQ.js","assets/route-B3C66D2f.js","assets/rulebook-DYk1I3nk.js","assets/scheduler-C784v2VA.js","assets/secp256k1-yVjC_Axf.js","assets/shelfActions-deAY9coS.js","assets/showcase-BVyZ9Omh.js","assets/site-CHb1xoFU.js","assets/standIns-BTEgtfF8.js","assets/store-1D4-g-Gw.js","assets/store-D6XVC3YA.js","assets/store-DFEybEyF.js","assets/store-DX7VPgRd.js","assets/store-DdHpvVgH.js","assets/store-GPpTViU_.js","assets/syntax-CEL_Wvla.js","assets/systemLabels-DjKEB1Fx.js","assets/systems-CETl8QXR.js","assets/systems-Ce3VlfKF.js","assets/systems-D7nfGa2a.js","assets/talk-CyEp-l0f.js","assets/three.module-DD1TOtOx.js","assets/thumb-BHHqrOgk.js","assets/trystero-BC6QhhsP.js","assets/trystero-BkosHLtB.js","assets/trystero-CQejBhJ5.js","assets/webtorrent.min-DeIqevk6.js","assets/worker-BF6BYu_1.js","assets/worker-CtrB5Iye.js","assets/worker-Czy8x94t.js","assets/worker-DV1DuzPc.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","icons/maskable-512.png","index.html","manifest.webmanifest"];
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
