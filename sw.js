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
const VERSION = "f9696c9f1039";
const FILES = ["assets/Board-CIvqqv9M.js","assets/Branch-BOllfK_K.js","assets/BufferGeometryUtils-gzGtEl-O.js","assets/CommandPanel-C1G4hHBN.js","assets/CommandPanel-DDfcwZ2Q.js","assets/CommandPanel-DK28u3aQ.js","assets/CoreAbilities-DqBPoj01.js","assets/Editor-BWNwwzmb.js","assets/EventSeat-oHwso5yr.js","assets/EventsUI-B6BJuyMc.js","assets/FigureLibrary-BPeXnRwP.js","assets/Game-BtQHKeIC.js","assets/GameScreen-CliUUqd0.js","assets/MailLobby-DQfmnd-H.js","assets/Miniatures-YsAM-H5C.js","assets/NextApp-BL_lBddZ.js","assets/NextApp-DTjdDICv.css","assets/OpenTables-DmH3cOB8.js","assets/Packages-C9Bike7G.js","assets/PhotoMatch-Dbv_gEUf.js","assets/PlayerCard-BgnHSdTv.js","assets/Qd6Card-C3IKdZBR.js","assets/Qd6Card-Cmi0pvKE.js","assets/Qd6Card-Cu_uTjav.js","assets/RankedGame-DPJh2Bg6.js","assets/RoundPanel-BW_-MHRm.js","assets/RoundPanel-BiPJRmsx.js","assets/RoundPanel-DmZx2437.js","assets/RulesPage-CO6IHjwc.js","assets/StandeeMaker-B7Vqvpj2.js","assets/TeachRule-KivV-aZZ.js","assets/Workshop-Ctb6SL6-.js","assets/_virtual_sandbox-worker-ry7Mxznx.js","assets/_virtual_soak-worker-DAqhL_lD.js","assets/actions-CrfhGmSU.js","assets/aws4fetch.esm-BLUAl4pF.js","assets/base64-gMTPUZJI.js","assets/board-Vfzwm2Ix.js","assets/book-Cm6hFfzy.js","assets/brinewatch-DN2-OwGh.js","assets/browser-UgmTalj_.js","assets/browser-bopAeLbn.js","assets/charge-ZPBR1pth.js","assets/codec-DOoWeNvh.js","assets/config-Kg6xkhHB.js","assets/core-BNabrLH7.js","assets/de-BGFOjBNP.js","assets/demo-CWrVsqbi.js","assets/dist-WFp3Oeug.js","assets/dist-YYVtoirG.js","assets/dist-lgRNSFRF.js","assets/events-9ce18a08.esm-D-QCksbz.js","assets/faction-D20HuSDu.js","assets/file-qvOJhGA3.js","assets/files-CdfAAl3C.js","assets/fr-CWeHMcK5.js","assets/fxp-CNHNYw_7.js","assets/fxp-DcRaohTd.js","assets/gameLog-dUVNpqyi.js","assets/hooks-BGVj5mdP.js","assets/hooks-ChK-d2fV.js","assets/hooks-DYJp08P0.js","assets/http-r2VkB6Qm.js","assets/idb-OWIpJU7O.js","assets/index-Chj8U0ni.css","assets/index-Cpjz3ikg.js","assets/jsx-runtime-NZYk81nU.js","assets/keys-D-MKR9PG.js","assets/layout-NGRZzNsU.js","assets/lesson-BN8p8SAt.js","assets/levels-DlkUqTaf.js","assets/lit-n-Yt9ZNS.js","assets/live-BuDTKIJ6.js","assets/local-DYm8hz2T.js","assets/mailbox-BnuZeWoJ.js","assets/manifest-BRIPGYy3.js","assets/meshShape-YshOJHKF.js","assets/nostr-Dj6dP1eB.js","assets/open-DQ_sx1tI.js","assets/open-Z0phF1iv.js","assets/pack-D6ehdzqF.js","assets/packPins-Dhwc9jt3.js","assets/packageChange-Be729-6H.js","assets/page-CB1aoQrF.js","assets/play-B4-iche9.js","assets/post-CxU4YYRW.js","assets/preload-helper-BaNbYf_w.js","assets/printPlay-DoGirMqW.js","assets/react-Bu-9VsiK.js","assets/react-Cvdyeg_0.js","assets/react-LRsbgCie.js","assets/react-dom-B-VxWsjA.js","assets/react-hsrUxga6.js","assets/relayBusy-DoHBJB33.js","assets/replayFile-Cfw1nPtk.js","assets/report-W1NnoIMn.js","assets/rift-lanterns-DLDKmR7R.js","assets/rolldown-runtime-hePW80VL.js","assets/roster-CVZButfQ.js","assets/route-Db_cX77P.js","assets/rulebook-DYk1I3nk.js","assets/scheduler-C784v2VA.js","assets/secp256k1-yVjC_Axf.js","assets/shelfActions-DyUy_Q7F.js","assets/showcase-BVyZ9Omh.js","assets/site-CHb1xoFU.js","assets/standIns-BTEgtfF8.js","assets/start-B2Pm_oYt.js","assets/store-B90VA40d.js","assets/store-COyS_vCM.js","assets/store-Cjes_wUL.js","assets/store-CoNfyLfg.js","assets/store-DhxMp8gj.js","assets/store-m6ye9wLA.js","assets/syntax-CEL_Wvla.js","assets/systemLabels-DmKTs4zV.js","assets/systems-B4jIv2ly.js","assets/systems-CXI-XXGY.js","assets/systems-DEAKqRPB.js","assets/talk-Dqm0Zyga.js","assets/three.module-DD1TOtOx.js","assets/thumb-BDBilZyk.js","assets/trystero-CQejBhJ5.js","assets/trystero-LIsX6Feh.js","assets/webtorrent.min-DeIqevk6.js","assets/worker-7P9M74VE.js","assets/worker-BAs-g7JU.js","assets/worker-CtrB5Iye.js","assets/worker-DV1DuzPc.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","icons/maskable-512.png","index.html","manifest.webmanifest"];
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
