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
const VERSION = "502dd96a6596";
const FILES = ["assets/Board-C_aYjBqJ.js","assets/BufferGeometryUtils-Bg58SzpS.js","assets/CommandPanel-BVXNghN3.js","assets/CommandPanel-Ox7wWzvv.js","assets/CommandPanel-Sf8iD-nR.js","assets/Editor-C9SZnz-s.js","assets/EventSeat-CjoaA-gW.js","assets/EventsUI-kZrfO_hx.js","assets/FigureLibrary-Chx6i_yn.js","assets/GameScreen-Qq470p04.js","assets/MailLobby-Dx6cq58g.js","assets/Miniatures-OCDYn6jC.js","assets/OpenTables-BBVR02rg.js","assets/PhotoMatch-CHyuFHw3.js","assets/PlayerCard-B5Yy5N3o.js","assets/RankedGame-Dk0P1SWo.js","assets/RulesPage-CO6aAm7D.js","assets/StandeeMaker-D8nQF2Kd.js","assets/TeachRule-BWlnZLuD.js","assets/Workshop-jkdCpqSc.js","assets/_virtual_sandbox-worker-uERafCpR.js","assets/_virtual_soak-worker-D37bfrse.js","assets/actions-DzC8yAYw.js","assets/aws4fetch.esm-BLUAl4pF.js","assets/base64-gMTPUZJI.js","assets/book-Dfjpe8_Y.js","assets/brinewatch-DN2-OwGh.js","assets/browser-UgmTalj_.js","assets/browser-bopAeLbn.js","assets/codec-DOoWeNvh.js","assets/config-Kg6xkhHB.js","assets/core-DjyUJGQF.js","assets/de-LUPWLMZ7.js","assets/dist-WFp3Oeug.js","assets/dist-YYVtoirG.js","assets/dist-lgRNSFRF.js","assets/file-qvOJhGA3.js","assets/files-CdfAAl3C.js","assets/fr-CRAso3MP.js","assets/fxp-CNHNYw_7.js","assets/fxp-DcRaohTd.js","assets/gameLog-B2UNCpQV.js","assets/help-peDl_XDs.js","assets/http-fFLjfH-S.js","assets/idb-OWIpJU7O.js","assets/index-BebH6uh4.css","assets/index-DLuHp4rQ.js","assets/jsx-runtime-NZYk81nU.js","assets/keys-D-MKR9PG.js","assets/layout-D69yh6ew.js","assets/lesson-DrszeSAE.js","assets/levels-DlkUqTaf.js","assets/local-BGQ2Tnoy.js","assets/mailbox-XvYSlpPl.js","assets/manifest-BRIPGYy3.js","assets/meshShape-DkPDxyYc.js","assets/nostr-B4VBdWn5.js","assets/open-Z0phF1iv.js","assets/pack-B-xyv6cM.js","assets/packageChange-Be729-6H.js","assets/page-CC7shSOs.js","assets/play-BjTWKdo2.js","assets/post-DPtCorM7.js","assets/preload-helper-BaNbYf_w.js","assets/printPlay-D8OEjxGR.js","assets/react-Bu-9VsiK.js","assets/react-Cvdyeg_0.js","assets/react-dom-B-VxWsjA.js","assets/react-hsrUxga6.js","assets/relayBusy-DoHBJB33.js","assets/replayFile-BAvpXeAs.js","assets/report-mriKEGyR.js","assets/rift-lanterns-DLDKmR7R.js","assets/rolldown-runtime-hePW80VL.js","assets/roster-CVZButfQ.js","assets/route-BFK598Sf.js","assets/rulebook-DYk1I3nk.js","assets/scheduler-C784v2VA.js","assets/secp256k1-yVjC_Axf.js","assets/shelfActions-Bf9TrIJy.js","assets/showcase-Dcyx4k9V.js","assets/site-CHb1xoFU.js","assets/sound-BYXSO4hD.js","assets/standIns-BHeYT5qd.js","assets/store-BOPYIq_x.js","assets/store-CwMoVCln.js","assets/store-D6OBdouy.js","assets/store-DKub4d20.js","assets/store-QZvl2Ngm.js","assets/syntax-CEL_Wvla.js","assets/systemLabels-B2uJpm2G.js","assets/systems-B5F763yL.js","assets/systems-hShda1l-.js","assets/systems-vvRbBrUC.js","assets/talk-BgzcTAiC.js","assets/three.module-BnHMTVNq.js","assets/thumb-tNNz5Ty8.js","assets/trystero-2ywJ4svb.js","assets/trystero-CQejBhJ5.js","assets/trystero-Cq2aSoRx.js","assets/webtorrent.min-DeIqevk6.js","assets/worker-BI-WYIip.js","assets/worker-CtrB5Iye.js","assets/worker-D1vUOmPw.js","assets/worker-DV1DuzPc.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","icons/maskable-512.png","index.html","manifest.webmanifest"];
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
