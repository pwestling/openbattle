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
const VERSION = "d9ffcf9656ef";
const FILES = ["assets/Board-BFSaAIrL.js","assets/BufferGeometryUtils-Bg58SzpS.js","assets/CommandPanel-B4d9R1e9.js","assets/CommandPanel-Bh2rOnmG.js","assets/CommandPanel-s6mBOffM.js","assets/Editor-Bff1vozp.js","assets/EventSeat-BvyVHruK.js","assets/EventsUI-Dat79Y2W.js","assets/FigureLibrary-DcAeyvhq.js","assets/GameScreen-Cj_d7VHJ.js","assets/MailLobby-D9ObgWPu.js","assets/Miniatures-CLVcZOJH.js","assets/OpenTables-DeO2BKdm.js","assets/PhotoMatch-Dcz7Kg5X.js","assets/PlayerCard-CAVZcIYF.js","assets/RankedGame-CxAD0zdu.js","assets/RulesPage-BEWsP9Jr.js","assets/StandeeMaker-C7scJGOn.js","assets/TeachRule-Cjeg4ae5.js","assets/Workshop-ZlF5m31M.js","assets/_virtual_sandbox-worker-Blti5ew3.js","assets/_virtual_soak-worker-6jR-gmOt.js","assets/actions-MbvZDRAX.js","assets/aws4fetch.esm-BLUAl4pF.js","assets/base64-gMTPUZJI.js","assets/book-luAlMGqr.js","assets/brinewatch-DN2-OwGh.js","assets/browser-UgmTalj_.js","assets/browser-bopAeLbn.js","assets/codec-DOoWeNvh.js","assets/config-Kg6xkhHB.js","assets/core-La7L1BAo.js","assets/de-D8_YVfDK.js","assets/dist-WFp3Oeug.js","assets/dist-YYVtoirG.js","assets/dist-lgRNSFRF.js","assets/file-qvOJhGA3.js","assets/files-CdfAAl3C.js","assets/fr-DnpEytpG.js","assets/fxp-CNHNYw_7.js","assets/fxp-DcRaohTd.js","assets/gameLog-CEFxuRqJ.js","assets/help-DiL3PTT-.js","assets/http-Li_ZTJ2T.js","assets/idb-OWIpJU7O.js","assets/index-BnI__sfz.js","assets/index-Cx3-Bc6E.css","assets/jsx-runtime-NZYk81nU.js","assets/keys-D-MKR9PG.js","assets/layout-CRuBBb5-.js","assets/lesson-C2opODS4.js","assets/levels-DlkUqTaf.js","assets/local-BDgCnBNt.js","assets/mailbox-DrXEiVrh.js","assets/manifest-BRIPGYy3.js","assets/meshShape-LyrpM2oI.js","assets/nostr-CbudvWJg.js","assets/pack-BlU54RLt.js","assets/packageChange-Be729-6H.js","assets/page-CkHIqUfP.js","assets/play-Cn2-5TbB.js","assets/post-DNP5-riU.js","assets/preload-helper-BaNbYf_w.js","assets/printPlay-BDv4Xmrq.js","assets/react-B7jgbFkM.js","assets/react-Cvdyeg_0.js","assets/react-dom-B-VxWsjA.js","assets/react-hsrUxga6.js","assets/relayBusy-DoHBJB33.js","assets/replayFile-DGcRVPZK.js","assets/report-CtcRzeB2.js","assets/rift-lanterns-DLDKmR7R.js","assets/rolldown-runtime-hePW80VL.js","assets/roster-CVZButfQ.js","assets/rulebook-DYk1I3nk.js","assets/scheduler-C784v2VA.js","assets/secp256k1-yVjC_Axf.js","assets/shelfActions-D7LKEog5.js","assets/showcase-Dcyx4k9V.js","assets/site-CHb1xoFU.js","assets/sound-BYXSO4hD.js","assets/standIns-BHeYT5qd.js","assets/store-BF2A4rN8.js","assets/store-D-YKLIWN.js","assets/store-DbMRFn7M.js","assets/store-MyVJmXTd.js","assets/store-rgpufvZO.js","assets/syntax-CEL_Wvla.js","assets/systemLabels-8-eHhaot.js","assets/talk-UkNc-cBF.js","assets/three.module-BnHMTVNq.js","assets/thumb-vb3jQJPn.js","assets/trystero-CQejBhJ5.js","assets/trystero-DMN6hwE3.js","assets/webtorrent.min-DeIqevk6.js","assets/worker-Bg359lrz.js","assets/worker-CV_Hw5AZ.js","assets/worker-CtrB5Iye.js","assets/worker-DV1DuzPc.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","icons/maskable-512.png","index.html","manifest.webmanifest"];
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
