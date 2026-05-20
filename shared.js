import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getDatabase, ref, get, onValue } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-database.js";

export const db = getDatabase(initializeApp({
    apiKey: "AIzaSyB260gH5PPH1Q-xeZL2n0V8arTY3Bryjm0",
    authDomain: "yazboz-eabbf.firebaseapp.com",
    databaseURL: "https://yazboz-eabbf-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "yazboz-eabbf",
    storageBucket: "yazboz-eabbf.firebasestorage.app",
    messagingSenderId: "552083841936",
    appId: "1:552083841936:web:97e6076c246706d6e44915"
}));

export const PLAYERS = ["Serkan", "Deniz", "Fırat", "Berkay"];
export const START = [20, 20, 20, 20];

export function renderScoreTable(state) {
    const scoreTable = document.getElementById("scoreTable");
    const src = state.scores;
    const ranking = state.finalRanking || (state.finished
        ? [...src].map((s, i) => ({ i, s })).sort((a, b) => b.s - a.s).map(r => r.i)
        : null
    );
    scoreTable.innerHTML =
        `<tr><td>0</td>${START.map(s => `<td>${s}</td>`).join("")}</tr>` +
        state.rows.map(r =>
            `<tr><td>${r.round}</td>` +
            r.scores.map((s, i) => i === r.player
                ? `<td style="color:red;font-weight:bold">${r.value > 0 ? "+" : ""}${r.value}</td>`
                : `<td>${s}</td>`
            ).join("") + `</tr>`
        ).join("");
    if (state.finished && ranking) {
        const icons = ["🥇", "🥈", "💀", "💀"];
        scoreTable.innerHTML += `<tr class="resultsRow"><td></td>` +
            src.map((s, i) => {
                const rank = ranking.indexOf(i);
                return `<td>${s}${icons[rank] ? "<br>" + icons[rank] : ""}</td>`;
            }).join("") + `</tr>`;
    }
}

function makeStats(data) {
    if (!data) return "";
    return Object.entries(data)
        .filter(([name]) => PLAYERS.includes(name))
        .sort((a, b) => b[1] - a[1])
        .map(([name, score]) => `<div style="display:flex;justify-content:space-between"><span>${name}</span><span>${score}</span></div>`)
        .join("");
}

// FIX: renderStatsEngine artık session ve league verisini tek seferde çekiyor (2 istek yerine 1)
export async function renderStatsEngine(db, targets = {}) {
    const sessionKey = targets.sessionKey;
    const [sessionSnap, leagueSnap] = await Promise.all([
        sessionKey ? get(ref(db, "sessions/" + sessionKey + "/scores")) : Promise.resolve({ exists: () => false }),
        get(ref(db, "league"))
    ]);
    const leagueData = leagueSnap.exists() ? leagueSnap.val() : null;
    if (targets.today) targets.today.innerHTML = makeStats(sessionSnap.exists() ? sessionSnap.val() : null);
    // FIX: league verisinden number/startDate meta alanlarını çıkar, sadece skorları geç
    if (targets.league) targets.league.innerHTML = makeStats(leagueData);
    return { leagueData };
}

// FIX: openMenuPanel artık getElementById kullanıyor, implicit global yok
//      ve tek get çağrısıyla session + league meta bilgisini çekiyor
export async function openMenuPanel() {
    const panel = document.getElementById("menuPanel");
    if (panel.style.display === "flex") { panel.style.display = "none"; return; }
    panel.style.display = "flex";

    const sessionHeaderEl   = document.getElementById("sessionHeader");
    const sessionDateCellEl = document.getElementById("sessionDateCell");
    const leagueHeaderEl    = document.getElementById("leagueHeader");
    const leagueDateCellEl  = document.getElementById("leagueDateCell");

    const currentSessionSnap = await get(ref(db, "currentSessionKey"));
    const activeSessionKey = currentSessionSnap.exists() && currentSessionSnap.val() ? currentSessionSnap.val() : null;

    // FIX: session meta + league tek Promise.all ile, ayrı ayrı 4 istek yerine
    const [sessionMetaSnap, leagueSnap] = await Promise.all([
        activeSessionKey ? get(ref(db, "sessions/" + activeSessionKey)) : Promise.resolve({ exists: () => false }),
        get(ref(db, "league"))
    ]);

    const sessionMeta = sessionMetaSnap.exists() ? sessionMetaSnap.val() : null;
    const leagueData  = leagueSnap.exists() ? leagueSnap.val() : null;

    sessionHeaderEl.innerHTML   = `${sessionMeta?.sessionNumber ?? "?"}. Gün`;
    sessionDateCellEl.innerHTML = sessionMeta?.startDate ?? "—";
    leagueHeaderEl.innerHTML    = `${leagueData?.number ?? "?"}. Lig`;
    leagueDateCellEl.innerHTML  = leagueData?.startDate ?? "—";

    const sessionStatsEl = document.getElementById("sessionStats");
    const leagueStatsEl  = document.getElementById("leagueStats");
    if (sessionStatsEl) sessionStatsEl.innerHTML = makeStats(sessionMeta?.scores ?? null);
    if (leagueStatsEl)  leagueStatsEl.innerHTML  = makeStats(leagueData);
}

export function renderGameStatus(gameNumber, state) {
    const bar = document.getElementById("gameStatusBar");
    if (!bar) return;
    if (!gameNumber && state.round === 0) { bar.textContent = "Oyun yok"; return; }
    const gn = gameNumber ? `${gameNumber}. Oyun` : "Oyun";
    bar.textContent = state.finished ? `${gn} bitti` : `${gn} - ${state.round}. El`;
}
