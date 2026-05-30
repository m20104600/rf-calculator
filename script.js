/* ========================================
   RF Chain Calculator — Calculation Engine
   ======================================== */

// ---------- Language Switcher ----------
let currentLang = 'zh'; // Default Chinese

function setLanguage(lang) {
    currentLang = lang;
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    
    // Update all elements with data-en/data-zh attributes
    document.querySelectorAll('[data-' + lang + ']').forEach(el => {
        el.textContent = el.getAttribute('data-' + lang);
    });
    
    // Update lang switch buttons
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
    });
    
    // Save preference
    localStorage.setItem('rf-calc-lang', lang);
    
    // Re-run calculations to update status text
    calcLinkBudget();
}

// Language switcher — initialized in DOMContentLoaded below

// ---------- Utility Functions ----------
function dBmToW(dBm) {
    return Math.pow(10, (dBm - 30) / 10);
}

function wToDbm(w) {
    if (w <= 0) return -Infinity;
    return 10 * Math.log10(w) + 30;
}

function dBmToMw(dBm) {
    return Math.pow(10, dBm / 10);
}

function mwToDbm(mw) {
    if (mw <= 0) return -Infinity;
    return 10 * Math.log10(mw);
}

function dBiToLinear(dBi) {
    return Math.pow(10, dBi / 10);
}

function linearToDb(lin) {
    if (lin <= 0) return -Infinity;
    return 10 * Math.log10(lin);
}

function fmt(val, decimals = 2) {
    if (!isFinite(val)) return '—';
    return val.toFixed(decimals);
}

function fmtEng(val, unit, decimals = 3) {
    if (!isFinite(val)) return '— ' + unit;
    if (Math.abs(val) >= 1e9) return (val / 1e9).toFixed(decimals) + ' G' + unit;
    if (Math.abs(val) >= 1e6) return (val / 1e6).toFixed(decimals) + ' M' + unit;
    if (Math.abs(val) >= 1e3) return (val / 1e3).toFixed(decimals) + ' k' + unit;
    if (Math.abs(val) >= 1) return val.toFixed(decimals) + ' ' + unit;
    if (Math.abs(val) >= 1e-3) return (val * 1e3).toFixed(decimals) + ' m' + unit;
    if (Math.abs(val) >= 1e-6) return (val * 1e6).toFixed(decimals) + ' μ' + unit;
    return (val * 1e9).toFixed(decimals) + ' n' + unit;
}

function safeLog10(x) {
    return x > 0 ? Math.log10(x) : 0;
}

function updateFormula(id, text) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = '\u2192 ' + text;
}

function getVal(id) {
    return parseFloat(document.getElementById(id).value) || 0;
}

// ---------- Tab Navigation ----------
// Wrapped in DOMContentLoaded to ensure DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Language switcher init
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', () => setLanguage(btn.dataset.lang));
    });

    // Load saved language preference
    const savedLang = localStorage.getItem('rf-calc-lang') || 'zh';
    if (savedLang !== 'zh') setLanguage(savedLang);

    // Tab navigation
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            const panel = document.getElementById('tab-' + tab.dataset.tab);
            if (panel) panel.classList.add('active');
            // Trigger calculation for tabs that need it
            if (tab.dataset.tab === 'pulse-cap') calcTRCapacitor();
        });
    });

    // Initial calculations
    calcLinkBudget();
    calcRadar();
    calcPhasedArray();
    ucDbmToMw();
    ucWToDbm();
    ucDbiToDbd();
    ucDbdToDbi();
    ucFreqToWavelength();
    ucWavelengthToFreq();
    ucVswrToRl();
    ucRlToVswr();
    calcTRCapacitor();
    calcPowerDivider();
    ncInit();
    tlSwitchType();
    calcTLine();
    calcFSPL();
});

// ====================================================================
// 1. LINK BUDGET CALCULATOR
// ====================================================================
function calcLinkBudget() {
    const txPowerDbm = getVal('lb-tx-power');
    const txCableDb = getVal('lb-tx-cable');
    const txGainDbi = getVal('lb-tx-gain');
    const freqMHz = getVal('lb-freq');
    const distKm = getVal('lb-distance');
    const addLossDb = getVal('lb-add-loss');
    const rxGainDbi = getVal('lb-rx-gain');
    const rxCableDb = getVal('lb-rx-cable');
    const sensitivity = getVal('lb-sensitivity');

    // TX power in W
    document.getElementById('lb-tx-power-w').textContent = fmt(dBmToW(txPowerDbm));

    // Wavelength
    const wavelengthM = 299792458 / (freqMHz * 1e6);
    document.getElementById('lb-wavelength').textContent = fmt(wavelengthM * 1000, 1);

    // EIRP = TX Power - TX Cable Loss + TX Antenna Gain
    const eirp = txPowerDbm - txCableDb + txGainDbi;
    document.getElementById('lb-eirp').textContent = fmt(eirp) + ' dBm';
    document.getElementById('lb-eirp-w').textContent = fmtEng(dBmToW(eirp), 'W');

    // FSPL = 20*log10(d_km) + 20*log10(f_MHz) + 32.44
    let fspl = 0;
    if (distKm > 0 && freqMHz > 0) {
        fspl = 20 * safeLog10(distKm) + 20 * safeLog10(freqMHz) + 32.44;
    }
    document.getElementById('lb-fspl').textContent = fmt(fspl) + ' dB';

    // Received Power = EIRP - FSPL - Additional Loss + RX Gain - RX Cable Loss
    const rxPower = eirp - fspl - addLossDb + rxGainDbi - rxCableDb;
    document.getElementById('lb-rx-power').textContent = fmt(rxPower) + ' dBm';

    // Link Margin
    const margin = rxPower - sensitivity;
    document.getElementById('lb-margin').textContent = fmt(margin) + ' dB';

    const marginBox = document.getElementById('lb-margin-box');
    const statusEl = document.getElementById('lb-status');
    if (margin >= 0) {
        marginBox.classList.remove('negative');
        statusEl.textContent = currentLang === 'zh' ? '✅ 链路正常' : '✅ Link OK';
    } else {
        marginBox.classList.add('negative');
        statusEl.textContent = currentLang === 'zh' ? '❌ 链路失败' : '❌ Link Failed';
    }

    // Update formula live values
    updateFormula('fml-eirp', fmt(txPowerDbm) + ' + ' + fmt(txGainDbi) + ' − ' + fmt(txCableDb) + ' = ' + fmt(eirp) + ' dBm');
    updateFormula('fml-fspl', '20·log₁₀(' + fmt(distKm) + ') + 20·log₁₀(' + fmt(freqMHz) + ') + 32.44 = ' + fmt(fspl) + ' dB');
    updateFormula('fml-rxpower', fmt(eirp) + ' − ' + fmt(fspl) + ' − ' + fmt(addLossDb) + ' + ' + fmt(rxGainDbi) + ' − ' + fmt(rxCableDb) + ' = ' + fmt(rxPower) + ' dBm');
    updateFormula('fml-margin', fmt(rxPower) + ' - (' + fmt(sensitivity) + ') = ' + fmt(margin) + ' dB');
}

// ====================================================================
// 2. RADAR RANGE CALCULATOR
// ====================================================================
function calcRadar() {
    const peakPowerDbm = getVal('rad-peak-power');
    const freqGHz = getVal('rad-freq');
    const txGainDbi = getVal('rad-tx-gain');
    const rxGainDbi = getVal('rad-rx-gain');
    const rcsSqM = getVal('rad-rcs');
    const minPowerDbm = getVal('rad-min-power');
    const lossesDb = getVal('rad-loss');

    // Peak power in W
    const peakPowerW = dBmToW(peakPowerDbm);
    document.getElementById('rad-peak-power-w').textContent = fmtEng(peakPowerW * 1000, 'W');

    // Wavelength
    const freqHz = freqGHz * 1e9;
    const lambda = 299792458 / freqHz;

    // Convert to linear
    const txGainLin = dBiToLinear(txGainDbi);
    const rxGainLin = dBiToLinear(rxGainDbi);
    const minPowerLin = dBmToW(minPowerDbm) * 1000; // mW to W
    const lossesLin = dBiToLinear(lossesDb);

    // EIRP
    const eirp = peakPowerDbm + txGainDbi;
    document.getElementById('rad-eirp').textContent = fmt(eirp) + ' dBm';

    // Radar Range Equation:
    // R^4 = (Pt * Gt * Gr * λ² * σ) / ((4π)³ * Smin * L)
    const numerator = peakPowerW * txGainLin * rxGainLin * lambda * lambda * rcsSqM;
    const denominator = Math.pow(4 * Math.PI, 3) * (minPowerLin / 1000) * lossesLin;

    let maxRangeM = 0;
    if (denominator > 0 && numerator > 0) {
        maxRangeM = Math.pow(numerator / denominator, 0.25);
    }
    const maxRangeKm = maxRangeM / 1000;

    document.getElementById('rad-max-range').textContent = fmt(maxRangeKm) + ' km (' + fmt(maxRangeM / 1852, 1) + ' nmi)';

    // FSPL at max range
    if (maxRangeKm > 0 && freqGHz > 0) {
        const fspl = 20 * safeLog10(maxRangeKm) + 20 * safeLog10(freqGHz * 1000) + 32.44;
        document.getElementById('rad-fspl').textContent = fmt(fspl) + ' dB';
    } else {
        document.getElementById('rad-fspl').textContent = '— dB';
    }

    // Update formula live
    if (maxRangeKm > 0) {
        updateFormula('fml-radar', '→ R<sub>max</sub> = [(' + fmtEng(peakPowerW, '') + '·' + fmt(txGainLin, 1) + '<sup>2</sup>·' + fmt(lambda, 4) + '<sup>2</sup>·' + fmt(rcsSqM, 1) + ') / ((4π)<sup>3</sup>·' + fmtEng(minPowerLin/1000, '') + '·' + fmt(lossesLin,1) + ')]<sup>1/4</sup> = ' + fmt(maxRangeKm) + ' km');
    } else {
        updateFormula('fml-radar', '→ 输入参数后计算');
    }
}

// ====================================================================
// 3. PHASED ARRAY CALCULATOR
// ====================================================================
function calcPhasedArray() {
    // Tx inputs
    const nTx = getVal('pa-n-tx') || 1;
    const pElDbm = getVal('pa-pel');
    const gElTx = getVal('pa-gel-tx');
    const lRadTx = getVal('pa-lrad-tx');
    const lFeedTx = getVal('pa-lfeed-tx');
    const lCombTx = getVal('pa-lcomb-tx');

    // Rx inputs
    const nRx = getVal('pa-n-rx') || 1;
    const gElRx = getVal('pa-gel-rx');
    const lRadRx = getVal('pa-lrad-rx');
    const lFeedRx = getVal('pa-lfeed-rx');
    const lCombRx = getVal('pa-lcomb-rx');
    const tAnt = getVal('pa-ta');
    const nf = getVal('pa-nf');
    const lScan = getVal('pa-lscan');

    // --- Tx calculations ---
    // Array gain = G_element + 10log(N) - L_feed - L_combiner (不含天线罩)
    const txGain = gElTx + 10 * Math.log10(nTx) - lFeedTx - lCombTx;
    // Total power = P_element + 10log(N) (dBm)
    const txPower = pElDbm + 10 * Math.log10(nTx);
    // Boresight EIRP = P_total(dBm) - 30 + G_array - L_radome (dBW)
    const eirpBoresight = txPower - 30 + txGain - lRadTx;
    // Omni EIRP = Boresight - scan loss
    const eirpOmni = eirpBoresight - lScan;

    // --- Rx calculations ---
    // LNA noise temp Tp = 290 * (10^(NF/10) - 1)
    const tp = 290 * (Math.pow(10, nf / 10) - 1);
    // Array gain (Rx) = G_element + 10log(N) - L_feed - L_combiner (不含天线罩)
    const rxGain = gElRx + 10 * Math.log10(nRx) - lFeedRx - lCombRx;
    // T_sys = T_ant + Tp
    const tSys = tAnt + tp;
    // G/T boresight = G_array - L_radome - 10log(T_sys)
    const gtBoresight = rxGain - lRadRx - 10 * Math.log10(tSys);
    // G/T omni = boresight - scan loss
    const gtOmni = gtBoresight - lScan;

    // Update main cards
    document.getElementById('pa-eirp').textContent = fmt(eirpBoresight);
    document.getElementById('pa-gt').textContent = fmt(gtBoresight);

    // Tx details
    document.getElementById('pa-tx-gain').textContent = fmt(txGain);
    document.getElementById('pa-tx-power').textContent = fmt(txPower);
    document.getElementById('pa-tx-eirp').textContent = fmt(eirpBoresight);
    document.getElementById('pa-tx-eirp-omni').textContent = fmt(eirpOmni);

    // Rx details
    document.getElementById('pa-rx-gain').textContent = fmt(rxGain);
    document.getElementById('pa-rx-tp').textContent = fmt(tp);
    document.getElementById('pa-rx-tsys').textContent = fmt(tSys);
    document.getElementById('pa-rx-gt').textContent = fmt(gtBoresight);
    document.getElementById('pa-rx-gt-omni').textContent = fmt(gtOmni);

    // Scan angle table: 0°, 15°, 30°, 45°, 60°
    [0, 15, 30, 45, 60].forEach(angle => {
        const rad = angle * Math.PI / 180;
        const scanLossDb = angle > 0 ? -10 * Math.log10(Math.cos(rad)) : 0;
        const eirpAtAngle = eirpBoresight - scanLossDb;
        const gtAtAngle = gtBoresight - scanLossDb;

        document.getElementById('pa-sl-' + angle).textContent = fmt(scanLossDb);
        document.getElementById('pa-se-' + angle).textContent = fmt(eirpAtAngle);
        document.getElementById('pa-sg-' + angle).textContent = fmt(gtAtAngle);
    });

    // Update formula live values
    updateFormula('fml-pa-gain', fmt(gElTx) + ' + 10·log₁₀(' + nTx + ') − ' + fmt(lFeedTx) + ' − ' + fmt(lCombTx) + ' = ' + fmt(txGain) + ' dBi');
    updateFormula('fml-pa-ptotal', fmt(pElDbm) + ' + 10·log₁₀(' + nTx + ') = ' + fmt(txPower) + ' dBm');
    updateFormula('fml-pa-eirp', fmt(txPower) + ' − 30 + ' + fmt(txGain) + ' − ' + fmt(lRadTx) + ' = ' + fmt(eirpBoresight) + ' dBW');
    updateFormula('fml-pa-eirp-omni', fmt(eirpBoresight) + ' − ' + fmt(lScan) + ' = ' + fmt(eirpOmni) + ' dBW');
    updateFormula('fml-pa-tp', '290 × (10<sup>' + fmt(nf) + '/10</sup> − 1) = 290 × (' + fmt(Math.pow(10, nf/10), 1) + ' − 1) = ' + fmt(tp, 1) + ' K');
    updateFormula('fml-pa-gt', fmt(rxGain) + ' − ' + fmt(lRadRx) + ' − 10·log₁₀(' + fmt(tSys, 1) + ') = ' + fmt(gtBoresight) + ' dB/K');
    updateFormula('fml-pa-lscan', '−10·log₁₀(cos θ), 当前附加损耗 = ' + fmt(lScan) + ' dB');
}

// ====================================================================
// 4. UNIT CONVERSION — dBm ↔ mW
// ====================================================================
function ucDbmToMw() {
    const dbm = getVal('uc-dbm');
    const w = dBmToW(dbm);
    document.getElementById('uc-w').textContent = fmtEng(w, 'W');
    updateFormula('fml-uc-dbm', '10<sup>' + fmt(dbm) + '/10</sup> = ' + fmtEng(dBmToMw(dbm), 'mW') + ' = ' + fmtEng(w, 'W'));
}

function ucWToDbm() {
    const w = getVal('uc-w-input');
    const dbm = wToDbm(w);
    document.getElementById('uc-mw-result').textContent = fmt(dbm) + ' dBm';
    updateFormula('fml-uc-dbm', '10·log₁₀(' + fmtEng(w * 1000, '') + ' mW) = ' + fmt(dbm) + ' dBm');
}

// ====================================================================
// 5. UNIT CONVERSION — dBi ↔ dBd
// ====================================================================
function ucDbiToDbd() {
    const dbi = getVal('uc-dbi');
    const dbd = dbi - 2.15;
    const linear = dBiToLinear(dbi);
    document.getElementById('uc-dbd-result').textContent = fmt(dbd) + ' dBd';
    document.getElementById('uc-linear').textContent = fmt(linear);
    updateFormula('fml-uc-dbi', fmt(dbi) + ' dBi − 2.15 = ' + fmt(dbd) + ' dBd');
}

function ucDbdToDbi() {
    const dbd = getVal('uc-dbd-input');
    const dbi = dbd + 2.15;
    document.getElementById('uc-dbi-result').textContent = fmt(dbi) + ' dBi';
    updateFormula('fml-uc-dbi', fmt(dbd) + ' dBd + 2.15 = ' + fmt(dbi) + ' dBi');
}

// ====================================================================
// 6. UNIT CONVERSION — Frequency ↔ Wavelength
// ====================================================================
function ucFreqToWavelength() {
    const freqMHz = getVal('uc-freq');
    if (freqMHz > 0) {
        const wavelengthM = 299792458 / (freqMHz * 1e6);
        const wavelengthMM = wavelengthM * 1000;
        document.getElementById('uc-wavelength-mm').textContent = fmt(wavelengthMM, 2) + ' mm';
        document.getElementById('uc-quarter-wave').textContent = fmt(wavelengthMM / 4, 2) + ' mm';
        updateFormula('fml-uc-wave', 'λ = 3×10<sup>8</sup> / (' + fmt(freqMHz) + '×10<sup>6</sup>) = ' + fmt(wavelengthMM, 2) + ' mm');
    } else {
        document.getElementById('uc-wavelength-mm').textContent = '— mm';
        document.getElementById('uc-quarter-wave').textContent = '— mm';
        updateFormula('fml-uc-wave', '');
    }
}

function ucWavelengthToFreq() {
    const wavelengthMM = getVal('uc-wavelength-input');
    if (wavelengthMM > 0) {
        const wavelengthM = wavelengthMM / 1000;
        const freqMHz = 299792458 / wavelengthM / 1e6;
        document.getElementById('uc-freq-result').textContent = fmt(freqMHz, 2) + ' MHz';
        updateFormula('fml-uc-wave', 'f = 3×10<sup>8</sup> / (' + fmt(wavelengthMM, 2) + '×10<sup>-3</sup>) = ' + fmt(freqMHz, 2) + ' MHz');
    } else {
        document.getElementById('uc-freq-result').textContent = '— MHz';
        updateFormula('fml-uc-wave', '');
    }
}

// ====================================================================
// 7. UNIT CONVERSION — VSWR ↔ Return Loss
// ====================================================================
function ucVswrToRl() {
    const vswr = getVal('uc-vswr');
    if (vswr < 1) return;
    const gamma = (vswr - 1) / (vswr + 1);
    const rl = -20 * Math.log10(gamma);
    const mismatch = -10 * Math.log10(1 - gamma * gamma);

    document.getElementById('uc-rl').textContent = fmt(rl) + ' dB';
    document.getElementById('uc-gamma').textContent = fmt(gamma, 4);
    document.getElementById('uc-mismatch').textContent = fmt(mismatch) + ' dB';

    // Reflected Power % = |Γ|² × 100
    const reflPct = gamma * gamma * 100;
    document.getElementById('uc-refl-pct').textContent = fmt(reflPct, 2) + ' %';

    // Transmission Efficiency % = (1 - |Γ|²) × 100
    const txEff = (1 - gamma * gamma) * 100;
    document.getElementById('uc-tx-eff').textContent = fmt(txEff, 2) + ' %';

    updateFormula('fml-uc-vswr', 'RL = 20·log₁₀((' + fmt(vswr) + '+1)/(' + fmt(vswr) + '−1)) = ' + fmt(rl) + ' dB, |Γ| = ' + fmt(gamma, 4));
}

function ucRlToVswr() {
    const rl = getVal('uc-rl-input');
    if (rl <= 0) return;
    const gamma = Math.pow(10, -rl / 20);
    const vswr = (1 + gamma) / (1 - gamma);
    document.getElementById('uc-vswr-result').textContent = fmt(vswr, 2);

    // Reflected Power % & Transmission Efficiency
    const reflPct = gamma * gamma * 100;
    document.getElementById('uc-rl-refl-pct').textContent = fmt(reflPct, 2) + ' %';
    const txEff = (1 - gamma * gamma) * 100;
    document.getElementById('uc-rl-tx-eff').textContent = fmt(txEff, 2) + ' %';

    updateFormula('fml-uc-vswr', '|Γ| = 10<sup>-' + fmt(rl) + '/20</sup> = ' + fmt(gamma, 4) + ', VSWR = (1+|Γ|)/(1−|Γ|) = ' + fmt(vswr, 2));
}

// ====================================================================
// 8. TR CAPACITOR CALCULATOR
// ====================================================================
function toggleTRMode() {
    const mode = document.getElementById('tr-mode').value;
    document.getElementById('tr-mode-current').style.display = mode === 'current' ? 'block' : 'none';
    document.getElementById('tr-mode-power').style.display = mode === 'power' ? 'block' : 'none';
}

function calcTRCapacitor() {
    const prf = getVal('tr-prf');           // kHz
    const duty = getVal('tr-duty');         // %
    const vOp = getVal('tr-voltage');       // V
    const vDroop = getVal('tr-droop');      // V
    const margin = getVal('tr-margin');     // ×

    if (prf <= 0 || vDroop <= 0 || vDroop >= vOp) {
        return;
    }

    // Pulse width: t = (Duty / PRF) * 10  [μs]
    // Derived from: t[s] = Duty[%]/100 * 1/PRF[kHz]*1000 = Duty/(PRF*10) * 1000 = Duty/PRF * 100 [ms] ... 
    // Desktop app: t_pulse = (duty / prf) * 10.0  [μs]
    // Let me verify: if PRF=1kHz, Duty=10%, then duty cycle = 0.1, PRI = 1ms, pulse width = 0.1ms = 100μs
    // (10/1)*10 = 100μs ✓
    const tPulseUs = (duty / prf) * 10.0;   // μs

    // Get peak current
    let iPeak; // A
    const mode = document.getElementById('tr-mode').value;
    if (mode === 'current') {
        iPeak = getVal('tr-peak-current');
    } else {
        const pPeak = getVal('tr-peak-power');    // W
        const eff = getVal('tr-efficiency');       // %
        if (eff <= 0 || vOp <= 0) return;
        const pDc = pPeak / (eff / 100.0);
        iPeak = pDc / vOp;
    }

    if (iPeak <= 0) return;

    // Method A: Linear  C = I * t / ΔV
    const cLinear = (iPeak * tPulseUs * 1e-6) / vDroop * 1e6; // μF

    // Method B: Energy Conservation  C = 2*V*I*t / (V² - Vend²)
    const vEnd = vOp - vDroop;
    const ePulseJ = vOp * iPeak * tPulseUs * 1e-6; // Joules
    const cEnergy = (2 * ePulseJ) / (vOp * vOp - vEnd * vEnd) * 1e6; // μF

    // Method C: RC Discharge  C = -t / (R * ln(Vend/V))
    const rLoad = vOp / iPeak;
    let cRc = Infinity;
    if (vEnd > 0) {
        cRc = -(tPulseUs * 1e-6) / (rLoad * Math.log(vEnd / vOp)) * 1e6; // μF
    }

    // Recommendations (× margin)
    const recLinear = cLinear * margin;
    const recEnergy = cEnergy * margin;
    const recRc = cRc * margin;
    const cFinal = Math.max(cLinear, cEnergy, cRc) * margin;

    // Other stats
    const chargeUc = iPeak * tPulseUs;        // μC (A × μs)
    const energyMj = ePulseJ * 1000;           // mJ
    const iAvg = iPeak * (duty / 100.0);       // A

    // Update UI
    document.getElementById('tr-pulse-width').textContent = fmt(tPulseUs, 2) + ' μs';
    document.getElementById('tr-theo-linear').textContent = fmt(cLinear, 2) + ' μF';
    document.getElementById('tr-theo-energy').textContent = fmt(cEnergy, 2) + ' μF';
    document.getElementById('tr-theo-rc').textContent = isFinite(cRc) ? fmt(cRc, 2) + ' μF' : '∞';
    document.getElementById('tr-rec-linear').textContent = fmt(recLinear, 2) + ' μF';
    document.getElementById('tr-rec-energy').textContent = fmt(recEnergy, 2) + ' μF';
    document.getElementById('tr-rec-rc').textContent = isFinite(recRc) ? fmt(recRc, 2) + ' μF' : '∞';
    document.getElementById('tr-final-rec').textContent = isFinite(cFinal) ? fmt(cFinal, 2) + ' μF' : '∞';
    document.getElementById('tr-charge').textContent = fmt(chargeUc, 2) + ' μC';
    document.getElementById('tr-energy').textContent = fmt(energyMj, 2) + ' mJ';
    document.getElementById('tr-avg-current').textContent = fmt(iAvg, 3) + ' A';

    // Update formula live
    updateFormula('fml-tr-a', 'C = ' + fmt(iPeak, 2) + ' × ' + fmt(tPulseUs, 2) + ' / ' + fmt(vDroop, 2) + ' = ' + fmt(cLinear, 2) + ' μF');
    updateFormula('fml-tr-b', 'C = 2 × ' + fmt(vOp, 2) + ' × ' + fmt(iPeak, 2) + ' × ' + fmt(tPulseUs, 2) + ' / (' + fmt(vOp, 2) + '<sup>2</sup> − ' + fmt(vEnd, 2) + '<sup>2</sup>) = ' + fmt(cEnergy, 2) + ' μF');
    updateFormula('fml-tr-c', isFinite(cRc) ? 'C = −' + fmt(tPulseUs, 2) + ' / (' + fmt(rLoad, 2) + ' × ln(' + fmt(vEnd, 2) + '/' + fmt(vOp, 2) + ')) = ' + fmt(cRc, 2) + ' μF' : '→ ΔV ≥ V, RC法不适用');
}

// ====================================================================
// 9. POWER DIVIDER CALCULATOR
// ====================================================================
function calcPowerDivider() {
    // --- Equal Split ---
    const n = Math.max(1, getVal('pd-n'));
    const eqLoss = 10 * Math.log10(n);
    document.getElementById('pd-eq-loss').textContent = fmt(eqLoss) + ' dB';
    updateFormula('fml-pd-eq', '10·log₁₀(' + n + ') = ' + fmt(eqLoss) + ' dB');

    // --- Unequal Split ---
    const p1 = Math.max(1, getVal('pd-p1'));
    const p2 = Math.max(1, getVal('pd-p2'));
    const k = p1 / p2;
    const deltaDb = 10 * Math.log10(k);
    document.getElementById('pd-ratio-db').value = fmt(deltaDb);

    const loss1 = -10 * Math.log10(k / (k + 1));
    const loss2 = -10 * Math.log10(1 / (k + 1));
    document.getElementById('pd-p1-loss').textContent = fmt(loss1) + ' dB';
    document.getElementById('pd-p2-loss').textContent = fmt(loss2) + ' dB';

    updateFormula('fml-pd-ueq', p1 + ':' + p2 + ' → K = ' + fmt(k, 2) + ', Δ = ' + fmt(deltaDb) + ' dB<br>L<sub>1</sub> = −10·log₁₀(' + fmt(k, 2) + '/' + fmt(k+1, 2) + ') = ' + fmt(loss1) + ' dB<br>L<sub>2</sub> = −10·log₁₀(1/' + fmt(k+1, 2) + ') = ' + fmt(loss2) + ' dB');
}

function pdSyncRatio() {
    calcPowerDivider();
}

function pdSyncDbToP1P2() {
    const deltaDb = Math.max(0, getVal('pd-ratio-db'));
    const k = Math.pow(10, deltaDb / 10);
    // Set P₁=K, P₂=1 (canonical representation)
    document.getElementById('pd-p1').value = fmt(k, 2);
    document.getElementById('pd-p2').value = '1';
    calcPowerDivider();
}

// ====================================================================
// 10. NOISE CASCADE CALCULATOR
// ====================================================================
let ncCount = 0;

function ncInit() {
    const container = document.getElementById('nc-stages');
    container.innerHTML = '';
    ncCount = 0;
    // Create 3 default stages
    ncAddStage({g: 15, nf: 1.5});  // LNA
    ncAddStage({g: 10, nf: 3});    // Mixer
    ncAddStage({g: 20, nf: 5});    // IF Amp
}

function ncAddStage(defaults) {
    const g = defaults ? defaults.g : 0;
    const nf = defaults ? defaults.nf : 1;
    ncCount++;
    const idx = ncCount;
    const container = document.getElementById('nc-stages');
    const div = document.createElement('div');
    div.className = 'form-group';
    div.id = 'nc-stage-' + idx;
    div.style.cssText = 'border:1px solid var(--border);border-radius:6px;padding:0.5rem;margin-bottom:0.5rem;background:var(--bg-input)';
    div.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.35rem">' +
        '<span style="font-size:0.8rem;font-weight:600;color:var(--accent-cyan)">' + (currentLang === 'zh' ? '第' + idx + '级' : 'Stage ' + idx) + '</span>' +
        '</div>' +
        '<div style="display:flex;gap:0.4rem">' +
        '<div style="flex:1"><label style="font-size:0.72rem;color:var(--text-muted);display:block;margin-bottom:0.15rem">Gain (dB)</label>' +
        '<input type="number" id="nc-g-' + idx + '" value="' + g + '" step="any" oninput="calcNoiseCascade()" style="width:100%"></div>' +
        '<div style="flex:1"><label style="font-size:0.72rem;color:var(--text-muted);display:block;margin-bottom:0.15rem">NF (dB)</label>' +
        '<input type="number" id="nc-nf-' + idx + '" value="' + nf + '" step="any" min="0" oninput="calcNoiseCascade()" style="width:100%"></div>' +
        '</div>';
    container.appendChild(div);
    calcNoiseCascade();
}

function ncRemoveStage() {
    if (ncCount <= 2) return;
    const container = document.getElementById('nc-stages');
    const last = document.getElementById('nc-stage-' + ncCount);
    if (last) container.removeChild(last);
    ncCount--;
    calcNoiseCascade();
}

function calcNoiseCascade() {
    let gTotalLin = 1;
    let fCascade = 1;
    let gProd = 1;
    let parts = [];

    for (let i = 1; i <= ncCount; i++) {
        const gDb = getVal('nc-g-' + i);
        const nfDb = getVal('nc-nf-' + i);
        const gLin = Math.pow(10, gDb / 10);
        const fLin = Math.pow(10, nfDb / 10);

        gTotalLin *= gLin;

        if (i === 1) {
            fCascade = fLin;
            parts.push('F<sub>1</sub>=' + fmt(fLin, 2));
        } else {
            const term = (fLin - 1) / gProd;
            fCascade += term;
            parts.push('(F<sub>' + i + '</sub>−1)/G<sub>1..' + (i-1) + '</sub>=' + fmt(term, 3));
        }
        gProd *= gLin;
    }

    const nfDb = 10 * Math.log10(fCascade);
    const gDb = 10 * Math.log10(gTotalLin);
    const te = 290 * (fCascade - 1);

    document.getElementById('nc-gain').textContent = fmt(gDb) + ' dB';
    document.getElementById('nc-gain-lin').textContent = '= ' + fmtEng(gTotalLin, '×');
    document.getElementById('nc-nf').textContent = fmt(nfDb) + ' dB';
    document.getElementById('nc-nf-lin').textContent = 'F = ' + fmt(fCascade, 3);
    document.getElementById('nc-te').textContent = fmt(te, 1) + ' K';

    updateFormula('fml-nc', parts.join('<br>') + '<br>→ F = ' + fmt(fCascade, 3) + ', NF = ' + fmt(nfDb) + ' dB');
}

// ====================================================================
// All initialization is now in the DOMContentLoaded handler above

// ====================================================================
// FSPL CALCULATOR
// ====================================================================
function calcFSPL() {
    const freqGHz = getVal('fspl-freq');
    const distKm = getVal('fspl-dist');
    const atmoPerKm = getVal('fspl-atmo');
    const extraLoss = getVal('fspl-extra');
    const txPower = getVal('fspl-tx-power');
    const txGain = getVal('fspl-tx-gain');
    const rxGain = getVal('fspl-rx-gain');
    const rxSens = getVal('fspl-rx-sens');

    const freqMHz = freqGHz * 1000;

    // FSPL (dB)
    let fspl = 0;
    if (distKm > 0 && freqMHz > 0) {
        fspl = 20 * safeLog10(distKm) + 20 * safeLog10(freqMHz) + 32.44;
    }
    document.getElementById('fspl-result').textContent = fmt(fspl) + ' dB';
    document.getElementById('fspl-twoway').textContent = fmt(fspl * 2) + ' dB';

    // Wavelength
    const c = 299792458;
    const freqHz = freqGHz * 1e9;
    const wavelength = freqHz > 0 ? c / freqHz : 0;
    document.getElementById('fspl-wavelength').textContent = fmtEng(wavelength, 'm');

    // Path loss rate (dB/km)
    const lossRate = distKm > 0 ? fspl / distKm : 0;
    document.getElementById('fspl-rate').textContent = fmt(lossRate) + ' dB/km';

    // Atmospheric loss
    const atmoLoss = atmoPerKm * distKm;

    // Total loss
    const totalLoss = fspl + atmoLoss + extraLoss;
    document.getElementById('fspl-total-loss').textContent = fmt(totalLoss) + ' dB';

    // Rx power
    const eirp = txPower + txGain;
    const rxPower = eirp - totalLoss + rxGain;
    document.getElementById('fspl-rx-power').textContent = fmt(rxPower) + ' dBm';

    // Link margin
    const margin = rxPower - rxSens;
    document.getElementById('fspl-margin').textContent = fmt(margin) + ' dB';

    const statusEl = document.getElementById('fspl-status');
    const marginBox = statusEl.parentElement;
    if (margin >= 10) {
        marginBox.classList.remove('negative');
        statusEl.textContent = currentLang === 'zh' ? '✅ 链路良好' : '✅ Link Good';
    } else if (margin >= 0) {
        marginBox.classList.remove('negative');
        statusEl.textContent = currentLang === 'zh' ? '⚠️ 余量不足' : '⚠️ Marginal';
    } else {
        marginBox.classList.add('negative');
        statusEl.textContent = currentLang === 'zh' ? '❌ 链路失败' : '❌ Link Failed';
    }

    // Formula live
    updateFormula('fml-fspl1',
        '20·log₁₀(' + fmt(distKm) + ') + 20·log₁₀(' + fmt(freqMHz) + ') + 32.44 = ' + fmt(fspl) + ' dB');
    updateFormula('fml-fspl2',
        '20·log₁₀(' + fmt(distKm) + ') + 20·log₁₀(' + fmt(freqGHz) + ') + 92.45 = ' + fmt(fspl) + ' dB');
    updateFormula('fml-fspl-rx',
        fmt(txPower) + ' + ' + fmt(txGain) + ' + ' + fmt(rxGain) + ' − ' + fmt(totalLoss) + ' = ' + fmt(rxPower) + ' dBm');
}


// ====================================================================
// TRANSMISSION LINE CALCULATOR
// ====================================================================
const TL_C0 = 299792458;
const TL_ETA0 = 376.730313461;
const TL_INCH_M = 0.0254;
const TL_MM_M = 0.001;

// Complete elliptic integral K(m) via arithmetic-geometric mean
function ellipK(m) {
    if (m <= 0) return Math.PI / 2;
    if (m >= 1) return Infinity;
    let a = 1.0, b = Math.sqrt(1.0 - m);
    for (let i = 0; i < 50; i++) {
        let a1 = (a + b) / 2;
        let b1 = Math.sqrt(a * b);
        a = a1; b = b1;
        if (Math.abs(a - b) < 1e-15) break;
    }
    return Math.PI / (2 * a);
}

function ellipK_ratio(k) {
    if (k <= 0) return 0;
    if (k >= 1) return Infinity;
    let kp = Math.sqrt(1 - k * k);
    return ellipK(k * k) / ellipK(kp * kp);
}

// Microstrip (Hammerstad-Jensen)
function tlMicrostrip(W, H, T, er) {
    let u = W / H;
    let W_eff = W;
    if (T > 0) {
        let delta;
        if (u <= 1 / (2 * Math.PI)) {
            delta = (T / Math.PI) * (1 + Math.log(4 * Math.PI * W / T));
        } else {
            delta = (T / Math.PI) * (1 + Math.log(2 * H / T));
        }
        let t_h = T / H;
        let cf = 1 - 0.5 * t_h / (er + 1);
        W_eff = W + delta * cf;
    }
    let ue = W_eff / H;
    let a = 1 + (1/49) * Math.log((Math.pow(ue, 4) + Math.pow(ue/52, 2)) / (Math.pow(ue, 4) + 0.432))
           + (1/18.7) * Math.log(1 + Math.pow(ue/18.1, 3));
    let b = 0.564 * Math.pow((er - 0.9) / (er + 3), 0.053);
    let eoeff = (er + 1) / 2 + ((er - 1) / 2) * Math.pow(1 + 10 / ue, -a * b);
    let f = 6 + (2 * Math.PI - 6) * Math.exp(-Math.pow(30.666 / ue, 0.7528));
    let z0_air = (TL_ETA0 / (2 * Math.PI)) * Math.log(f / ue + Math.sqrt(1 + Math.pow(2 / ue, 2)));
    let z0 = z0_air / Math.sqrt(eoeff);
    let vp = TL_C0 / Math.sqrt(eoeff);
    let td_per_mm = TL_MM_M / vp;
    let L_per_mm = z0 * td_per_mm / TL_MM_M;
    let C_per_mm = td_per_mm / (z0 * TL_MM_M);
    return {
        z0: z0, eoeff: eoeff, vp: vp,
        td_per_mm: td_per_mm * 1e12,
        L_per_mm: L_per_mm * 1e9,
        C_per_mm: C_per_mm * 1e12,
        method: 'Hammerstad-Jensen'
    };
}

// Stripline (IPC-2141A)
function tlStripline(W, T, B, er) {
    let d = 0.8 * W + T;
    let z0 = (60 / Math.sqrt(er)) * Math.log(4 * B / (0.67 * Math.PI * d));
    let eoeff = er;
    let vp = TL_C0 / Math.sqrt(eoeff);
    let td_per_mm = TL_MM_M / vp;
    let L_per_mm = z0 * td_per_mm / TL_MM_M;
    let C_per_mm = td_per_mm / (z0 * TL_MM_M);
    return {
        z0: z0, eoeff: eoeff, vp: vp,
        td_per_mm: td_per_mm * 1e12,
        L_per_mm: L_per_mm * 1e9,
        C_per_mm: C_per_mm * 1e12,
        method: 'IPC-2141A Stripline'
    };
}

// CPWG (Wen formula)
function tlCPWG(W, S, H, er) {
    let k = W / (W + 2 * S);
    let a = Math.tanh(Math.PI * W / (4 * H));
    let b = Math.tanh(Math.PI * (W + 2 * S) / (4 * H));
    let k1 = a / b;
    let kk = ellipK_ratio(k);
    let kk1 = ellipK_ratio(k1);
    let eoeff = (1 + er * (1/kk) * kk1) / (1 + (1/kk) * kk1);
    let z0 = (60 * Math.PI / Math.sqrt(eoeff)) / (kk + kk1);
    let vp = TL_C0 / Math.sqrt(eoeff);
    let td_per_mm = TL_MM_M / vp;
    let L_per_mm = z0 * td_per_mm / TL_MM_M;
    let C_per_mm = td_per_mm / (z0 * TL_MM_M);
    return {
        z0: z0, eoeff: eoeff, vp: vp,
        td_per_mm: td_per_mm * 1e12,
        L_per_mm: L_per_mm * 1e9,
        C_per_mm: C_per_mm * 1e12,
        method: 'Wen CPWG'
    };
}

// Diff pair (microstrip/stripline)
function tlDiffPair(W, S, H, T, er, isStripline) {
    let base;
    if (isStripline) {
        base = tlStripline(W, T, H, er);
    } else {
        base = tlMicrostrip(W, H, T, er);
    }
    let z0 = base.z0;
    let s_h = S / H;
    let coupling = Math.exp(-1.9 * s_h);
    let zdiff = 2 * z0 * (1 - coupling);
    let zcomm = z0 / 2 * (1 + coupling);
    let zeven = z0 * (1 + coupling);
    let zodd = z0 * (1 - coupling);
    return {
        z0: z0, eoeff: base.eoeff, vp: base.vp,
        td_per_mm: base.td_per_mm,
        L_per_mm: base.L_per_mm,
        C_per_mm: base.C_per_mm,
        zdiff: zdiff, zcomm: zcomm, zeven: zeven, zodd: zodd,
        method: base.method + ' + Diff Pair'
    };
}

function calcTLine() {
    let type = document.getElementById('tl-type').value;
    let W = getVal('tl-w');
    let T = getVal('tl-t');
    let er = getVal('tl-er');
    let H = 0, B = 0, S = 0;
    
    if (type === 'microstrip' || type === 'cpwg' || type === 'diff-microstrip') {
        H = getVal('tl-h');
    }
    if (type === 'stripline' || type === 'diff-stripline') {
        B = getVal('tl-b');
    }
    if (type === 'cpwg' || type === 'diff-microstrip' || type === 'diff-stripline') {
        S = getVal('tl-s');
    }
    
    let result;
    if (type === 'microstrip') {
        result = tlMicrostrip(W, H, T, er);
    } else if (type === 'stripline') {
        result = tlStripline(W, T, B, er);
    } else if (type === 'cpwg') {
        result = tlCPWG(W, S, H, er);
    } else if (type === 'diff-microstrip') {
        result = tlDiffPair(W, S, H, T, er, false);
    } else if (type === 'diff-stripline') {
        result = tlDiffPair(W, S, B, T, er, true);
    }
    
    // Display results
    document.getElementById('tl-z0').textContent = fmt(result.z0, 2) + ' Ω';
    document.getElementById('tl-eoeff').textContent = fmt(result.eoeff, 4);
    document.getElementById('tl-vp').textContent = fmtEng(result.vp, 'm/s', 4);
    document.getElementById('tl-td').textContent = fmt(result.td_per_mm, 2) + ' ps/mm';
    document.getElementById('tl-l').textContent = fmt(result.L_per_mm, 3) + ' nH/mm';
    document.getElementById('tl-c').textContent = fmt(result.C_per_mm, 3) + ' pF/mm';
    
    // Show/hide differential results
    let diffDiv = document.getElementById('tl-diff-results');
    if (type.startsWith('diff-')) {
        diffDiv.style.display = 'block';
        document.getElementById('tl-zdiff').textContent = fmt(result.zdiff, 2) + ' Ω';
        document.getElementById('tl-zodd').textContent = fmt(result.zodd, 2) + ' Ω';
        document.getElementById('tl-zeven').textContent = fmt(result.zeven, 2) + ' Ω';
        document.getElementById('tl-zcm').textContent = fmt(result.zcomm, 2) + ' Ω';
    } else {
        diffDiv.style.display = 'none';
    }
    
    // Update formula live
    updateFormula('fml-tl-eoeff', '→ ε<sub>eff</sub> = ' + fmt(result.eoeff, 4));
    updateFormula('fml-tl-z0', '→ Z₀ = ' + fmt(result.z0, 2) + ' Ω');
    
    // Update SVG
    tlRenderSVG();
}

function tlSwitchType() {
    let type = document.getElementById('tl-type').value;
    let inputsDiv = document.getElementById('tl-inputs');
    let html = '';
    
    if (type === 'microstrip') {
        html = '<div class="form-group"><label>W — <span data-en="Trace Width" data-zh="线宽">线宽</span> (mm)</label><input type="number" id="tl-w" value="0.15" step="any" oninput="calcTLine()"></div><div class="form-group"><label>H — <span data-en="Substrate Height" data-zh="介质高度">介质高度</span> (mm)</label><input type="number" id="tl-h" value="0.10" step="any" oninput="calcTLine()"></div><div class="form-group"><label>T — <span data-en="Trace Thickness" data-zh="铜厚">铜厚</span> (mm)</label><input type="number" id="tl-t" value="0.035" step="any" oninput="calcTLine()"></div><div class="form-group"><label>ε<sub>r</sub> — <span data-en="Dielectric Constant" data-zh="介电常数">介电常数</span></label><input type="number" id="tl-er" value="4.4" step="any" oninput="calcTLine()"></div>';
    } else if (type === 'stripline') {
        html = '<div class="form-group"><label>W — <span data-en="Trace Width" data-zh="线宽">线宽</span> (mm)</label><input type="number" id="tl-w" value="0.13" step="any" oninput="calcTLine()"></div><div class="form-group"><label>T — <span data-en="Trace Thickness" data-zh="铜厚">铜厚</span> (mm)</label><input type="number" id="tl-t" value="0.035" step="any" oninput="calcTLine()"></div><div class="form-group"><label>B — <span data-en="Ground Spacing" data-zh="地平面间距">地平面间距</span> (mm)</label><input type="number" id="tl-b" value="0.50" step="any" oninput="calcTLine()"></div><div class="form-group"><label>ε<sub>r</sub> — <span data-en="Dielectric Constant" data-zh="介电常数">介电常数</span></label><input type="number" id="tl-er" value="4.4" step="any" oninput="calcTLine()"></div>';
    } else if (type === 'cpwg') {
        html = '<div class="form-group"><label>W — <span data-en="Signal Width" data-zh="信号线宽">信号线宽</span> (mm)</label><input type="number" id="tl-w" value="0.20" step="any" oninput="calcTLine()"></div><div class="form-group"><label>S — <span data-en="Gap Width" data-zh="间隙宽度">间隙宽度</span> (mm)</label><input type="number" id="tl-s" value="0.13" step="any" oninput="calcTLine()"></div><div class="form-group"><label>H — <span data-en="Substrate Height" data-zh="介质高度">介质高度</span> (mm)</label><input type="number" id="tl-h" value="0.10" step="any" oninput="calcTLine()"></div><div class="form-group"><label>ε<sub>r</sub> — <span data-en="Dielectric Constant" data-zh="介电常数">介电常数</span></label><input type="number" id="tl-er" value="4.4" step="any" oninput="calcTLine()"></div>';
    } else if (type === 'diff-microstrip') {
        html = '<div class="form-group"><label>W — <span data-en="Trace Width" data-zh="线宽">线宽</span> (mm)</label><input type="number" id="tl-w" value="0.13" step="any" oninput="calcTLine()"></div><div class="form-group"><label>H — <span data-en="Substrate Height" data-zh="介质高度">介质高度</span> (mm)</label><input type="number" id="tl-h" value="0.10" step="any" oninput="calcTLine()"></div><div class="form-group"><label>T — <span data-en="Trace Thickness" data-zh="铜厚">铜厚</span> (mm)</label><input type="number" id="tl-t" value="0.035" step="any" oninput="calcTLine()"></div><div class="form-group"><label>S — <span data-en="Gap Spacing" data-zh="间距">间距</span> (mm)</label><input type="number" id="tl-s" value="0.13" step="any" oninput="calcTLine()"></div><div class="form-group"><label>ε<sub>r</sub> — <span data-en="Dielectric Constant" data-zh="介电常数">介电常数</span></label><input type="number" id="tl-er" value="4.4" step="any" oninput="calcTLine()"></div>';
    } else if (type === 'diff-stripline') {
        html = '<div class="form-group"><label>W — <span data-en="Trace Width" data-zh="线宽">线宽</span> (mm)</label><input type="number" id="tl-w" value="0.13" step="any" oninput="calcTLine()"></div><div class="form-group"><label>T — <span data-en="Trace Thickness" data-zh="铜厚">铜厚</span> (mm)</label><input type="number" id="tl-t" value="0.035" step="any" oninput="calcTLine()"></div><div class="form-group"><label>B — <span data-en="Ground Spacing" data-zh="地平面间距">地平面间距</span> (mm)</label><input type="number" id="tl-b" value="0.50" step="any" oninput="calcTLine()"></div><div class="form-group"><label>S — <span data-en="Gap Spacing" data-zh="间距">间距</span> (mm)</label><input type="number" id="tl-s" value="0.13" step="any" oninput="calcTLine()"></div><div class="form-group"><label>ε<sub>r</sub> — <span data-en="Dielectric Constant" data-zh="介电常数">介电常数</span></label><input type="number" id="tl-er" value="4.4" step="any" oninput="calcTLine()"></div>';
    }
    
    inputsDiv.innerHTML = html;
}

// SVG Cross-section rendering
function tlRenderSVG() {
    let type = document.getElementById('tl-type').value;
    let container = document.getElementById('tl-svg-container');
    
    // Get current values in mm
    let W = getVal('tl-w');
    let T = getVal('tl-t');
    let er = getVal('tl-er');
    let H = 0, B = 0, S = 0;
    
    if (type === 'microstrip' || type === 'cpwg' || type === 'diff-microstrip') {
        H = getVal('tl-h');
    }
    if (type === 'stripline' || type === 'diff-stripline') {
        B = getVal('tl-b');
    }
    if (type === 'cpwg' || type === 'diff-microstrip' || type === 'diff-stripline') {
        S = getVal('tl-s');
    }
    
    let svg = '';
    if (type === 'microstrip') {
        svg = svgMicrostrip(W, H, T, er, getVal('tl-w'), getVal('tl-h'), getVal('tl-t'));
    } else if (type === 'stripline') {
        svg = svgStripline(W, T, B, er, getVal('tl-w'), getVal('tl-t'), getVal('tl-b'));
    } else if (type === 'cpwg') {
        svg = svgCPWG(W, S, H, T, er, getVal('tl-w'), getVal('tl-s'), getVal('tl-h'));
    } else if (type === 'diff-microstrip') {
        svg = svgDiffPair(W, S, H, T, er, false, getVal('tl-w'), getVal('tl-s'), getVal('tl-h'));
    } else if (type === 'diff-stripline') {
        svg = svgDiffPair(W, S, B, T, er, true, getVal('tl-w'), getVal('tl-s'), getVal('tl-b'));
    }
    
    container.innerHTML = svg;
}

function dimLine(x1, y1, x2, y2, label, side) {
    let svg = '';
    svg += '<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" stroke="#666" stroke-width="0.5"/>';
    if (side === 'h') {
        let mx = (x1 + x2) / 2;
        svg += '<text x="'+mx+'" y="'+(y1-4)+'" font-size="8" fill="#aaa" text-anchor="middle">'+label+'</text>';
    } else if (side === 'l') {
        let my = (y1 + y2) / 2;
        svg += '<text x="'+(x1-4)+'" y="'+my+'" font-size="8" fill="#aaa" text-anchor="end" dominant-baseline="middle">'+label+'</text>';
    } else if (side === 'r') {
        let my = (y1 + y2) / 2;
        svg += '<text x="'+(x1+4)+'" y="'+my+'" font-size="8" fill="#aaa" text-anchor="start" dominant-baseline="middle">'+label+'</text>';
    }
    return svg;
}

function svgMicrostrip(W, H, T, er, Wmm, Hmm, Tmm) {
    let VW = 400, VH = 220, PAD = 60;
    let PLOT_W = VW - 2 * PAD, PLOT_H = VH - 2 * PAD;
    let totalY = H + T;
    let yScale = PLOT_H / totalY;
    let xMax = Math.max(W * 4, totalY * 2);
    let xScale = PLOT_W / xMax;
    let groundY = PAD + PLOT_H;
    let dielTop = groundY - H * yScale;
    let stripTop = dielTop - T * yScale;
    let stripCx = PAD + PLOT_W / 2;
    let stripW = W * xScale;
    let stripX = stripCx - stripW / 2;
    
    return '<svg viewBox="0 0 '+VW+' '+VH+'" width="100%" style="max-width:400px;background:#0a1929;border-radius:8px;">'
        + '<rect x="'+PAD+'" y="'+groundY+'" width="'+PLOT_W+'" height="6" fill="#888"/>'
        + '<text x="'+(PAD+4)+'" y="'+(groundY+18)+'" font-size="9" fill="#888">ground</text>'
        + '<rect x="'+PAD+'" y="'+dielTop+'" width="'+PLOT_W+'" height="'+(H*yScale)+'" fill="#1a4a6e" opacity="0.7"/>'
        + '<text x="'+(PAD+6)+'" y="'+(dielTop+12)+'" font-size="9" fill="#5ba3d9" font-family="monospace">εr='+er.toFixed(2)+'</text>'
        + '<rect x="'+stripX+'" y="'+stripTop+'" width="'+stripW+'" height="'+(T*yScale)+'" fill="#ffd700" stroke="#b8960f" stroke-width="0.5"/>'
        + '<text x="'+stripCx+'" y="'+(stripTop-4)+'" font-size="9" fill="#ffd700" text-anchor="middle">signal</text>'
        + dimLine(stripX, stripTop-22, stripX+stripW, stripTop-22, 'W='+Wmm+'mm', 'h')
        + dimLine(PAD-22, dielTop, PAD-22, groundY, 'H='+Hmm+'mm', 'l')
        + dimLine(VW-PAD+22, stripTop, VW-PAD+22, dielTop, 'T='+Tmm+'mm', 'r')
        + '</svg>';
}

function svgStripline(W, T, B, er, Wmm, Tmm, Bmm) {
    let VW = 400, VH = 240, PAD = 60;
    let PLOT_W = VW - 2 * PAD, PLOT_H = VH - 2 * PAD;
    let yScale = PLOT_H / B;
    let topGround = PAD, botGround = PAD + B * yScale;
    let stripCy = (topGround + botGround) / 2;
    let stripTop = stripCy - (T * yScale) / 2;
    let stripCx = PAD + PLOT_W / 2;
    let xMax = Math.max(W * 4, B * 1.5);
    let xScale = PLOT_W / xMax;
    let stripW = W * xScale;
    let stripX = stripCx - stripW / 2;
    
    return '<svg viewBox="0 0 '+VW+' '+VH+'" width="100%" style="max-width:400px;background:#0a1929;border-radius:8px;">'
        + '<rect x="'+PAD+'" y="'+(topGround-4)+'" width="'+PLOT_W+'" height="4" fill="#888"/>'
        + '<rect x="'+PAD+'" y="'+botGround+'" width="'+PLOT_W+'" height="4" fill="#888"/>'
        + '<rect x="'+PAD+'" y="'+topGround+'" width="'+PLOT_W+'" height="'+(botGround-topGround)+'" fill="#1a4a6e" opacity="0.7"/>'
        + '<text x="'+(PAD+6)+'" y="'+(topGround+12)+'" font-size="9" fill="#5ba3d9" font-family="monospace">εr='+er.toFixed(2)+'</text>'
        + '<rect x="'+stripX+'" y="'+stripTop+'" width="'+stripW+'" height="'+(T*yScale)+'" fill="#ffd700" stroke="#b8960f" stroke-width="0.5"/>'
        + '<text x="'+(PAD+4)+'" y="'+(topGround-8)+'" font-size="9" fill="#888">ground</text>'
        + '<text x="'+(PAD+4)+'" y="'+(botGround+14)+'" font-size="9" fill="#888">ground</text>'
        + dimLine(stripX, stripTop-12, stripX+stripW, stripTop-12, 'W='+Wmm+'mm', 'h')
        + dimLine(PAD-22, topGround, PAD-22, botGround, 'B='+Bmm+'mm', 'l')
        + dimLine(VW-PAD+22, stripTop, VW-PAD+22, stripTop+T*yScale, 'T='+Tmm+'mm', 'r')
        + '</svg>';
}

function svgCPWG(W, S, H, T, er, Wmm, Smil, Hmm) {
    let VW = 440, VH = 220, PAD = 60;
    let PLOT_W = VW - 2 * PAD, PLOT_H = VH - 2 * PAD;
    let totalY = H + T;
    let yScale = PLOT_H / totalY;
    let totalX = W + 2 * S + 2 * Math.max(W, S * 2);
    let xScale = PLOT_W / totalX;
    let groundY = PAD + PLOT_H;
    let dielTop = groundY - H * yScale;
    let stripTop = dielTop - T * yScale;
    let stripCx = PAD + PLOT_W / 2;
    let stripW = W * xScale;
    let stripX = stripCx - stripW / 2;
    let gapW = S * xScale;
    
    return '<svg viewBox="0 0 '+VW+' '+VH+'" width="100%" style="max-width:440px;background:#0a1929;border-radius:8px;">'
        + '<rect x="'+PAD+'" y="'+groundY+'" width="'+PLOT_W+'" height="6" fill="#888"/>'
        + '<text x="'+(PAD+4)+'" y="'+(groundY+18)+'" font-size="9" fill="#888">ground</text>'
        + '<rect x="'+PAD+'" y="'+dielTop+'" width="'+PLOT_W+'" height="'+(H*yScale)+'" fill="#1a4a6e" opacity="0.7"/>'
        + '<text x="'+(PAD+6)+'" y="'+(dielTop+12)+'" font-size="9" fill="#5ba3d9" font-family="monospace">εr='+er.toFixed(2)+'</text>'
        + '<rect x="'+stripX+'" y="'+stripTop+'" width="'+stripW+'" height="'+(T*yScale)+'" fill="#ffd700" stroke="#b8960f" stroke-width="0.5"/>'
        + '<text x="'+stripCx+'" y="'+(stripTop-4)+'" font-size="9" fill="#ffd700" text-anchor="middle">signal</text>'
        + '<rect x="'+(stripX-stripW-gapW)+'" y="'+stripTop+'" width="'+stripW+'" height="'+(T*yScale)+'" fill="#666" stroke="#444" stroke-width="0.5"/>'
        + '<rect x="'+(stripX+stripW+gapW)+'" y="'+stripTop+'" width="'+stripW+'" height="'+(T*yScale)+'" fill="#666" stroke="#444" stroke-width="0.5"/>'
        + dimLine(stripX, stripTop-22, stripX+stripW, stripTop-22, 'W='+Wmm+'mm', 'h')
        + dimLine(stripX+stripW, stripTop-30, stripX+stripW+gapW, stripTop-30, 'S='+Smil+'mm', 'h')
        + dimLine(PAD-22, dielTop, PAD-22, groundY, 'H='+Hmm+'mm', 'l')
        + '</svg>';
}

function svgDiffPair(W, S, H, T, er, isStripline, Wmm, Smil, Hmm) {
    let VW = 440, VH = 220, PAD = 60;
    let PLOT_W = VW - 2 * PAD, PLOT_H = VH - 2 * PAD;
    let groundY, dielTop, stripTop, totalY;
    
    if (isStripline) {
        totalY = H;
        let yScale = PLOT_H / totalY;
        groundY = PAD + PLOT_H;
        dielTop = PAD;
        stripTop = (dielTop + groundY) / 2 - (T * yScale) / 2;
    } else {
        totalY = H + T;
        let yScale = PLOT_H / totalY;
        groundY = PAD + PLOT_H;
        dielTop = groundY - H * yScale;
        stripTop = dielTop - T * yScale;
    }
    
    let xMax = W * 6 + S * 4;
    let xScale = PLOT_W / xMax;
    let stripCx = PAD + PLOT_W / 2;
    let stripW = W * xScale;
    let gapW = S * xScale;
    let leftX = stripCx - gapW / 2 - stripW;
    let rightX = stripCx + gapW / 2;
    
    let svg = '<svg viewBox="0 0 '+VW+' '+VH+'" width="100%" style="max-width:440px;background:#0a1929;border-radius:8px;">';
    
    if (isStripline) {
        svg += '<rect x="'+PAD+'" y="'+(PAD-4)+'" width="'+PLOT_W+'" height="4" fill="#888"/>';
        svg += '<rect x="'+PAD+'" y="'+groundY+'" width="'+PLOT_W+'" height="4" fill="#888"/>';
        svg += '<rect x="'+PAD+'" y="'+PAD+'" width="'+PLOT_W+'" height="'+(groundY-PAD)+'" fill="#1a4a6e" opacity="0.7"/>';
    } else {
        svg += '<rect x="'+PAD+'" y="'+groundY+'" width="'+PLOT_W+'" height="6" fill="#888"/>';
        svg += '<rect x="'+PAD+'" y="'+dielTop+'" width="'+PLOT_W+'" height="'+(H*(PLOT_H/totalY))+'" fill="#1a4a6e" opacity="0.7"/>';
    }
    
    svg += '<text x="'+(PAD+6)+'" y="'+(isStripline?PAD+12:dielTop+12)+'" font-size="9" fill="#5ba3d9" font-family="monospace">εr='+er.toFixed(2)+'</text>';
    svg += '<rect x="'+leftX+'" y="'+stripTop+'" width="'+stripW+'" height="'+(T*(PLOT_H/totalY))+'" fill="#ffd700" stroke="#b8960f" stroke-width="0.5"/>';
    svg += '<rect x="'+rightX+'" y="'+stripTop+'" width="'+stripW+'" height="'+(T*(PLOT_H/totalY))+'" fill="#ffd700" stroke="#b8960f" stroke-width="0.5"/>';
    svg += '<text x="'+(leftX+stripW/2)+'" y="'+(stripTop-4)+'" font-size="9" fill="#ffd700" text-anchor="middle">+</text>';
    svg += '<text x="'+(rightX+stripW/2)+'" y="'+(stripTop-4)+'" font-size="9" fill="#ffd700" text-anchor="middle">−</text>';
    
    svg += dimLine(leftX, stripTop-18, leftX+stripW, stripTop-18, 'W='+Wmm+'mm', 'h');
    svg += dimLine(leftX+stripW, stripTop-30, rightX, stripTop-30, 'S='+Smil+'mm', 'h');
    svg += dimLine(PAD-22, isStripline?dielTop:groundY-H*(PLOT_H/totalY), PAD-22, groundY, isStripline?'B='+Hmm+'mm':'H='+Hmm+'mm', 'l');
    
    svg += '</svg>';
    return svg;
}
