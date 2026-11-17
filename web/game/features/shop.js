// =========================================================
// Neon Core features — SHOP: spend Data (the lifetime score, js/config.js totalScore)
//
//   Cores   Magnet, Jet, Titan, Phantom (prices and powers: CORES in js/config.js).
//           Bought once, then switched during a run (features/cores.js).
//           "EQUIP" picks the core every sector starts with.
//   Boosts  +1 shield (FEATURES.shopShieldPrice)
//           +1 life for the next new run (FEATURES.shopLifePrice, one at a time)
// Revive with Data stays on the game over screen (FEATURES.reviveDataCost).
// =========================================================

const fmtData = (n) => n.toLocaleString('en-US');

function spendData(amount) {
    if (totalScore < amount) return false;
    totalScore -= amount;
    saveScore(totalScore);
    return true;
}

function renderShop() {
    document.getElementById('shop-data').textContent = fmtData(totalScore);

    document.getElementById('shop-cores').innerHTML = CORE_ORDER.map((id) => {
        const c = CORES[id];
        const owned = Cores.owns(id);
        const equipped = owned && Cores.equipped === id;
        let btn;
        if (equipped) btn = `<button class="shop-buy is-on" disabled>EQUIPPED</button>`;
        else if (owned) btn = `<button class="shop-buy is-equip" data-equip="${id}">EQUIP</button>`;
        else btn = `<button class="shop-buy${totalScore < c.price ? ' is-short' : ''}" data-buy="${id}" aria-label="Buy ${c.name} for ${fmtData(c.price)} Data"><span aria-hidden="true">◈</span> ${fmtData(c.price)}</button>`;
        return `<div class="shop-item${owned ? ' owned' : ''}" style="--c:${hexColor(c.glow)}">`
             + `<span class="shop-orb" aria-hidden="true"></span>`
             + `<div class="shop-info"><b>${c.name}</b>`
             + `<span class="shop-plus">+ ${c.perk}</span>`
             + (id === 'normal' ? '' : `<span class="shop-minus">− ${c.flaw}</span>`)
             + (!owned && Cores.charges(id) > 0 ? `<span class="shop-store">×${Cores.charges(id)} stored from track boxes</span>` : '')
             + `</div>${btn}</div>`;
    }).join('');

    const lifeReady = SaveData.data.bonusLife > 0;
    const shieldPrice = FEATURES.shopShieldPrice, lifePrice = FEATURES.shopLifePrice;
    document.getElementById('shop-boosts').innerHTML =
        `<div class="shop-item boost" style="--c:#4aa8ff">`
      +   `<span class="shop-orb is-shield" aria-hidden="true"></span>`
      +   `<div class="shop-info"><b>+1 SHIELD</b><span class="shop-plus">Blocks one hazard gate · you have ${Shield.count}</span></div>`
      +   `<button class="shop-buy${totalScore < shieldPrice ? ' is-short' : ''}" data-boost="shield" aria-label="Buy one shield for ${fmtData(shieldPrice)} Data"><span aria-hidden="true">◈</span> ${fmtData(shieldPrice)}</button>`
      + `</div>`
      + `<div class="shop-item boost" style="--c:#29f3ff">`
      +   `<span class="shop-orb is-life" aria-hidden="true"></span>`
      +   `<div class="shop-info"><b>+1 LIFE</b><span class="shop-plus">Your next new run starts with ${FEATURES.livesPerRun + 1} lives</span></div>`
      +   (lifeReady
            ? `<button class="shop-buy is-on" disabled>READY</button>`
            : `<button class="shop-buy${totalScore < lifePrice ? ' is-short' : ''}" data-boost="life" aria-label="Buy an extra life for ${fmtData(lifePrice)} Data"><span aria-hidden="true">◈</span> ${fmtData(lifePrice)}</button>`)
      + `</div>`;
}

function notEnough(price) {
    showAdToast(`Need ◈ ${fmtData(price - totalScore)} more Data. Clear sectors or use 2X Data.`, 2600);
}

function afterPurchase(text) {
    playPowerup();
    haptic('medium');
    announce(text);
    renderShop();
    refreshStartMenu();
}

document.getElementById('shop-sheet').addEventListener('click', (e) => {
    if (performance.now() < uiLockUntil) return;
    const buy = e.target.closest('[data-buy]');
    const equip = e.target.closest('[data-equip]');
    const boost = e.target.closest('[data-boost]');

    if (buy) {
        const id = buy.dataset.buy, c = CORES[id];
        if (!spendData(c.price)) { notEnough(c.price); return; }
        if (!SaveData.data.cores.includes(id)) SaveData.data.cores.push(id);
        SaveData.data.equippedCore = id;
        SaveData.save();
        afterPurchase(`${c.name} core unlocked and equipped.`);
    } else if (equip) {
        SaveData.data.equippedCore = equip.dataset.equip;
        SaveData.save();
        afterPurchase(`${CORES[equip.dataset.equip].name} core equipped.`);
    } else if (boost && boost.dataset.boost === 'shield') {
        if (!spendData(FEATURES.shopShieldPrice)) { notEnough(FEATURES.shopShieldPrice); return; }
        Shield.add(1);
        afterPurchase('One shield added.');
    } else if (boost && boost.dataset.boost === 'life') {
        if (SaveData.data.bonusLife > 0) return;
        if (!spendData(FEATURES.shopLifePrice)) { notEnough(FEATURES.shopLifePrice); return; }
        SaveData.data.bonusLife = 1;
        SaveData.save();
        afterPurchase('Your next new run starts with an extra life.');
    }
});

attachButtonAction('shop-btn', () => { renderShop(); openSheet('shop-sheet'); });

// The extra life is used when a new run starts (features/run.js startNewRun)
function takeBonusLife() {
    if (SaveData.data.bonusLife <= 0) return 0;
    SaveData.data.bonusLife = 0;
    SaveData.save();
    return 1;
}
