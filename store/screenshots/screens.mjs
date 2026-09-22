/**
 * store/screenshots/screens.mjs — les écrans de l'app, à 390 pt de large
 *
 * Chaque fonction reproduit un écran réel avec les composants de `kit.mjs`.
 * Les chiffres affichés sont des exemples plausibles, l'agencement est celui
 * de l'application.
 */

import { T, TONE, appAvatar, appBar, badge, icon, section, tabBar, toggle } from "./kit.mjs";

const statusBar = `<div class="statusbar">
  <span class="sbTime">9:41</span>
  <span class="sbIcons">${icon("wifi", 13, T.textPrimary)} ${icon("signal", 13, T.textPrimary)} ${icon("battery", 13, T.textPrimary)}</span>
</div>`;

const APPS = [
  { name: "Instagram", letter: "I", hue: 330, blocked: true, detail: "142 connexions coupées" },
  { name: "TikTok", letter: "T", hue: 190, blocked: true, detail: "98 connexions coupées" },
  { name: "YouTube", letter: "Y", hue: 0, blocked: true, detail: "61 connexions coupées" },
  { name: "X", letter: "X", hue: 220, blocked: true, detail: "44 connexions coupées" },
  { name: "WhatsApp", letter: "W", hue: 140, blocked: false, detail: "Autorisée" },
  { name: "Gmail", letter: "G", hue: 10, blocked: false, detail: "Autorisée" },
  { name: "Reddit", letter: "R", hue: 25, blocked: true, detail: "37 connexions coupées" },
  { name: "Maps", letter: "M", hue: 95, blocked: false, detail: "Autorisée" },
];

// ─── 1. Accueil ──────────────────────────────────────────────────────────────

export function home() {
  const quick = [
    { icon: "target", label: "Focus", hint: "Bloquer sans retour en arrière", tone: "focus" },
    { icon: "timer-outline", label: "Minuterie", hint: "Couper les distractions", tone: "brand" },
    { icon: "playlist-check", label: "Liste blanche", hint: "Tout bloquer sauf quelques apps", tone: "info" },
    { icon: "account-multiple-outline", label: "Profils", hint: "3 profils enregistrés", tone: "allowed" },
  ];
  return `${statusBar}
  <div class="scroll">
    <div class="homeHeader">
      <span class="title1">NetOff</span>
      <div class="headerRight">
        <div class="proBtn">Passer Pro</div>
        <div class="iconBtn">${icon("cog-outline", 19, T.textSecondary)}</div>
      </div>
    </div>

    <div class="card shieldCard">
      <div class="shieldRow">
        <div class="shieldIcon">${icon("shield-check", 30, "#fff")}</div>
        <div class="grow">
          <span class="title3">Protection active</span>
          <span class="footnote muted">12 apps privées d'Internet</span>
        </div>
        ${toggle(true, "allowed")}
      </div>
      <div class="pillRow">
        <span class="pill on">${icon("check-circle", 12, T.allowed.accent)} Tunnel actif</span>
        <span class="pill">${icon("clock-outline", 12, T.textMuted)} depuis 3 h 12</span>
      </div>
    </div>

    ${section(
      "Depuis le début",
      `<div class="band">
        <div class="bandItem"><span class="statValue" style="color:${T.blocked.accent}">1 284</span><span class="overline muted">connexions<br>coupées</span></div>
        <div class="bandSep"></div>
        <div class="bandItem"><span class="statValue" style="color:${T.focus.accent}">7</span><span class="overline muted">jours<br>de suite</span></div>
        <div class="bandSep"></div>
        <div class="bandItem"><span class="statValue" style="color:${T.allowed.accent}">9 h 40</span><span class="overline muted">temps<br>regagné</span></div>
      </div>`,
    )}

    ${section(
      "Actions rapides",
      `<div class="grid2">${quick
        .map(
          (q) => `<div class="card tile">
            <div class="tileIcon" style="background:${TONE[q.tone].bg};border-color:${TONE[q.tone].border}">
              ${icon(q.icon, 20, TONE[q.tone].accent)}
            </div>
            <span class="headline">${q.label}</span>
            <span class="footnote muted">${q.hint}</span>
          </div>`,
        )
        .join("")}</div>`,
    )}
  </div>
  ${tabBar("home")}`;
}

// ─── 2. Applications ─────────────────────────────────────────────────────────

export function apps() {
  return `${statusBar}
  <div class="scroll">
    <div class="homeHeader"><span class="title1">Applications</span>
      <div class="headerRight"><div class="iconBtn">${icon("filter-variant", 19, T.textSecondary)}</div></div>
    </div>
    <div class="searchField">${icon("magnify", 17, T.textMuted)}<span class="muted">Rechercher une app…</span></div>
    <div class="chips">
      <span class="chip on">Toutes</span>
      <span class="chip">Bloquées · 12</span>
      <span class="chip">Autorisées</span>
    </div>
    <div class="card list">
      ${APPS.map(
        (a, i) => `${i ? '<div class="divider"></div>' : ""}
        <div class="row">
          ${appAvatar(a.letter, a.hue)}
          <div class="grow">
            <span class="bodyStrong">${a.name}</span>
            <span class="footnote" style="color:${a.blocked ? T.blocked.text : T.textMuted}">${a.detail}</span>
          </div>
          ${toggle(a.blocked, "blocked")}
        </div>`,
      ).join("")}
    </div>
  </div>
  ${tabBar("apps")}`;
}

// ─── 3. Focus ────────────────────────────────────────────────────────────────

export function focus() {
  return `${statusBar}
  <div class="focusScreen">
    <div class="focusBadge">${icon("lock", 12, T.focus.text)} Session verrouillée</div>
    <div class="ring">
      <svg width="228" height="228" viewBox="0 0 228 228">
        <circle cx="114" cy="114" r="102" fill="none" stroke="${T.cardSunken}" stroke-width="14"/>
        <circle cx="114" cy="114" r="102" fill="none" stroke="${T.focus.accent}" stroke-width="14"
          stroke-linecap="round" stroke-dasharray="641" stroke-dashoffset="176"
          transform="rotate(-90 114 114)"/>
      </svg>
      <div class="ringText">
        <span class="ringTime">18:24</span>
        <span class="overline muted">restantes</span>
      </div>
    </div>
    <span class="title2">Focus en cours</span>
    <span class="body secondary center">Impossible d'arrêter avant la fin.<br>C'est tout l'intérêt.</span>
    <div class="focusStats">
      <div><span class="statValue small">37</span><span class="overline muted">coupées</span></div>
      <div class="bandSep"></div>
      <div><span class="statValue small">25</span><span class="overline muted">minutes</span></div>
      <div class="bandSep"></div>
      <div><span class="statValue small">12</span><span class="overline muted">apps</span></div>
    </div>
    <div class="durations">
      ${["15", "25", "45", "60"].map((d, i) => `<span class="duration ${i === 1 ? "on" : ""}">${d} min</span>`).join("")}
    </div>
    <div class="card list" style="width:100%;margin-top:6px">
      ${APPS.slice(0, 3)
        .map(
          (a, i) => `${i ? '<div class="divider"></div>' : ""}
        <div class="row">${appAvatar(a.letter, a.hue, 34)}
          <div class="grow"><span class="bodyStrong">${a.name}</span>
          <span class="footnote" style="color:${T.blocked.text}">Coupée pendant la session</span></div>
          ${icon("wifi-off", 18, T.blocked.accent)}
        </div>`,
        )
        .join("")}
    </div>
  </div>`;
}

// ─── 4. Liste blanche ────────────────────────────────────────────────────────

export function allowlist() {
  const allowed = [
    { name: "Téléphone", letter: "T", hue: 140 },
    { name: "Messages", letter: "M", hue: 200 },
    { name: "Maps", letter: "M", hue: 20 },
    { name: "Banque", letter: "B", hue: 260 },
    { name: "Agenda", letter: "A", hue: 30 },
    { name: "Santé", letter: "S", hue: 350 },
  ];
  return `${statusBar}
  ${appBar("Liste blanche", { back: true })}
  <div class="scroll">
    <div class="card" style="background:${T.focus.bg};border-color:${T.focus.border}">
      <div class="shieldRow">
        <div class="shieldIcon" style="background:${T.focus.accent}">${icon("playlist-check", 26, "#fff")}</div>
        <div class="grow">
          <span class="title3">Mode liste blanche</span>
          <span class="footnote muted">Tout est coupé sauf 4 apps</span>
        </div>
        ${toggle(true, "brand")}
      </div>
    </div>
    ${section(
      "Apps autorisées",
      `<div class="card list">
        ${allowed
          .map(
            (a, i) => `${i ? '<div class="divider"></div>' : ""}
          <div class="row">${appAvatar(a.letter, a.hue)}
            <div class="grow"><span class="bodyStrong">${a.name}</span>
            <span class="footnote" style="color:${T.allowed.text}">Internet autorisé</span></div>
            ${icon("check-circle", 20, T.allowed.accent)}
          </div>`,
          )
          .join("")}
      </div>`,
    )}
    ${section(
      "Tout le reste",
      `<div class="card" style="background:${T.blocked.bg};border-color:${T.blocked.border}">
        <div class="row" style="padding:0">
          <div class="tileIcon" style="background:#fff;border-color:${T.blocked.border}">${icon("wifi-off", 18, T.blocked.accent)}</div>
          <div class="grow"><span class="bodyStrong">184 apps coupées</span>
          <span class="footnote muted">Le mode le plus strict de NetOff</span></div>
        </div>
      </div>`,
    )}
    <div class="ghostBtn">${icon("plus", 17, T.brand)} Ajouter une app autorisée</div>
  </div>`;
}

// ─── 5. Notifications bloquées ───────────────────────────────────────────────

export function notifications() {
  const items = [
    ["cloud-off-outline", "Le réseau ne suffit pas", "Une notification push passe par les Services Google Play, jamais par la connexion de l'app."],
    ["bell-cancel-outline", "Le garde la retire", "Dès qu'elle apparaît, tant que l'app est bloquée."],
    ["shield-check-outline", "Jamais les urgences", "Appels entrants, alarmes et système passent toujours."],
  ];
  return `${statusBar}
  ${appBar("Notifications bloquées", { back: true })}
  <div class="scroll">
    <div class="card" style="background:${T.allowed.bg};border-color:${T.allowed.border}">
      <div class="shieldRow">
        <div class="shieldIcon" style="background:${T.allowed.accent}">${icon("bell-cancel-outline", 26, "#fff")}</div>
        <div class="grow"><span class="title3">Garde actif</span>
        <span class="footnote muted">Les apps bloquées ne vous notifient plus</span></div>
        ${toggle(true, "allowed")}
      </div>
    </div>
    <div class="card">
      <div class="row" style="padding:0">
        <div class="grow"><span class="statValue small">327</span>
        <span class="footnote muted">notifications masquées cette semaine</span></div>
        ${icon("bell-off-outline", 26, T.textFaint)}
      </div>
    </div>
    ${section(
      "Comment ça marche",
      `<div class="card list">
        ${items
          .map(
            ([ic, title, body], i) => `${i ? '<div class="divider"></div>' : ""}
          <div class="row">
            <div class="tileIcon" style="background:${T.cardAlt};border-color:${T.borderLight}">${icon(ic, 17, T.brand)}</div>
            <div class="grow"><span class="bodyStrong">${title}</span>
            <span class="footnote muted">${body}</span></div>
          </div>`,
          )
          .join("")}
      </div>`,
    )}
    ${section(
      "Exemple",
      `<div class="card">
        <div class="row killed">
          ${appAvatar("I", 330, 34)}
          <div class="grow"><span class="bodyStrong">Instagram</span>
          <span class="footnote muted">sarah_k a publié une photo</span></div>
          <span class="footnote faint">maintenant</span>
        </div>
        <div class="killedTag">${icon("bell-off-outline", 13, T.blocked.accent)}
          <span class="footnote" style="color:${T.blocked.text}">Retirée par NetOff avant d'apparaître</span>
        </div>
      </div>`,
    )}
    <div class="ghostBtn">${icon("cog-outline", 17, T.brand)} Gérer l'accès dans Android</div>
  </div>`;
}

// ─── 6. Profils ──────────────────────────────────────────────────────────────

export function profiles() {
  const list = [
    { name: "Travail", icon: "briefcase-outline", tone: "brand", apps: "14 apps bloquées", when: "Lun–Ven · 9 h – 18 h", on: true },
    { name: "Nuit", icon: "weather-night", tone: "focus", apps: "22 apps bloquées", when: "Tous les jours · 22 h – 7 h", on: false },
    { name: "Étude", icon: "school-outline", tone: "info", apps: "18 apps bloquées", when: "Manuel", on: false },
    { name: "Repas", icon: "silverware-fork-knife", tone: "warning", apps: "9 apps bloquées", when: "Tous les jours · 12 h – 13 h", on: false },
    { name: "Week-end", icon: "beach", tone: "allowed", apps: "6 apps bloquées", when: "Sam–Dim · 10 h – 20 h", on: false },
  ];
  return `${statusBar}
  <div class="scroll">
    <div class="homeHeader"><span class="title1">Profils</span>
      <div class="headerRight"><div class="proBtn small">${icon("plus", 15, "#fff")} Nouveau</div></div>
    </div>
    ${list
      .map(
        (p) => `<div class="card profile ${p.on ? "on" : ""}">
        <div class="row" style="padding:0">
          <div class="tileIcon big" style="background:${TONE[p.tone].bg};border-color:${TONE[p.tone].border}">
            ${icon(p.icon, 22, TONE[p.tone].accent)}
          </div>
          <div class="grow">
            <div class="titleRow"><span class="title3">${p.name}</span>${p.on ? badge("Actif", "allowed") : ""}</div>
            <span class="footnote muted">${p.apps}</span>
          </div>
          ${toggle(p.on, "allowed")}
        </div>
        <div class="scheduleRow">${icon("calendar-clock", 14, T.textMuted)}<span class="footnote muted">${p.when}</span></div>
      </div>`,
      )
      .join("")}
  </div>
  ${tabBar("profiles")}`;
}

// ─── 7. Statistiques ─────────────────────────────────────────────────────────

export function stats() {
  const bars = [42, 68, 51, 88, 74, 96, 63];
  const days = ["L", "M", "M", "J", "V", "S", "D"];
  return `${statusBar}
  <div class="scroll">
    <div class="homeHeader"><span class="title1">Statistiques</span></div>
    <div class="chips">
      <span class="chip on">7 jours</span><span class="chip">30 jours</span><span class="chip">Tout</span>
    </div>
    <div class="card">
      <span class="overline muted">Connexions coupées</span>
      <div class="chart">
        ${bars
          .map(
            (h, i) => `<div class="barCol">
          <div class="bar" style="height:${h}px;background:${i === 5 ? T.blocked.accent : T.blocked.border}"></div>
          <span class="overline faint">${days[i]}</span></div>`,
          )
          .join("")}
      </div>
    </div>
    <div class="grid2">
      <div class="card tile">
        <div class="tileIcon" style="background:${T.allowed.bg};border-color:${T.allowed.border}">${icon("clock-check-outline", 18, T.allowed.accent)}</div>
        <span class="statValue small">9 h 40</span><span class="overline muted">temps regagné</span>
      </div>
      <div class="card tile">
        <div class="tileIcon" style="background:${T.focus.bg};border-color:${T.focus.border}">${icon("fire", 18, T.focus.accent)}</div>
        <span class="statValue small">7 jours</span><span class="overline muted">série en cours</span>
      </div>
    </div>
    ${section(
      "Plus bloquées",
      `<div class="card list">
        ${APPS.slice(0, 3)
          .map(
            (a, i) => `${i ? '<div class="divider"></div>' : ""}
        <div class="row">${appAvatar(a.letter, a.hue, 34)}
          <div class="grow"><span class="bodyStrong">${a.name}</span>
            <div class="meter"><div class="meterFill" style="width:${[100, 70, 44][i]}%"></div></div>
          </div>
          <span class="footnote" style="color:${T.blocked.text}">${[142, 98, 61][i]}</span>
        </div>`,
          )
          .join("")}
      </div>`,
    )}
  </div>
  ${tabBar("stats")}`;
}
