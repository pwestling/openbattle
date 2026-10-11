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
const VERSION = "6424442800c1";
const FILES = ["assets/Board-BjpBB87K.js","assets/Branch-MehtWJtY.js","assets/BufferGeometryUtils-gzGtEl-O.js","assets/CommandPanel-BHSmJfKb.js","assets/CommandPanel-CS8geunA.js","assets/CommandPanel-DZHMRAsr.js","assets/Editor-DSpasTkS.js","assets/EventSeat-Dj5gCrRa.js","assets/EventsUI-CUZ9jVeM.js","assets/FigureLibrary-ZdMtLEr_.js","assets/Game-D8DMg024.js","assets/GameScreen-DMICNgcS.js","assets/MailLobby-DLbG-yDF.js","assets/Miniatures-BbVuHKAY.js","assets/NextApp-BoQTwMxz.css","assets/NextApp-CU0Ep3DB.js","assets/OpenTables-CTFM1n5D.js","assets/PhotoMatch-BxWuAvMD.js","assets/PlayerCard-UH78rHGc.js","assets/RankedGame-C0kDE6kk.js","assets/RulesPage-DZ3uC4Nx.js","assets/StandeeMaker-eCJc_q9Q.js","assets/TeachRule-DgXWMN6k.js","assets/Workshop-DlIZBb0L.js","assets/_virtual_sandbox-worker-UEAHsTPi.js","assets/_virtual_soak-worker-B6g8MjkA.js","assets/actions-Dks2z7Ne.js","assets/aws4fetch.esm-BLUAl4pF.js","assets/base64-gMTPUZJI.js","assets/board-CxtOW-N_.js","assets/book-COcWG7H6.js","assets/brinewatch-DN2-OwGh.js","assets/browser-UgmTalj_.js","assets/browser-bopAeLbn.js","assets/codec-DOoWeNvh.js","assets/config-Kg6xkhHB.js","assets/core-xfeGG3YP.js","assets/de-39P9Loeq.js","assets/demo-xrW8RLD2.js","assets/dist-WFp3Oeug.js","assets/dist-YYVtoirG.js","assets/dist-lgRNSFRF.js","assets/events-9ce18a08.esm-D-QCksbz.js","assets/faction-BP0KFPCI.js","assets/file-qvOJhGA3.js","assets/files-CdfAAl3C.js","assets/flag-BdoWxvDG.js","assets/fr-DGixllLq.js","assets/fxp-CNHNYw_7.js","assets/fxp-DcRaohTd.js","assets/gameLog-CsW4pLn3.js","assets/help-WKGIVEXR.js","assets/hooks-XbkMm8RA.js","assets/http-Le5LMNe1.js","assets/idb-OWIpJU7O.js","assets/index-BH23y70G.css","assets/index-BLpYYBpY.js","assets/jsx-runtime-NZYk81nU.js","assets/keys-D-MKR9PG.js","assets/layout-YwuPBk0C.js","assets/lesson-h9WrqwBl.js","assets/levels-DlkUqTaf.js","assets/live-DmL4d6cx.js","assets/local-DdnVG4if.js","assets/mailbox-DxVsg4tQ.js","assets/manifest-BRIPGYy3.js","assets/meshShape-D8DDW3sk.js","assets/nostr-szlnYWxJ.js","assets/open-BA5w1Kzp.js","assets/open-Z0phF1iv.js","assets/pack-CmjIll_B.js","assets/packPins-GnJs_VZq.js","assets/packageChange-Be729-6H.js","assets/page-D3HTIVzh.js","assets/play-Dl_ScUSQ.js","assets/post-B7t4H4sp.js","assets/preload-helper-BaNbYf_w.js","assets/printPlay-BNsVfhT-.js","assets/react-Bu-9VsiK.js","assets/react-Cvdyeg_0.js","assets/react-dom-B-VxWsjA.js","assets/react-hsrUxga6.js","assets/relayBusy-DoHBJB33.js","assets/replayFile-YdL9bd0V.js","assets/report-p28HMNc-.js","assets/rift-lanterns-DLDKmR7R.js","assets/riftLanterns-DANOIRGt.js","assets/rolldown-runtime-hePW80VL.js","assets/roster-CVZButfQ.js","assets/route-BcNXNvfb.js","assets/rulebook-DYk1I3nk.js","assets/scheduler-C784v2VA.js","assets/secp256k1-yVjC_Axf.js","assets/shelfActions--qpSq4nq.js","assets/showcase-BVyZ9Omh.js","assets/site-CHb1xoFU.js","assets/standIns-BTEgtfF8.js","assets/store-BciwG3VF.js","assets/store-C1OrkHhw.js","assets/store-C5m22ymz.js","assets/store-CNsUWmtm.js","assets/store-DBE32iyA.js","assets/store-DSVrQ2E3.js","assets/syntax-CEL_Wvla.js","assets/systemLabels-DgV12bsi.js","assets/systems-AmjmpB_p.js","assets/systems-CEmiNca0.js","assets/systems-xtUelRyz.js","assets/talk-DGH0N3PF.js","assets/three.module-DD1TOtOx.js","assets/thumb-tuPyGBhH.js","assets/trystero-0wpQYkXv.js","assets/trystero-CQejBhJ5.js","assets/trystero-DqsFxAdD.js","assets/webtorrent.min-DeIqevk6.js","assets/worker-BSDMagE-.js","assets/worker-CtrB5Iye.js","assets/worker-DV1DuzPc.js","assets/worker-DZIg9FKc.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","icons/maskable-512.png","index.html","manifest.webmanifest"];
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
