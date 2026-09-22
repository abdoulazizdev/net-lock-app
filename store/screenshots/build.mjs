/**
 * store/screenshots/build.mjs — génère les captures de la fiche Google Play
 *
 *   node store/screenshots/build.mjs
 *
 * Sortie : store/screenshots/out/*.png en 1080 × 1920 (format téléphone Play).
 * Le rendu passe par Chrome headless ; l'interface est reconstruite à partir
 * des tokens de `theme/` et de la police d'icônes de l'app, pour que les
 * visuels montrent l'application telle qu'elle est.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ICON_FONT_BASE64, P, T } from "./kit.mjs";
import * as S from "./screens.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, "out");

const W = 1080;
const H = 1920;
/** Largeur logique de l'app, comme en React Native. */
const UI_W = 390;
const PHONE_W = 768;
const SCREEN_W = PHONE_W - 28;
const SCALE = SCREEN_W / UI_W;

// ─── Les 7 visuels ───────────────────────────────────────────────────────────

const FRAMES = [
  {
    slug: "01-protection",
    title: "Coupez Internet,<br>app par app",
    sub: "Pas de désinstallation, pas de volonté à dépenser : l'app reste là, mais elle n'a plus de réseau.",
    screen: S.home,
  },
  {
    slug: "02-apps",
    title: "Un interrupteur<br>par application",
    sub: "Choisissez ce qui garde Internet. Le reste est coupé à la seconde où vous le décidez.",
    screen: S.apps,
  },
  {
    slug: "03-focus",
    title: "Un Focus<br>qu'on n'annule pas",
    sub: "Lancez la session, rangez le téléphone. Impossible de revenir en arrière avant la fin.",
    screen: S.focus,
  },
  {
    slug: "04-notifications",
    title: "Même plus<br>de notifications",
    sub: "Une app bloquée ne vous notifie plus. Les appels et les alarmes, eux, passent toujours.",
    screen: S.notifications,
  },
  {
    slug: "05-allowlist",
    title: "Tout couper,<br>sauf l'essentiel",
    sub: "Le mode liste blanche ne laisse passer que les apps dont vous avez vraiment besoin.",
    screen: S.allowlist,
  },
  {
    slug: "06-profiles",
    title: "Un profil<br>pour chaque moment",
    sub: "Travail, nuit, révisions. Chaque profil a ses règles et s'active tout seul à l'heure dite.",
    screen: S.profiles,
  },
  {
    slug: "07-stats",
    title: "Voyez le temps<br>que vous regagnez",
    sub: "Chaque connexion coupée est comptée. La série se construit jour après jour.",
    screen: S.stats,
  },
];

// ─── Gabarit ─────────────────────────────────────────────────────────────────

function page(frame) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>
@font-face { font-family: "MCI"; src: url(data:font/ttf;base64,${ICON_FONT_BASE64}) format("truetype"); }
.mci { font-family: "MCI"; font-style: normal; line-height: 1; display: inline-block; }

* { box-sizing: border-box; -webkit-font-smoothing: antialiased; }
body {
  margin: 0; width: ${W}px; height: ${H}px; overflow: hidden;
  font-family: "Inter", "Segoe UI", system-ui, -apple-system, sans-serif;
}

/* ── Fond de la capture ─────────────────────────────────────────────── */
.frame {
  position: relative; width: ${W}px; height: ${H}px; overflow: hidden;
  background:
    radial-gradient(900px 620px at 84% 6%, ${P.violet[600]}66 0%, transparent 62%),
    radial-gradient(760px 560px at 6% 40%, ${P.brand[500]}4D 0%, transparent 58%),
    linear-gradient(168deg, ${P.brand[900]} 0%, #0F1230 52%, ${P.violet[900]} 100%);
}
.glow {
  position: absolute; left: 50%; top: 392px; transform: translateX(-50%);
  width: 940px; height: 940px; border-radius: 50%;
  background: radial-gradient(circle, ${P.brand[400]}2E 0%, transparent 66%);
}

/* ── Accroche ───────────────────────────────────────────────────────── */
.caption { position: relative; padding: 104px 88px 0; }
.mark { display: flex; align-items: center; gap: 14px; margin-bottom: 34px; }
.markDot {
  width: 46px; height: 46px; border-radius: 15px; display: grid; place-items: center;
  background: linear-gradient(145deg, ${P.brand[500]}, ${P.violet[500]});
  box-shadow: 0 8px 22px ${P.brand[700]}80;
}
.markName { font-size: 25px; font-weight: 800; color: #fff; letter-spacing: 3.2px; }
.caption h1 {
  margin: 0; font-size: 78px; line-height: 1.06; font-weight: 800;
  letter-spacing: -2.6px; color: #fff;
}
.caption p {
  margin: 30px 0 0; max-width: 860px; font-size: 31px; line-height: 1.42;
  font-weight: 500; color: rgba(255,255,255,0.62);
}

/* ── Téléphone ──────────────────────────────────────────────────────── */
.phone {
  position: absolute; left: 50%; top: 486px; transform: translateX(-50%);
  width: ${PHONE_W}px; height: ${H - 486 + 40}px; padding: 14px 14px 0;
  border-radius: 66px 66px 0 0; background: #090B12;
  box-shadow: 0 -2px 0 rgba(255,255,255,0.10) inset, 0 50px 110px rgba(0,0,0,0.55);
}
.screen {
  width: ${SCREEN_W}px; height: 100%; border-radius: 54px 54px 0 0;
  overflow: hidden; background: ${T.page}; position: relative;
}
.ui {
  width: ${UI_W}px; transform: scale(${SCALE}); transform-origin: top left;
  /* Hauteur visible exacte : la barre d'onglets affleure le bas du visuel
     au lieu d'être coupée en deux. */
  height: ${Math.round((H - 486 - 14) / SCALE)}px;
  display: flex; flex-direction: column; background: ${T.page};
}

/* ── Typographie de l'app (theme/tokens.ts) ─────────────────────────── */
.title1 { font-size: 26px; line-height: 32px; font-weight: 800; letter-spacing: -0.7px; color: ${T.textPrimary}; }
.title2 { font-size: 21px; line-height: 27px; font-weight: 700; letter-spacing: -0.45px; color: ${T.textPrimary}; }
.title3 { font-size: 17px; line-height: 23px; font-weight: 700; letter-spacing: -0.25px; color: ${T.textPrimary}; }
.headline { font-size: 15px; line-height: 21px; font-weight: 700; color: ${T.textPrimary}; }
.bodyStrong { font-size: 15px; line-height: 22px; font-weight: 600; color: ${T.textPrimary}; }
.body { font-size: 15px; line-height: 22px; font-weight: 400; color: ${T.textPrimary}; }
.footnote { font-size: 12.5px; line-height: 17px; font-weight: 500; color: ${T.textSecondary}; }
.overline { font-size: 10.5px; line-height: 14px; font-weight: 800; letter-spacing: 0.9px; text-transform: uppercase; color: ${T.textMuted}; }
.muted { color: ${T.textMuted}; } .secondary { color: ${T.textSecondary}; }
.faint { color: ${T.textFaint}; } .center { text-align: center; }
.grow { flex: 1; display: flex; flex-direction: column; gap: 1px; min-width: 0; }

/* ── Chrome de l'écran ──────────────────────────────────────────────── */
.statusbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 22px 6px; font-size: 12.5px; font-weight: 700; color: ${T.textPrimary};
}
.sbIcons { display: flex; gap: 5px; align-items: center; }
.scroll { flex: 1; padding: 4px 16px 12px; display: flex; flex-direction: column; gap: 18px; overflow: hidden; }
.homeHeader { display: flex; align-items: center; justify-content: space-between; padding: 6px 0 2px; }
.headerRight { display: flex; align-items: center; gap: 8px; }
.proBtn {
  background: ${P.violet[600]}; color: #fff; font-size: 13px; font-weight: 700;
  padding: 9px 15px; border-radius: 11px; display: flex; align-items: center; gap: 5px;
}
.proBtn.small { padding: 8px 13px; font-size: 12.5px; }
.iconBtn { width: 35px; height: 35px; border-radius: 11px; background: ${T.cardAlt}; border: 1px solid ${T.borderNormal}; display: grid; place-items: center; }
.appbar { display: flex; align-items: center; gap: 10px; padding: 8px 16px 10px; }
.appbarBtn { width: 32px; height: 32px; border-radius: 10px; background: ${T.cardAlt}; display: grid; place-items: center; }
.appbarTitle { font-size: 19px; font-weight: 700; letter-spacing: -0.4px; color: ${T.textPrimary}; }
.appbarSpacer { flex: 1; }

/* ── Composants ─────────────────────────────────────────────────────── */
.card { background: ${T.card}; border: 1px solid ${T.borderLight}; border-radius: 14px; padding: 14px; display: flex; flex-direction: column; gap: 12px; }
.card.list { padding: 0; gap: 0; }
.section { display: flex; flex-direction: column; gap: 8px; }
.sectionHead { display: flex; align-items: center; justify-content: space-between; padding: 0 2px; }
.divider { height: 1px; background: ${T.borderLight}; margin-left: 58px; }
.row { display: flex; align-items: center; gap: 12px; padding: 12px 14px; }
.avatar { display: grid; place-items: center; font-weight: 800; }
.switch { width: 44px; height: 26px; border-radius: 13px; background: ${T.borderNormal}; padding: 3px; display: flex; flex-shrink: 0; }
.switch .knob { width: 20px; height: 20px; border-radius: 10px; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.25); }
.switch.on { justify-content: flex-end; }
.badge { font-size: 10.5px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; padding: 3px 8px; border-radius: 7px; border: 1px solid; }
.pill { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 600; color: ${T.textMuted}; background: ${T.cardAlt}; padding: 5px 10px; border-radius: 9px; }
.pill.on { background: ${T.allowed.bg}; color: ${T.allowed.text}; }
.pillRow { display: flex; gap: 6px; }

.shieldCard { background: linear-gradient(150deg, ${T.brandSoft}, ${T.card} 62%); border-color: ${T.brandSoftBorder}; }
.shieldRow { display: flex; align-items: center; gap: 12px; }
.shieldIcon { width: 52px; height: 52px; border-radius: 16px; display: grid; place-items: center; background: linear-gradient(145deg, ${P.green[400]}, ${P.green[600]}); flex-shrink: 0; }

.band { display: flex; align-items: stretch; background: ${T.cardAlt}; border: 1px solid ${T.borderLight}; border-radius: 14px; padding: 12px 0; }
.bandItem { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 0 4px; text-align: center; }
.bandSep { width: 1px; background: ${T.borderNormal}; }
.statValue { font-size: 21px; font-weight: 800; letter-spacing: -0.45px; font-variant-numeric: tabular-nums; color: ${T.textPrimary}; }
.statValue.small { font-size: 19px; }

.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.tile { gap: 6px; padding: 14px; }
.tileIcon { width: 34px; height: 34px; border-radius: 10px; border: 1px solid; display: grid; place-items: center; flex-shrink: 0; }
.tileIcon.big { width: 44px; height: 44px; border-radius: 13px; }

.searchField { display: flex; align-items: center; gap: 8px; background: ${T.cardAlt}; border: 1px solid ${T.borderNormal}; border-radius: 12px; padding: 11px 13px; font-size: 14px; }
.chips { display: flex; gap: 7px; }
.chip { font-size: 12.5px; font-weight: 600; padding: 7px 13px; border-radius: 10px; background: ${T.cardAlt}; color: ${T.textSecondary}; border: 1px solid ${T.borderLight}; }
.chip.on { background: ${T.brandSoft}; color: ${T.brand}; border-color: ${T.brandSoftBorder}; }

.profile { gap: 10px; }
.profile.on { border-color: ${T.allowed.border}; background: linear-gradient(150deg, ${T.allowed.bg}, ${T.card} 70%); }
.titleRow { display: flex; align-items: center; gap: 8px; }
.scheduleRow { display: flex; align-items: center; gap: 6px; padding-top: 10px; border-top: 1px solid ${T.borderLight}; }

.chart { display: flex; align-items: flex-end; justify-content: space-between; gap: 8px; height: 110px; padding-top: 6px; }
.barCol { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; justify-content: flex-end; }
.bar { width: 100%; border-radius: 6px 6px 3px 3px; }
.meter { height: 5px; border-radius: 3px; background: ${T.cardSunken}; margin-top: 5px; overflow: hidden; }
.meterFill { height: 100%; border-radius: 3px; background: ${T.blocked.accent}; }

.focusScreen { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 26px 26px 0; background: linear-gradient(180deg, ${T.focus.bg}, ${T.page} 58%); }
.focusBadge { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 800; letter-spacing: 0.6px; text-transform: uppercase; color: ${T.focus.text}; background: #fff; border: 1px solid ${T.focus.border}; padding: 7px 13px; border-radius: 999px; }
.ring { position: relative; width: 228px; height: 228px; margin: 6px 0; }
.ringText { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; }
.ringTime { font-size: 46px; font-weight: 800; letter-spacing: -1.6px; font-variant-numeric: tabular-nums; color: ${T.textPrimary}; }
.focusStats { display: flex; align-items: stretch; gap: 14px; background: #fff; border: 1px solid ${T.borderLight}; border-radius: 14px; padding: 12px 18px; margin-top: 4px; }
.focusStats > div:not(.bandSep) { display: flex; flex-direction: column; align-items: center; gap: 1px; min-width: 62px; }
.focusStats > .bandSep { width: 1px; min-width: 1px; flex: 0 0 1px; }
.durations { display: flex; gap: 8px; margin-top: 4px; }
.duration { font-size: 13px; font-weight: 700; padding: 9px 15px; border-radius: 11px; background: #fff; border: 1px solid ${T.borderLight}; color: ${T.textSecondary}; }
.duration.on { background: ${T.focus.accent}; border-color: ${T.focus.accent}; color: #fff; }

.ghostBtn { display: flex; align-items: center; justify-content: center; gap: 7px; font-size: 14px; font-weight: 700; color: ${T.brand}; background: ${T.card}; border: 1px solid ${T.brandSoftBorder}; border-radius: 12px; padding: 13px; }
.killed { padding: 0; opacity: .38; filter: grayscale(0.6); }
.killedTag { display: flex; align-items: center; gap: 6px; padding-top: 10px; border-top: 1px dashed ${T.blocked.border}; }

.tabbar { display: flex; align-items: center; justify-content: space-around; padding: 9px 0 16px; background: ${T.card}; border-top: 1px solid ${T.borderLight}; }
.tab { display: flex; flex-direction: column; align-items: center; gap: 3px; font-size: 10px; font-weight: 700; letter-spacing: 0.4px; text-transform: uppercase; }
.tab .tabIcon { width: 46px; height: 26px; border-radius: 13px; display: grid; place-items: center; }
.tab.on .tabIcon { background: ${T.brandSoft}; }
</style></head><body>
<div class="frame">
  <div class="glow"></div>
  <div class="caption">
    <div class="mark">
      <div class="markDot"><svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M12 2.6 20 5.8v6c0 4.7-3.2 8.3-8 9.6-4.8-1.3-8-4.9-8-9.6v-6L12 2.6Z" fill="#fff"/>
        <path d="M8.4 12.2l2.6 2.6 4.8-5" stroke="${P.brand[600]}" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      </svg></div>
      <span class="markName">NETOFF</span>
    </div>
    <h1>${frame.title}</h1>
    <p>${frame.sub}</p>
  </div>
  <div class="phone"><div class="screen"><div class="ui">${frame.screen()}</div></div></div>
</div>
</body></html>`;
}

// ─── Rendu ───────────────────────────────────────────────────────────────────

const CHROME =
  process.env.CHROME_BIN ??
  ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"].find((p) =>
    fs.existsSync(p),
  );

if (!CHROME) {
  console.error("Chrome introuvable — définissez CHROME_BIN.");
  process.exit(1);
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

for (const frame of FRAMES) {
  const html = path.join(OUT, `${frame.slug}.html`);
  const png = path.join(OUT, `${frame.slug}.png`);
  fs.writeFileSync(html, page(frame));
  execFileSync(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      `--window-size=${W},${H}`,
      `--screenshot=${png}`,
      `--virtual-time-budget=2500`,
      html,
    ],
    { stdio: "ignore" },
  );
  fs.unlinkSync(html);
  const kb = Math.round(fs.statSync(png).size / 1024);
  console.log(`✓ ${frame.slug}.png — ${W}×${H} (${kb} Ko)`);
}

console.log(`\n${FRAMES.length} captures dans ${path.relative(process.cwd(), OUT)}/`);
