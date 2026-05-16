// ── SHARED — Okey Yazboz ──

// Firebase uygulama başlatma fonksiyonu
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";

// Realtime Database fonksiyonları (okuma, referans alma, dinleme)
import { getDatabase, ref, get, onValue } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-database.js";


// Firebase uygulamasını başlat ve database instance oluştur
export const db = getDatabase(initializeApp({
    apiKey: "AIzaSyB260gH5PPH1Q-xeZL2n0V8arTY3Bryjm0",
    authDomain: "yazboz-eabbf.firebaseapp.com",
    databaseURL: "https://yazboz-eabbf-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "yazboz-eabbf",
    storageBucket: "yazboz-eabbf.firebasestorage.app",
    messagingSenderId: "552083841936",
    appId: "1:552083841936:web:97e6076c246706d6e44915"
}));


// Oyuncu listesi (sabit)
export const PLAYERS = ["Serkan", "Deniz", "Fırat", "Berkay"];

// Oyunun başlangıç skorları
export const START = [20, 20, 20, 20];


// Bugünün tarihini YYYY-MM-DD formatında döndürür
export function todayKey() {
    const d = new Date();

    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")
        }-${String(d.getDate()).padStart(2, "0")
        }`;
}

// Skor tablosunu render eder
export function renderScoreTable(state, panelId) {

    const scoreTable = document.getElementById("scoreTable");

    const src = state.scores;

    // Oyun bitmişse final sıralama hesapla
    const ranking = state.finalRanking || (
        state.finished
            ? [...src]
                .map((s, i) => ({ i, s }))
                .sort((a, b) => b.s - a.s)
                .map(r => r.i)
            : null
    );

    // Başlangıç satırı + oyun içi satırlar
    scoreTable.innerHTML =
        `<tr><td>0</td>${START.map(s => `<td>${s}</td>`).join("")}</tr>` +
        state.rows.map(r =>
            `<tr><td>${r.round}</td>` +
            r.scores.map((s, i) =>
                i === r.player
                    ? `<td style="color:red;font-weight:bold">
                        ${r.value > 0 ? "+" : ""}${r.value}
                      </td>`
                    : `<td>${s}</td>`
            ).join("") +
            `</tr>`
        ).join("");

    // Oyun bittiyse final sonuç satırı ekle
    if (state.finished && ranking) {

        const icons = ["🥇", "🥈", "", ""];

        scoreTable.innerHTML +=
            `<tr class="resultsRow"><td></td>` +
            src.map((s, i) => {
                const rank = ranking.indexOf(i);

                return `<td>${s}${icons[rank] ? "<br>" + icons[rank] : ""}</td>`;
            }).join("") +
            `</tr>`;
    }
}

// Oyun durum barını UI üzerinde günceller
export function renderGameStatus(gameNumber, state) {

    // DOM elementini bul
    const bar = document.getElementById("gameStatusBar");

    // Element yoksa çık
    if (!bar) return;

    // Oyun yoksa ve round 0 ise temizle
    if (!gameNumber && state.round === 0) {
        bar.textContent = "";
        return;
    }

    // Oyun numarası yazısı
    const gn = gameNumber ? `${gameNumber}. oyun` : "oyun";

    // Oyun bitmiş mi kontrol et ve UI yazısını ayarla
    bar.textContent = state.finished
        ? `${gn} — bitti`
        : `${gn}  ·  ${state.round}. el`;
}


// Günlük ve lig istatistiklerini çeker ve ekrana basar
export async function renderStatsEngine(db, targets = {}) {

    // Madalya ikonları (ilk 3 için)
    const icons = ["🥇", "🥈", "🥉", ""];

    // Veriyi tablo satırlarına çeviren yardımcı fonksiyon
    const makeRows = (data) => {

        // Veri yoksa mesaj göster
        if (!data) return `<div class="stats-entry" style="color:#555">Veri yok</div>`;

        // Skorlara göre büyükten küçüğe sırala
        return Object.entries(data)
            .sort((a, b) => b[1] - a[1])
            .map(([name, score], i) =>
                `<div class="stats-entry">
                    <span>${icons[i] || ""} ${name}</span>
                    <span>${score}</span>
                </div>`
            ).join("");
    };

    // Firebase'den aynı anda iki veri çek
    const [daySnap, leagueSnap] = await Promise.all([
        get(ref(db, "days/" + todayKey() + "/scores")),
        get(ref(db, "league"))
    ]);

    // Bugünün verisini bas
    if (targets.today)
        targets.today.innerHTML = makeRows(daySnap.exists() ? daySnap.val() : null);

    // Lig verisini bas
    if (targets.league)
        targets.league.innerHTML = makeRows(leagueSnap.exists() ? leagueSnap.val() : null);
}





// Aktif oyun state yönetimi
let currentGameId = null;
let gameUnsub = null;


// Realtime oyun dinleyicisini bağlar
export function bindRealtimeGame(db, onStateChange) {

    // currentGameId değişimini dinle
    onValue(ref(db, "currentGameId"), snap => {

        const newGameId = snap.exists() ? snap.val() : null;

        // Aynı oyun ise tekrar işlem yapma
        if (newGameId === currentGameId) return;

        currentGameId = newGameId;

        // Oyun yoksa listener temizle
        if (!currentGameId) {
            if (gameUnsub) gameUnsub();
            gameUnsub = null;

            onStateChange(null);
            return;
        }

        // Yeni oyuna bağlan
        attachGame(db, currentGameId, onStateChange);
    });
}


// Belirli bir oyunun realtime listener'ını bağlar
function attachGame(db, gameId, onStateChange) {

    // Eski listener varsa kapat
    if (gameUnsub) gameUnsub();

    const gameRef = ref(db, "games/" + gameId);

    // Game verisini realtime dinle
    gameUnsub = onValue(gameRef, snap => {

        if (!snap.exists()) return;

        const g = snap.val();

        // UI’a sade state gönder
        onStateChange({
            scores: g.scores || [],
            rows: g.rows ? Object.values(g.rows) : [],
            round: g.round || 0,
            finished: g.finished || false,
            finalRanking: g.finalRanking || null,
            gameNumber: g.gameNumber || null
        });
    });
}


// bindRealtimeGame ve bindRealtimeHistory dışa aktarılıyor
export { bindRealtimeGame as bindGame, bindRealtimeHistory as bindHistory };


// Geçmiş oyunları realtime dinler
export function bindRealtimeHistory(db, onUpdate) {

    onValue(ref(db, "history"), snap => {

        // Veri yoksa boş array dön
        if (!snap.exists()) {
            onUpdate([]);
            return;
        }

        // Tarihe göre yeniden eskiye sırala
        const entries = Object.values(snap.val())
            .sort((a, b) => b.ts - a.ts);

        onUpdate(entries);
    });
}