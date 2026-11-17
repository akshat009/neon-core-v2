// =========================================================
// Neon Core features — sector map and replays
//
// • SectorProgress: stars and best time for every cleared sector, per difficulty (localStorage)
// • Sector map: a path of sectors per difficulty. Cleared ones show stars and best time,
//   the next one is ready to play, later ones are locked.
// • Playing a sector from the map is a replay ("practice", see features/run.js): it never
//   touches the saved run, and clearing it or ending it comes back to the map.
// Sector layouts are seeded (js/level.js), so a replay is the same track every time.
// =========================================================

const SectorProgress = {
    KEY: 'neonCoreSectors.v1',
    data: { EASY: {}, MEDIUM: {}, HARD: {} },

    load() {
        try {
            const raw = JSON.parse(localStorage.getItem(this.KEY));
            if (raw) for (const d in this.data) this.data[d] = raw[d] || {};
        } catch (e) {}
        this.importEarlierClears();
    },

    // Sectors cleared before the map existed have no record yet. Count them as cleared:
    //  • every sector before the one a saved run is on (same difficulty)
    //  • every sector with a time saved by the first victory screen (key "DIFF-sector")
    // Stars weren't kept then, so these show "CLEARED" until they're replayed.
    importEarlierClears() {
        let changed = false;
        const run = SaveData.data.run;
        if (run && this.data[run.difficulty]) {
            for (let s = 1; s < run.sector; s++) {
                if (!this.data[run.difficulty][s]) { this.data[run.difficulty][s] = { best: null, stars: 0 }; changed = true; }
            }
        }
        try {
            const old = JSON.parse(localStorage.getItem('neonCoreBestTimes')) || {};
            for (const key in old) {
                const [diff, sec] = key.split('-');
                const time = Number(old[key]);
                if (!this.data[diff] || !(time > 0)) continue;
                const cur = this.data[diff][sec];
                if (!cur || cur.best === null || time < cur.best) {
                    this.data[diff][sec] = { best: time, stars: cur ? cur.stars : 0 };
                    changed = true;
                }
            }
        } catch (e) {}
        if (changed) this.save();
    },
    save() { try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch (e) {} },

    get(diff, sector) { return this.data[diff][sector] || null; },

    // Called when a sector is cleared. Keeps the best time and the most stars.
    record(diff, sector, stars, time) {
        const prev = this.get(diff, sector);
        const prevBest = prev && prev.best !== null ? prev.best : undefined;
        const isNew = prevBest === undefined || time < prevBest;
        this.data[diff][sector] = {
            best: isNew ? time : prevBest,
            stars: Math.max(stars, prev ? prev.stars : 0)
        };
        this.save();
        return { isNew, prev: prevBest, best: isNew ? time : prevBest };
    },

    highestCleared(diff) {
        let top = 0;
        for (const k in this.data[diff]) top = Math.max(top, Number(k));
        return top;
    },

    // The next sector to play is unlocked; a run in progress on this difficulty unlocks its sector too
    unlockedUpTo(diff) {
        const run = SaveData.data.run;
        const runSector = run && run.difficulty === diff ? run.sector : 1;
        return Math.max(this.highestCleared(diff) + 1, runSector, 1);
    },

    totalStars(diff) {
        let n = 0;
        for (const k in this.data[diff]) n += this.data[diff][k].stars;
        return n;
    }
};
SectorProgress.load();

// ---------- Map screen ----------

let mapDiff = 'MEDIUM', mapSelected = 1;
const DIAMOND = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 21 12 12 22 3 12z" fill="currentColor"/></svg>';

function ringsInSector(diff, sector) { return (diff === 'EASY' ? 2 : 3) + sector * 2; }

function renderSectorMap() {
    const unlocked = SectorProgress.unlockedUpTo(mapDiff);
    const shown = Math.max(unlocked + 3, 8);
    let html = '';
    for (let s = 1; s <= shown; s++) {
        const p = SectorProgress.get(mapDiff, s);
        const state = p ? 'cleared' : (s <= unlocked ? 'next' : 'locked');
        const side = s % 2 ? 'left' : 'right';
        let sub;
        if (state === 'cleared') {
            let d = '';
            for (let i = 0; i < 3; i++) d += `<span class="m-dia ${i < p.stars ? 'on' : ''}">${DIAMOND}</span>`;
            const rating = p.stars ? `<span class="m-dias">${d}</span>` : '<span class="m-tag m-done">CLEARED</span>';
            const best = p.best !== null ? `best ${p.best.toFixed(1)}s` : 'replay for stars';
            sub = `${rating}<span class="m-best">${best}</span>`;
        } else if (state === 'next') {
            const tag = s === unlocked ? 'NEXT' : 'NOT CLEARED';
            sub = `<span class="m-tag">${tag}</span><span class="m-best">${ringsInSector(mapDiff, s)} rings</span>`;
        } else {
            sub = `<span class="m-best">Clear sector ${pad2(s - 1)} to unlock</span>`;
        }
        const icon = state === 'cleared'
            ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 10 17l9-10" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
            : state === 'locked'
                ? '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2"/></svg>'
                : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>';
        html += `
            <li class="m-row ${side}">
                <button class="m-node ${state}${s === mapSelected ? ' selected' : ''}" data-sector="${s}" ${state === 'locked' ? 'disabled' : ''}>
                    <span class="m-badge"><small>${pad2(s)}</small>${icon}</span>
                    <span class="m-text"><b>SECTOR ${pad2(s)}</b><span class="m-sub">${sub}</span></span>
                </button>
            </li>`;
    }
    const list = document.getElementById('map-list');
    list.innerHTML = html;
    list.querySelectorAll('.m-node:not([disabled])').forEach(btn => {
        btn.addEventListener('click', () => selectMapSector(Number(btn.dataset.sector)));
    });

    document.getElementById('map-stars').textContent = SectorProgress.totalStars(mapDiff);
    document.getElementById('map-stars-of').textContent = `/ ${(unlocked - 1) * 3 || 0}`;
    document.querySelectorAll('.m-tab').forEach(b => {
        const on = b.dataset.mdiff === mapDiff;
        b.classList.toggle('active', on);
        b.setAttribute('aria-checked', on ? 'true' : 'false');
    });
    updateMapFooter();
}

function updateMapFooter() {
    const p = SectorProgress.get(mapDiff, mapSelected);
    document.getElementById('map-sel-label').textContent = `SECTOR ${pad2(mapSelected)} · ${mapDiff}`;
    document.getElementById('map-sel-info').textContent = p
        ? `${p.stars ? p.stars + '/3 stars' : 'Cleared'} · ${p.best !== null ? 'best ' + p.best.toFixed(1) + 's' : 'no best time yet'} · ${ringsInSector(mapDiff, mapSelected)} rings`
        : `Not cleared yet · ${ringsInSector(mapDiff, mapSelected)} rings`;
    document.getElementById('map-play').textContent = p ? `REPLAY SECTOR ${pad2(mapSelected)}` : `PLAY SECTOR ${pad2(mapSelected)}`;
}

function selectMapSector(s) {
    mapSelected = s;
    document.querySelectorAll('.m-node').forEach(b => b.classList.toggle('selected', Number(b.dataset.sector) === s));
    updateMapFooter();
}

function setMapDifficulty(d) {
    mapDiff = d;
    const top = SectorProgress.unlockedUpTo(d);
    mapSelected = Math.min(mapSelected, top);
    renderSectorMap();
}

// Opens the map (from the title screen, or after a replay). select: the sector to highlight.
function openSectorMap(diff, select) {
    if (document.fullscreenElement && document.exitFullscreen) { try { document.exitFullscreen().catch(() => {}); } catch (e) {} }
    document.getElementById('ui').style.display = 'none';
    document.getElementById('mobile-controls').style.display = 'none';
    isPlaying = false;
    isGameOver = false;
    keys.w = keys.a = keys.s = keys.d = keys.space = false;
    practice = null;
    mapDiff = diff || selectedDifficulty;
    const top = SectorProgress.unlockedUpTo(mapDiff);
    mapSelected = Math.min(Math.max(select || top, 1), top);
    renderSectorMap();
    showOnly('map-menu');
    const sel = document.querySelector('.m-node.selected');
    if (sel) sel.scrollIntoView({ block: 'center' });
}

function startPractice() {
    const sector = mapSelected;
    setDifficulty(mapDiff);          // resets level to 1, so set the sector after it
    level = sector;
    practice = { sector };
    Lives.adContinues = 0;
    setLives(FEATURES.livesPerRun);
    beginSector();
    practice = { sector };           // beginSector → showOnly(null) keeps it, but be explicit
}

attachButtonAction('map-btn', () => openSectorMap(selectedDifficulty));
attachButtonAction('map-back', () => {
    showOnly('start-menu');
    refreshStartMenu();
});
attachButtonAction('map-play', startPractice);
document.querySelectorAll('.m-tab').forEach(b => b.addEventListener('click', () => setMapDifficulty(b.dataset.mdiff)));
