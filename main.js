// RTP Control
let RTP = { jackpot: 0.1, fs15: 0.5, fs5: 5.0, anywin: 30.0 };
// Game state
let playerBalance = 100000, jackpotPool = 0, freeSpins = 0, freeSpinActive = false, freeSpinTotalWin = 0, pendingFreeSpins = 0;
const betTable = []; let bet = 10;
while (bet <= 100000) { betTable.push(bet); bet *= 2; }
let betIndex = 0;
const suits = ['♠', '♥', '♦', '♣'];
const ranks = ['A', ...Array.from({length: 9}, (_,i) => String(i+2)), '10', 'J', 'Q', 'K'];
const ROWS = 5, COLS = 5;
const WIN_COLORS = ['#ffd700', '#6ef170', '#67d6ff', '#e87be8', '#ffad7a', '#e06666', '#a491d3', '#f9b800', '#6ecfff', '#bbd646'];
let historyList = [];
let lastSpinExplainer = null;
let spinning = false, autoSpinActive = false, autoSpinTimer = null;

// --- UI Update ---
function updateBetDisplay() { document.getElementById('bet-amount').innerText = betTable[betIndex]; }
function updateBalanceDisplay() {
  document.getElementById('balance').innerText = playerBalance.toFixed(0);
  document.getElementById('jackpot').innerText = jackpotPool.toFixed(0);
}
updateBetDisplay(); updateBalanceDisplay();

// --- Bet ---
document.getElementById('plus').onclick = function() { if (betIndex < betTable.length - 1) betIndex++; updateBetDisplay(); };
document.getElementById('minus').onclick = function() { if (betIndex > 0) betIndex--; updateBetDisplay(); };

// --- Matrix Generators ---
function getForcedRandomCardMatrix() {
  let r = Math.random(), jpR = RTP.jackpot/100, fs15R = RTP.fs15/100, fs5R = RTP.fs5/100, winR = RTP.anywin/100;
  if (r < jpR) return makeJackpotMatrix();
  if (r < jpR + fs15R) return makeFS15Matrix();
  if (r < jpR + fs15R + fs5R) return makeFS5Matrix();
  if (r < jpR + fs15R + fs5R + winR) return makeAnyWinMatrix();
  return makeRandomNonWinMatrix();
}
function makeEmptyMatrix() { return Array.from({length:5},()=>Array.from({length:5})); }
function randomNonJokerA() {
  let values = [2,3,4,5,6,7,8,9,10,'J','Q','K'], v = values[Math.floor(Math.random()*values.length)];
  let s = suits[Math.floor(Math.random()*suits.length)];
  let numVal = typeof v === 'number' ? v : 10;
  return {label:String(v)+s, value:numVal, suit:s};
}
function shuffle(arr) { for (let i=arr.length-1;i>0;i--) { let j = Math.floor(Math.random()*(i+1)); [arr[i],arr[j]] = [arr[j],arr[i]]; } }
function makeJackpotMatrix() {
  let m = makeEmptyMatrix(); m[2][2] = {label: 'A♠', value: 1, suit: '♠'};
  let places = []; for (let r=0;r<5;r++) for (let c=0;c<5;c++) if (!(r==2&&c==2)) places.push([r,c]); shuffle(places);
  for (let i=0; i<4; i++) { let [r,c] = places[i]; m[r][c] = {label: 'Joker', value: 'Joker', suit: 'Joker'}; }
  for (let r=0;r<5;r++) for (let c=0;c<5;c++) { if (!m[r][c]) m[r][c] = randomNonJokerA(); }
  return m;
}
function makeFS15Matrix() {
  let m = makeEmptyMatrix(); let places = [];
  for (let r=0;r<5;r++) for (let c=0;c<5;c++) places.push([r,c]);
  shuffle(places);
  for (let i=0;i<5;i++) { let [r,c]=places[i]; m[r][c] = {label:'Joker', value:'Joker', suit:'Joker'}; }
  for (let r=0;r<5;r++) for (let c=0;c<5;c++) { if (!m[r][c]) m[r][c] = randomNonJokerA(); }
  return m;
}
function makeFS5Matrix() {
  let m = makeEmptyMatrix(); let numJokers = Math.random()<0.5 ? 3 : 4, places = [];
  for (let r=0;r<5;r++) for (let c=0;c<5;c++) places.push([r,c]); shuffle(places);
  for (let i=0;i<numJokers;i++) { let [r,c]=places[i]; m[r][c] = {label:'Joker', value:'Joker', suit:'Joker'}; }
  for (let r=0;r<5;r++) for (let c=0;c<5;c++) { if (!m[r][c]) m[r][c] = randomNonJokerA(); }
  return m;
}
function makeAnyWinMatrix() {
  let m = makeEmptyMatrix(), lines = getAllLines(), idx = Math.floor(Math.random()*lines.length), line = lines[idx];
  m[line[0][0]][line[0][1]] = {label:'1♠', value:1, suit:'♠'};
  m[line[1][0]][line[1][1]] = {label:'3♣', value:3, suit:'♣'};
  m[line[2][0]][line[2][1]] = {label:'6♦', value:6, suit:'♦'};
  m[line[3][0]][line[3][1]] = {label:'2♥', value:2, suit:'♥'};
  m[line[4][0]][line[4][1]] = {label:'2♠', value:2, suit:'♠'};
  for (let r=0;r<5;r++) for (let c=0;c<5;c++) { if (!m[r][c]) m[r][c] = randomNonJokerA(); }
  return m;
}
function makeRandomNonWinMatrix() {
  let m = makeEmptyMatrix(); for (let r=0;r<5;r++) for (let c=0;c<5;c++) { m[r][c] = randomNonJokerA(); } return m;
}
function getAllLines() {
  let lines = [];
  for (let r = 0; r < 5; r++) lines.push([[r,0],[r,1],[r,2],[r,3],[r,4]]);
  for (let c = 0; c < 5; c++) lines.push([[0,c],[1,c],[2,c],[3,c],[4,c]]);
  lines.push([[0,0],[1,1],[2,2],[3,3],[4,4]]);
  lines.push([[0,4],[1,3],[2,2],[3,1],[4,0]]);
  return lines;
}
function slotWinLogic(matrix) {
  let jokerCount = 0, centerA = false;
  for (let r=0;r<5;r++) for (let c=0;c<5;c++) {
    if (matrix[r][c].label === 'Joker') jokerCount++;
    if (r===2 && c===2 && matrix[2][2].label.startsWith('A')) centerA = true;
  }
  let newFreeSpins = 0, isJackpot = false;
  if ((jokerCount === 3 || jokerCount === 4)) newFreeSpins = 5;
  if (jokerCount === 5) newFreeSpins = 15;
  if (jokerCount === 4 && centerA) isJackpot = true;
  let lines = getAllLines();
  let totalWin = 0, winLines = [], winDetails = [];
  for (let idx=0; idx<lines.length; idx++) {
    let line = lines[idx];
    let lineType = idx<5 ? "Row" : idx<10 ? "Col" : "Diag";
    let multiplier = lineType === "Row" ? 10 : lineType === "Col" ? 20 : 30;
    let lineCards = line.map(([r,c])=>matrix[r][c]);
    if (lineCards.some(card=>card.label==='Joker')) continue;
    let idxs = [0,1,2,3,4];
    let combos = [
      [0,1,2],[0,1,3],[0,1,4],[0,2,3],[0,2,4],[0,3,4],
      [1,2,3],[1,2,4],[1,3,4],[2,3,4]
    ];
    for (let combo of combos) {
      let three = combo.map(i=>lineCards[i].value);
      let rest = idxs.filter(i=>!combo.includes(i)).map(i=>lineCards[i].value);
      let sum3 = three.reduce((a,b)=>a+b,0);
      let sum2 = rest.reduce((a,b)=>a+b,0);
      if ([10,20,30].includes(sum3)) {
        let payout = sum2 % 10; if (payout===0) payout = 10;
        winLines.push(line);
        winDetails.push({
          line, lineIndex: idx, payout, lineType, multiplier,
          symbolStr: lineCards.map(x=>x.label).join(' '),
        });
        totalWin += payout / multiplier;
        break;
      }
    }
  }
  return {totalWin, winLines, newFreeSpins, winDetails, isJackpot};
}

// --- Animation ---
function animateReelsToResult(resultMatrix, onComplete) {
  const container = document.getElementById('slot-reels');
  container.innerHTML = '';
  let slotCards = [];
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      let el = document.createElement('div');
      el.className = 'card spinning';
      el.innerText = '';
      container.appendChild(el);
      slotCards.push(el);
    }
  }
  let colTimers = [];
  for (let c = 0; c < 5; c++) {
    (function(colIdx){
      let spinTime = 350 + colIdx * 140 + Math.random()*80;
      let tick = 0;
      colTimers[colIdx] = setInterval(()=>{
        for (let r=0;r<5;r++) {
          let i = r*5 + colIdx;
          let v = Math.floor(Math.random() * 12) + 1;
          let suit = suits[Math.floor(Math.random()*4)];
          slotCards[i].innerText = String(v)+suit;
          slotCards[i].className = 'card spinning' + ((suit==='♥'||suit==='♦')?' red':'');
        }
        tick++;
      }, 50 + Math.random()*10);
      setTimeout(()=>{
        clearInterval(colTimers[colIdx]);
        for (let r=0;r<5;r++) {
          let i = r*5 + colIdx;
          let card = resultMatrix[r][colIdx];
          let red = (card.suit==='♥'||card.suit==='♦');
          slotCards[i].innerText = card.label;
          slotCards[i].className = 'card' + (red?' red':'') + ' show';
        }
        if (colIdx===4 && onComplete) setTimeout(onComplete, 180);
      }, spinTime);
    })(c);
  }
}

// --- Highlight win lines ---
function highlightWinLines(resultMatrix, winLines, isJackpot, winDetails, bet, onDone, fsType) {
  const container = document.getElementById('slot-reels');
  let slotCards = Array.from(container.children);
  let highlightIdx = 0;
  function highlightNext() {
    slotCards.forEach(card => {
      card.classList.remove('row-win', 'col-win', 'diag-win', 'fs5', 'fs15', 'jackpot', 'win');
    });
    if (highlightIdx >= winLines.length) {
      if (isJackpot) slotCards[2*5+2].classList.add('jackpot');
      if (fsType === 5) slotCards.forEach(card=>card.classList.add('fs5'));
      if (fsType === 15) slotCards.forEach(card=>card.classList.add('fs15'));
      if (onDone) onDone();
      return;
    }
    let line = winLines[highlightIdx];
    let win = winDetails[highlightIdx];
    let cssClass = win.lineType === "Row" ? 'row-win' : win.lineType === "Col" ? 'col-win' : 'diag-win';
    line.forEach(([r,c]) => {
      let idx = r*5 + c;
      slotCards[idx].classList.add(cssClass, 'win');
    });
    let thisPayout = (bet / win.multiplier) * win.payout;
    document.getElementById('win').innerText =
      `Line ${win.lineType} ${win.lineIndex%5+1}: ` +
      `${win.payout}x [bet/${win.multiplier}] = ${thisPayout}`;
    setTimeout(()=>{ highlightIdx++; highlightNext(); }, 750);
  }
  if (winLines.length) highlightNext();
  else {
    slotCards.forEach(card=>card.classList.remove('row-win', 'col-win', 'diag-win', 'fs5', 'fs15', 'jackpot', 'win'));
    if (isJackpot) slotCards[2*5+2].classList.add('jackpot');
    if (fsType === 5) slotCards.forEach(card=>card.classList.add('fs5'));
    if (fsType === 15) slotCards.forEach(card=>card.classList.add('fs15'));
    if (onDone) onDone();
  }
}

// --- Win Table Display ---
function showWinTable(winDetails, bet) {
  const winTableDiv = document.getElementById('win-table');
  if (!winTableDiv) return;
  winTableDiv.innerHTML = '';
  if (winDetails.length === 0) return;
  let table = document.createElement('table');
  table.className = 'win-table';
  let thead = document.createElement('thead');
  thead.innerHTML = `<tr>
    <th>#</th><th>Line</th><th>Symbols</th><th>Win</th>
  </tr>`;
  table.appendChild(thead);
  let tbody = document.createElement('tbody');
  winDetails.forEach((w,i)=>{
    let tr = document.createElement('tr');
    tr.style.background = WIN_COLORS[i % WIN_COLORS.length] + '22';
    tr.style.color = WIN_COLORS[i % WIN_COLORS.length];
    let payout = (bet / w.multiplier) * w.payout;
    tr.innerHTML = `<td>${i+1}</td>
      <td>${w.lineType} ${w.lineIndex%5+1}</td>
      <td>${w.symbolStr}</td>
      <td>${w.payout}x [bet/${w.multiplier}] = ${payout}</td>`;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  winTableDiv.appendChild(table);
}

// --- "How Win?" Explainer logic ---
function updateHowWinBtn(state) {
  let btn = document.getElementById('howwin-btn');
  if (state && lastSpinExplainer) btn.style.display = '';
  else btn.style.display = 'none';
}
document.getElementById('howwin-btn').onclick = function() { showHowWinOverlay(); };
document.getElementById('close-howwin').onclick = function() {
  document.getElementById('howwin-page').classList.remove('active');
};
function showHowWinOverlay() {
  let d = lastSpinExplainer;
  if (!d) return;
  let html = `<div style="font-size:1.13em;"><b>Spin Explanation</b></div>`;
  html += `<table class="win-table" style="margin:6px 0 7px 0"><thead>
    <tr><th>Line</th><th>Type</th><th>Formula</th><th>Payout</th></tr></thead><tbody>`;
  d.winDetails.forEach((w,i)=>{
    let pay = (d.bet/w.multiplier)*w.payout;
    html += `<tr>
      <td>${w.lineType} ${w.lineIndex%5+1}</td>
      <td>${w.lineType}</td>
      <td>(${d.bet} / ${w.multiplier}) × ${w.payout}</td>
      <td style="font-weight:bold">${pay}</td>
    </tr>`;
  });
  if (d.winDetails.length === 0) {
    html += `<tr><td colspan="4" style="color:#a60;font-style:italic">No payline match</td></tr>`;
  }
  html += `</tbody></table>`;
  html += `<div style="margin-top:2px">`;
  if (d.fsType === 5) html += `<span style="color:#e44"><b>5 Free Spins Triggered!</b></span><br>`;
  if (d.fsType === 15) html += `<span style="color:#0d4"><b>15 Free Spins Triggered!</b></span><br>`;
  if (d.isJackpot) html += `<span style="color:#e5b70a"><b>JACKPOT!</b></span><br>`;
  html += `</div>`;
  html += `<div style="margin:6px 0 0 0;font-size:0.98em;color:#995">Paylines: Rows=Red, Cols=Blue, Diags=Silver.</div>`;
  document.getElementById('howwin-results').innerHTML = html;
  document.getElementById('howwin-page').classList.add('active');
}

// --- Main SPIN HANDLER ---
function recordHistory({spinType, bet, totalWin, winLines, isJackpot, fsAwarded}) {
  historyList.unshift({ time: new Date().toLocaleTimeString(), spinType, bet, win: totalWin, lines: winLines.length, jackpot: isJackpot, fs: fsAwarded });
  if (historyList.length > 200) historyList.pop();
}
function doSpin(freeSpin=false, spinCallback=null) {
  if (spinning) return;
  spinning = true;
  document.getElementById('win').innerText = '';
  showWinTable([], betTable[betIndex]);
  document.getElementById('fs-total').innerText = '';
  let matrix = getForcedRandomCardMatrix();
  animateReelsToResult(matrix, ()=>{
    let {totalWin, winLines, newFreeSpins, winDetails, isJackpot} = slotWinLogic(matrix);
    let thisBet = betTable[betIndex];
    let fsType = 0;
    if (newFreeSpins === 5) fsType = 5;
    if (newFreeSpins === 15) fsType = 15;
    lastSpinExplainer = {
      bet: thisBet,
      winDetails,
      winLines,
      isJackpot,
      fsType,
      newFreeSpins,
      matrix: matrix.map(row => row.map(card => ({...card})))
    };
    updateHowWinBtn(true);
    function afterWin() {
      setTimeout(()=>{
        showWinTable(winDetails, thisBet);
        if (!freeSpin && newFreeSpins > 0) {
          freeSpins += newFreeSpins;
          document.getElementById('free-spin-status').innerText = `Free Spins: ${freeSpins}`;
        }
        if (freeSpin && newFreeSpins > 0) {
          pendingFreeSpins += newFreeSpins;
          document.getElementById('free-spin-status').innerText = `Free Spins: ${freeSpins + pendingFreeSpins}`;
        }
        if (isJackpot) {
          let jackAmount = Math.floor(jackpotPool * 1.0);
          playerBalance += jackAmount;
          document.getElementById('win').innerText += ` | JACKPOT +${jackAmount}!`;
          jackpotPool = 0;
          updateBalanceDisplay();
        }
        // Calculate final total win (sum each line payout with its multiplier)
        let winAmount = 0;
        winDetails.forEach(w => { winAmount += (thisBet / w.multiplier) * w.payout; });
        if (winAmount > 0) {
          playerBalance += winAmount;
          updateBalanceDisplay();
          if (freeSpin) freeSpinTotalWin += winAmount;
          document.getElementById('win').innerText = `WIN: ${winAmount}`;
        } else {
          document.getElementById('win').innerText = 'No win';
        }
        if (freeSpin) {
          if (freeSpins > 0) {
            freeSpins--;
            document.getElementById('free-spin-status').innerText = `Free Spins: ${freeSpins + pendingFreeSpins}`;
            setTimeout(()=>doSpin(true, spinCallback), 950);
          } else if (pendingFreeSpins > 0) {
            freeSpins = pendingFreeSpins;
            pendingFreeSpins = 0;
            setTimeout(()=>doSpin(true, spinCallback), 950);
          } else {
            freeSpinActive = false;
            document.getElementById('free-spin-status').innerText = '';
            document.getElementById('fs-total').innerText = `Free Spins Total Win: ${freeSpinTotalWin}`;
            freeSpinTotalWin = 0;
            if (spinCallback) spinCallback();
          }
        }
        spinning = false;
        recordHistory({
          spinType: freeSpin ? (freeSpinActive ? "Free" : "Buy FS") : "Main",
          bet: thisBet,
          totalWin: winAmount,
          winLines,
          isJackpot,
          fsAwarded: newFreeSpins
        });
      }, 400);
    }
    highlightWinLines(matrix, winLines, isJackpot, winDetails, thisBet, afterWin, fsType);
  });
}
document.getElementById('spin').onclick = function() {
  if (freeSpins > 0 && !freeSpinActive) {
    freeSpinActive = true; freeSpinTotalWin = 0; doSpin(true);
  } else {
    if (playerBalance >= betTable[betIndex]) {
      playerBalance -= betTable[betIndex];
      jackpotPool += betTable[betIndex] * 0.1;
      updateBalanceDisplay();
      doSpin(false);
    } else {
      document.getElementById('win').innerText = "Not enough balance!";
    }
  }
};
document.getElementById('auto-spin').onclick = function() {
  if (!autoSpinActive) {
    autoSpinActive = true;
    document.getElementById('auto-spin').innerText = "Stop";
    autoSpinTimer = setInterval(()=>{
      if (playerBalance >= betTable[betIndex] && !freeSpinActive) {
        playerBalance -= betTable[betIndex];
        jackpotPool += betTable[betIndex] * 0.1;
        updateBalanceDisplay();
        doSpin(false);
      } else if (!freeSpinActive) {
        autoSpinActive = false;
        clearInterval(autoSpinTimer);
        document.getElementById('auto-spin').innerText = "Auto";
        document.getElementById('win').innerText = 'Auto stopped: Not enough balance!';
      }
    }, 1050);
  } else {
    autoSpinActive = false;
    clearInterval(autoSpinTimer);
    document.getElementById('auto-spin').innerText = "Auto";
    document.getElementById('win').innerText = 'Auto stopped!';
  }
};
document.getElementById('buy-free-spin').onclick = function() {
  let spins = 15;
  let cost = betTable[betIndex]*100*5;
  if (playerBalance < cost) {
    alert("Not enough balance!");
    return;
  }
  if (confirm(`Buy ${spins} free spins for ${cost} credits?`)) {
    playerBalance -= cost;
    updateBalanceDisplay();
    freeSpins += spins;
    document.getElementById('free-spin-status').innerText = `Free Spins: ${freeSpins}`;
    // Show all cards as green highlight (fs15) until spin
    const cards = document.querySelectorAll('#slot-reels .card');
    cards.forEach(c=>{c.classList.remove('fs5','fs15','row-win','col-win','diag-win','jackpot','win'); c.classList.add('fs15');});
  }
};
// --- RTP Overlay ---
document.getElementById('rtp-btn').onclick = function() {
  document.getElementById('rtp-jackpot').value = RTP.jackpot;
  document.getElementById('rtp-fs15').value = RTP.fs15;
  document.getElementById('rtp-fs5').value = RTP.fs5;
  document.getElementById('rtp-anywin').value = RTP.anywin;
  document.getElementById('rtp-page').classList.add('active');
};
document.getElementById('close-rtp').onclick = function() {
  document.getElementById('rtp-page').classList.remove('active');
};
document.getElementById('rtp-save').onclick = function() {
  let jp = parseFloat(document.getElementById('rtp-jackpot').value)||0;
  let f15 = parseFloat(document.getElementById('rtp-fs15').value)||0;
  let f5 = parseFloat(document.getElementById('rtp-fs5').value)||0;
  let aw = parseFloat(document.getElementById('rtp-anywin').value)||0;
  let total = jp+f15+f5+aw;
  if (total > 100) { alert("Total must not exceed 100%"); return; }
  RTP.jackpot=jp; RTP.fs15=f15; RTP.fs5=f5; RTP.anywin=aw;
  document.getElementById('rtp-page').classList.remove('active');
};
// --- Stats Overlay ---
const statsPage = document.getElementById('stats-page');
document.getElementById('stats-btn').onclick = function() {
  showStatsOverlay();
};
document.getElementById('close-stats').onclick = function() {
  statsPage.classList.remove('active');
};
function showStatsOverlay() {
  let numSpins = 10000;
  let jackpotHits = 0, fs5Hits = 0, fs15Hits = 0, anyWin = 0, fsBuyWins = 0;
  let buyFSrounds = 2000;
  for (let i = 0; i < numSpins; i++) {
    let matrix = getForcedRandomCardMatrix();
    let {totalWin, newFreeSpins, isJackpot, winDetails} = slotWinLogic(matrix);
    if (isJackpot) jackpotHits++;
    if (newFreeSpins === 5) fs5Hits++;
    if (newFreeSpins === 15) fs15Hits++;
    if (winDetails.length > 0) anyWin++;
  }
  for (let i = 0; i < buyFSrounds; i++) {
    let buyHasWin = false;
    for (let s = 0; s < 15; s++) {
      let matrix = getForcedRandomCardMatrix();
      let {winDetails} = slotWinLogic(matrix);
      if (winDetails.length > 0) buyHasWin = true;
    }
    if (buyHasWin) fsBuyWins++;
  }
  let jackpotRate = (jackpotHits / numSpins) * 100;
  let fs5Rate = (fs5Hits / numSpins) * 100;
  let fs15Rate = (fs15Hits / numSpins) * 100;
  let anyWinRate = (anyWin / numSpins) * 100;
  let fsBuyWinRate = (fsBuyWins / buyFSrounds) * 100;
  let rtpHTML = `
    <div style="font-size:1.11em;font-weight:bold;">
      <b>Slot Statistics (per spin):</b><br>
      <span style="color:#a00020">Jackpot Possible Rate:</span> ${jackpotRate.toFixed(4)}%<br>
      <span style="color:#106bb6">5 Free Spin Rate:</span> ${fs5Rate.toFixed(4)}%<br>
      <span style="color:#10b676">15 Free Spin Rate:</span> ${fs15Rate.toFixed(4)}%<br>
      <span style="color:#7a4f12">Any Win/Payout Rate:</span> ${anyWinRate.toFixed(2)}%<br>
      <br>
      <b>Buy Free Spin (15 FS per buy):</b><br>
      <span style="color:#5c2eb1">Win Rate (any win in 15 spins):</span> ${fsBuyWinRate.toFixed(2)}%
    </div>
    <div style="margin-top:8px;font-size:0.97em;color:#947821;">
      (Simulated ${numSpins} rounds & ${buyFSrounds} FS buys)
    </div>
  `;
  document.getElementById('stats-results').innerHTML = rtpHTML;
  statsPage.classList.add('active');
  document.getElementById('history-page').classList.remove('active');
}
// --- History Overlay ---
const historyPage = document.getElementById('history-page');
document.getElementById('history-btn').onclick = function() {
  showHistoryOverlay();
};
document.getElementById('close-history').onclick = function() {
  historyPage.classList.remove('active');
};
function showHistoryOverlay() {
  let html = `<table class="win-table history-table">
    <thead><tr>
      <th>#</th>
      <th>Time</th>
      <th>Type</th>
      <th>Bet</th>
      <th>Win</th>
      <th>Lines</th>
      <th>Jackpot</th>
      <th>FS Won</th>
    </tr></thead><tbody>`;
  historyList.slice(0, 100).forEach((h, i) => {
    html += `<tr>
      <td>${i+1}</td>
      <td>${h.time}</td>
      <td>${h.spinType}</td>
      <td>${h.bet}</td>
      <td>${h.win}</td>
      <td>${h.lines}</td>
      <td>${h.jackpot ? 'Yes' : ''}</td>
      <td>${h.fs ? h.fs : ''}</td>
    </tr>`;
  });
  html += '</tbody></table>';
  document.getElementById('history-results').innerHTML = html;
  historyPage.classList.add('active');
  document.getElementById('stats-page').classList.remove('active');
}
window.onload = () => {
  let tempMatrix = Array.from({length:5}, ()=>Array.from({length:5}, ()=>({label:'?'})));
  animateReelsToResult(tempMatrix, null);
  updateBalanceDisplay();
  showWinTable([], betTable[betIndex]);
  document.getElementById('stats-page').classList.remove('active');
  document.getElementById('history-page').classList.remove('active');
  updateHowWinBtn(false);
};