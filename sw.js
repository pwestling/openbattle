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
const VERSION = "bf65aafa61d5";
const FILES = ["assets/Board-xMgOH0mF.js","assets/Branch-DPvS2370.js","assets/BufferGeometryUtils-gzGtEl-O.js","assets/CommandPanel-4nsoGmyH.js","assets/CommandPanel-DAo3eCmS.js","assets/CommandPanel-Dr9a_3Qf.js","assets/CoreAbilities-CZP45Yg2.js","assets/Editor-IlO0lNV4.js","assets/EventSeat-Ct4bzKwm.js","assets/EventsUI-AGCFhibq.js","assets/FigureLibrary-SM3g39UH.js","assets/Game-BVpbUGCS.js","assets/GameScreen-DzM3I6se.js","assets/MailLobby-BnWocSAy.js","assets/Miniatures-DNcH7vFk.js","assets/NextApp-C6C3HxyA.css","assets/NextApp-DlcWUBe2.js","assets/OpenTables-OuliUpcx.js","assets/Packages-BAhYfqWe.js","assets/PhotoMatch-CkG9ocan.js","assets/PlayerCard-DxU01DFO.js","assets/Qd6Card-Bz1EkJdY.js","assets/Qd6Card-CpxJ9LVu.js","assets/Qd6Card-D3NNsEXt.js","assets/RankedGame-t3uhzd6n.js","assets/RoundPanel-BLEAZRJo.js","assets/RoundPanel-D8x1VDO2.js","assets/RoundPanel-HIKhkGF_.js","assets/RulesPage-97MSo5sY.js","assets/StandeeMaker-Cnr0HUgf.js","assets/TeachRule-B1dgIrJF.js","assets/Workshop-4QKhLKlU.js","assets/_virtual_sandbox-worker-D7LJ9lgH.js","assets/_virtual_soak-worker-BWaqF-CP.js","assets/actions-DJWC_79W.js","assets/aws4fetch.esm-BLUAl4pF.js","assets/base64-gMTPUZJI.js","assets/board-B8ksHqEL.js","assets/book-BFQBEwWU.js","assets/brinewatch-DN2-OwGh.js","assets/browser-UgmTalj_.js","assets/browser-bopAeLbn.js","assets/charge-C5lADlel.js","assets/codec-DOoWeNvh.js","assets/config-Kg6xkhHB.js","assets/core-TAh7tNY5.js","assets/de-Chd7Tl-0.js","assets/demo-CHsZDJYw.js","assets/dist-WFp3Oeug.js","assets/dist-YYVtoirG.js","assets/dist-lgRNSFRF.js","assets/events-9ce18a08.esm-D-QCksbz.js","assets/faction-DRrpzR5L.js","assets/file-qvOJhGA3.js","assets/files-CdfAAl3C.js","assets/fr-BtCICrA1.js","assets/fxp-CNHNYw_7.js","assets/fxp-DcRaohTd.js","assets/gameLog-Dz-zg-Z0.js","assets/hooks-CayXpn0l.js","assets/hooks-D56AUHtF.js","assets/hooks-xXCKSc6a.js","assets/http-DXBhDLDH.js","assets/idb-OWIpJU7O.js","assets/index-Chj8U0ni.css","assets/index-D9qC1Syd.js","assets/jsx-runtime-NZYk81nU.js","assets/keys-D-MKR9PG.js","assets/layout-BJZ0_pUA.js","assets/lesson-D_2oJAQa.js","assets/levels-DlkUqTaf.js","assets/lit-n-Yt9ZNS.js","assets/live-D5o5yyqA.js","assets/local-GsUdvVFa.js","assets/mailbox-CnjjhzeY.js","assets/manifest-BRIPGYy3.js","assets/meshShape-Cs7XZKRx.js","assets/nostr-JhobV8o-.js","assets/open-Ch5E989E.js","assets/open-Z0phF1iv.js","assets/pack-BldpmvF0.js","assets/packPins-CgmFDWTn.js","assets/packageChange-Be729-6H.js","assets/page-BqqUTftS.js","assets/play-cERQtrDA.js","assets/post-DyHHGBkS.js","assets/preload-helper-BaNbYf_w.js","assets/printPlay-CSRPq7jj.js","assets/react-Bu-9VsiK.js","assets/react-Cvdyeg_0.js","assets/react-LRsbgCie.js","assets/react-dom-B-VxWsjA.js","assets/react-hsrUxga6.js","assets/relayBusy-DoHBJB33.js","assets/replayFile-C1blJUt8.js","assets/report-BXXGFU01.js","assets/rift-lanterns-DLDKmR7R.js","assets/rolldown-runtime-hePW80VL.js","assets/roster-CVZButfQ.js","assets/route-BcOs2jcM.js","assets/rulebook-DYk1I3nk.js","assets/scheduler-C784v2VA.js","assets/secp256k1-yVjC_Axf.js","assets/shelfActions-BywAILCW.js","assets/showcase-BVyZ9Omh.js","assets/site-CHb1xoFU.js","assets/standIns-BTEgtfF8.js","assets/start-Dtd8-roc.js","assets/store-BtONWRmn.js","assets/store-CANfxLE0.js","assets/store-CQqKNewm.js","assets/store-Cc1MLJga.js","assets/store-DZD70Xw7.js","assets/store-jqvJxkd7.js","assets/syntax-CEL_Wvla.js","assets/systemLabels-C5pv3gzx.js","assets/systems-BdnNgkZE.js","assets/systems-CtDJBZe9.js","assets/systems-DPfXB3N_.js","assets/talk-CTH0WtSr.js","assets/three.module-DD1TOtOx.js","assets/thumb-C-1vkKah.js","assets/trystero-B7o7vSAK.js","assets/trystero-DUAGCRo6.js","assets/webtorrent.min-DeIqevk6.js","assets/worker-CNXXNBn1.js","assets/worker-CtrB5Iye.js","assets/worker-DV1DuzPc.js","assets/worker-DifQS8Vg.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","icons/maskable-512.png","index.html","manifest.webmanifest"];
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
