/* ========================================
   RF Chain Calculator — Calculation Engine
   ======================================== */

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

function getVal(id) {
    return parseFloat(document.getElementById(id).value) || 0;
}

// ---------- Tab Navigation ----------
document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
    });
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
        fspl = 20 * Math.log10(distKm) + 20 * Math.log10(freqMHz) + 32.44;
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
        statusEl.textContent = '✅ Link OK — margin sufficient';
    } else {
        marginBox.classList.add('negative');
        statusEl.textContent = '❌ Link FAIL — insufficient margin';
    }
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
        const fspl = 20 * Math.log10(maxRangeKm) + 20 * Math.log10(freqGHz * 1000) + 32.44;
        document.getElementById('rad-fspl').textContent = fmt(fspl) + ' dB';
    } else {
        document.getElementById('rad-fspl').textContent = '— dB';
    }
}

// ====================================================================
// 3. PHASED ARRAY CALCULATOR
// ====================================================================
function calcPhasedArray() {
    const N = getVal('pa-elements') || 1;
    const elGainDbi = getVal('pa-el-gain');
    const spacingLambda = getVal('pa-spacing');
    const efficiency = getVal('pa-efficiency');
    const freqGHz = getVal('pa-freq');
    const noiseTempK = getVal('pa-noise-temp');
    const powerPerElDbm = getVal('pa-power-el');

    // Array gain = 10*log10(η * N) + element_gain (simplified)
    // More accurately: Array Gain = 10*log10(η * N * G_el_linear)
    const elGainLin = dBiToLinear(elGainDbi);
    const arrayGainLin = efficiency * N * elGainLin;
    const arrayGainDbi = linearToDb(arrayGainLin);

    document.getElementById('pa-array-gain').textContent = fmt(arrayGainDbi) + ' dBi';

    // EIRP = P_total + Array Gain
    // P_total = P_per_element + 10*log10(N)
    const totalPowerDbm = powerPerElDbm + 10 * Math.log10(N);
    const eirp = totalPowerDbm + arrayGainDbi;
    document.getElementById('pa-eirp').textContent = fmt(eirp) + ' dBm';
    document.getElementById('pa-eirp-w').textContent = fmtEng(dBmToW(eirp), 'W');

    // G/T
    if (noiseTempK > 0) {
        const gt = arrayGainDbi - 10 * Math.log10(noiseTempK);
        document.getElementById('pa-gt').textContent = fmt(gt) + ' dB/K';
    } else {
        document.getElementById('pa-gt').textContent = '— dB/K';
    }

    // 3-dB Beamwidth (for 1D linear array approximation)
    // θ ≈ 0.886 * λ / (N * d) in radians, convert to degrees
    const freqHz = freqGHz * 1e9;
    const lambda = 299792458 / freqHz;
    const arrayLength = N * spacingLambda * lambda;
    let beamwidth = 0;
    if (arrayLength > 0) {
        beamwidth = 2 * Math.asin(0.443 * lambda / arrayLength) * (180 / Math.PI);
        // Simplified: θ ≈ 50.8 * λ / (N * d) degrees
        beamwidth = 50.8 * lambda / arrayLength;
    }
    document.getElementById('pa-beamwidth').textContent = fmt(beamwidth, 2) + '°';

    // Array Area (assuming square array for 2D)
    const elementsPerSide = Math.sqrt(N);
    const sideLength = elementsPerSide * spacingLambda * lambda;
    const area = sideLength * sideLength;
    document.getElementById('pa-area').textContent = fmt(area, 4) + ' m² (' + fmt(sideLength * 100, 1) + ' cm × ' + fmt(sideLength * 100, 1) + ' cm)';
}

// ====================================================================
// 4. UNIT CONVERSION — dBm ↔ mW
// ====================================================================
function ucDbmToMw() {
    const dbm = getVal('uc-dbm');
    const mw = dBmToMw(dbm);
    const w = dBmToW(dbm);
    document.getElementById('uc-mw').textContent = fmt(mw, 3) + ' mW';
    document.getElementById('uc-w').textContent = fmtEng(w, 'W');
}

function ucMwToDbm() {
    const mw = getVal('uc-mw-input');
    const dbm = mwToDbm(mw);
    document.getElementById('uc-mw-result').textContent = fmt(dbm) + ' dBm';
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
}

function ucDbdToDbi() {
    const dbd = getVal('uc-dbd-input');
    const dbi = dbd + 2.15;
    document.getElementById('uc-dbi-result').textContent = fmt(dbi) + ' dBi';
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
    } else {
        document.getElementById('uc-wavelength-mm').textContent = '— mm';
        document.getElementById('uc-quarter-wave').textContent = '— mm';
    }
}

function ucWavelengthToFreq() {
    const wavelengthMM = getVal('uc-wavelength-input');
    if (wavelengthMM > 0) {
        const wavelengthM = wavelengthMM / 1000;
        const freqMHz = 299792458 / wavelengthM / 1e6;
        document.getElementById('uc-freq-result').textContent = fmt(freqMHz, 2) + ' MHz (' + fmt(freqMHz / 1000, 3) + ' GHz)';
    } else {
        document.getElementById('uc-freq-result').textContent = '— MHz';
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
}

function ucRlToVswr() {
    const rl = getVal('uc-rl-input');
    if (rl <= 0) return;
    const gamma = Math.pow(10, -rl / 20);
    const vswr = (1 + gamma) / (1 - gamma);
    document.getElementById('uc-vswr-result').textContent = fmt(vswr, 2);
}

// ====================================================================
// 8. PULSE ENERGY CALCULATOR
// ====================================================================
function calcPulse() {
    const peakPowerKW = getVal('pc-peak-power');
    const pulseWidthUs = getVal('pc-pulse-width');
    const prf = getVal('pc-prf');

    const peakPowerW = peakPowerKW * 1000;
    const pulseWidthS = pulseWidthUs * 1e-6;

    // Pulse Energy = Peak Power × Pulse Width
    const energyJ = peakPowerW * pulseWidthS;
    document.getElementById('pc-energy').textContent = fmtEng(energyJ, 'J');

    // Average Power = Peak Power × Duty Cycle
    const dutyCycle = pulseWidthS * prf;
    const avgPowerW = peakPowerW * dutyCycle;
    document.getElementById('pc-avg-power').textContent = fmtEng(avgPowerW, 'W');

    // Duty Cycle
    document.getElementById('pc-duty').textContent = fmt(dutyCycle * 100, 4) + ' %';

    // PRI
    if (prf > 0) {
        const priUs = 1e6 / prf;
        document.getElementById('pc-pri').textContent = fmt(priUs, 2) + ' μs';
    } else {
        document.getElementById('pc-pri').textContent = '— μs';
    }

    // Max Unambiguous Range = c / (2 × PRF)
    if (prf > 0) {
        const maxRangeM = 299792458 / (2 * prf);
        document.getElementById('pc-max-range').textContent = fmt(maxRangeM / 1000, 2) + ' km (' + fmt(maxRangeM / 1852, 1) + ' nmi)';
    } else {
        document.getElementById('pc-max-range').textContent = '— km';
    }
}

// ====================================================================
// 9. CAPACITOR ENERGY CALCULATOR
// ====================================================================
function calcCapacitor() {
    const capacitanceUF = getVal('pc-cap');
    const voltageV = getVal('pc-voltage');
    const resistanceR = getVal('pc-resistance');

    const capF = capacitanceUF * 1e-6;

    // E = 0.5 * C * V²
    const energyJ = 0.5 * capF * voltageV * voltageV;
    document.getElementById('pc-cap-energy').textContent = fmtEng(energyJ, 'J');

    // Q = C * V
    const chargeC = capF * voltageV;
    document.getElementById('pc-cap-charge').textContent = fmt(chargeC, 3) + ' C';

    // τ = R * C
    if (resistanceR > 0) {
        const tauS = resistanceR * capF;
        document.getElementById('pc-tau').textContent = fmtEng(tauS, 's');

        // I_peak = V / R
        const peakCurrentA = voltageV / resistanceR;
        document.getElementById('pc-peak-current').textContent = fmtEng(peakCurrentA, 'A');
    } else {
        document.getElementById('pc-tau').textContent = '— s';
        document.getElementById('pc-peak-current').textContent = '— A';
    }
}

// ====================================================================
// INITIAL CALCULATION
// ====================================================================
document.addEventListener('DOMContentLoaded', () => {
    calcLinkBudget();
    calcRadar();
    calcPhasedArray();
    ucDbmToMw();
    ucMwToDbm();
    ucDbiToDbd();
    ucDbdToDbi();
    ucFreqToWavelength();
    ucWavelengthToFreq();
    ucVswrToRl();
    ucRlToVswr();
    calcPulse();
    calcCapacitor();
});
