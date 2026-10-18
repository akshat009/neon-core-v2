// =========================================================
// Neon Core features — saved progress (localStorage)
//
//   shields     shields the player owns right now (free daily + earned from ads)
//   shieldDay   the day the free shields were last topped up (YYYY-MM-DD)
//   run         the run in progress: { sector, difficulty, lives } or null
//   bestSector  highest sector ever reached
//
// The lifetime score ("TOTAL ARCHIVE") stays in its own key, see js/config.js.
// =========================================================

const SAVE_KEY = 'neonCoreSave.v1';

const SaveData = {
    data: { shields: FEATURES.dailyFreeShields, shieldDay: '', run: null, bestSector: 1 },

    load() {
        try {
            const raw = localStorage.getItem(SAVE_KEY);
            if (raw) Object.assign(this.data, JSON.parse(raw));
        } catch (e) {}
    },

    save() {
        try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch (e) {}
    },

    setRun(run) {
        this.data.run = run;
        if (run && run.sector > this.data.bestSector) this.data.bestSector = run.sector;
        this.save();
    },

    clearRun() {
        this.data.run = null;
        this.save();
    }
};

SaveData.load();

function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
