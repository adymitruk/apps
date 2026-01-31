// --- Theme Management ---
const themeToggle = document.getElementById('themeToggle');

function initTheme() {
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (saved === 'dark' || (!saved && prefersDark)) {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
    }
}

themeToggle.onclick = () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
};

initTheme();


// --- Game Logic ---

const CATEGORIES = [
    { key: 'ones', label: 'Ones' },
    { key: 'twos', label: 'Twos' },
    { key: 'threes', label: 'Threes' },
    { key: 'fours', label: 'Fours' },
    { key: 'fives', label: 'Fives' },
    { key: 'sixes', label: 'Sixes' },
    { key: 'subtotal', label: 'Sum', type: 'calc' },
    { key: 'bonus', label: 'Bonus', type: 'calc' },
    { key: 'upperTotal', label: 'Upper Total', type: 'calc', isHeader: true },
    { key: 'threeOfAKind', label: 'Three of a Kind' },
    { key: 'fourOfAKind', label: 'Four of a Kind' },
    { key: 'fullHouse', label: 'Full House' },
    { key: 'smallStraight', label: 'Sm. Straight' },
    { key: 'largeStraight', label: 'Lg. Straight' },
    { key: 'yahtzee', label: 'Yahtzee' },
    { key: 'chance', label: 'Chance' },
    { key: 'lowerTotal', label: 'Lower Total', type: 'calc' },
    { key: 'grandTotal', label: 'GRAND TOTAL', type: 'calc', isHeader: true },
    { key: 'seriesTotal', label: 'Series Total', type: 'calc', isHeader: true } // New Row
];

const SCORABLE_CATS = CATEGORIES.filter(c => !c.type).map(c => c.key);

let appState = {
    players: [],
    currentPlayerIndex: 0,
    dice: [0, 0, 0, 0, 0], // 0 means uninitialized/empty, but for manual mode we might want default 1?
    rollsLeft: 3,
    held: [false, false, false, false, false],
    gameOver: false
};

// --- DOM Elements ---
const setupScreen = document.getElementById('setupScreen');
const gameScreen = document.getElementById('gameScreen');
const playerListEl = document.getElementById('playerList');
const startGameBtn = document.getElementById('startGameBtn');
const playerNameInput = document.getElementById('playerNameInput');
const turnIndicator = document.getElementById('turnIndicator');
const diceContainer = document.getElementById('diceContainer');
const rollBtn = document.getElementById('rollBtn');
const scoreHeader = document.getElementById('headerRow');
const scoreBody = document.getElementById('scoreBody');
const gameOverControls = document.getElementById('gameOverControls');
const msgEl = document.getElementById('message');

// --- Helpers ---

// 3x3 Dot Map
const DOT_MAP = {
    1: [4],
    2: [2, 6],
    3: [2, 4, 6],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8]
};

// --- Input Handling (Drag/Arrows) ---
let dragStartY = 0;
let isDragging = false;
let activeDieIndex = -1;

function handlePointerDown(e, index) {
    if (appState.held[index] || appState.gameOver) return;
    // Only allow drag if we have dice (or permit setting initial dice manually)
    // If dice are 0 (start of turn), we allow setting them to 1 first? 
    // Let's assume dice must have value > 0 to drag, or we init them.
    
    isDragging = true;
    dragStartY = e.clientY;
    activeDieIndex = index;
    
    e.target.setPointerCapture(e.pointerId);
}

function handlePointerMove(e) {
    if (!isDragging || activeDieIndex === -1) return;
    
    const deltaY = dragStartY - e.clientY; // Up is positive
    const threshold = 30; // pixels to trigger change

    if (Math.abs(deltaY) > threshold) {
        const change = deltaY > 0 ? 1 : -1;
        changeDieValue(activeDieIndex, change);
        dragStartY = e.clientY; // Reset anchor
    }
}

function handlePointerUp(e) {
    isDragging = false;
    activeDieIndex = -1;
}

function changeDieValue(index, delta) {
    if (appState.held[index] || appState.gameOver) return;
    
    let newVal = (appState.dice[index] || 1) + delta;
    if (newVal > 6) newVal = 1;
    if (newVal < 1) newVal = 6;
    
    appState.dice[index] = newVal;
    
    // If we manually change dice, we are technically "using" the turn logic, 
    // but the user wants to mirror IRL play. 
    // We update the UI immediately.
    renderGame();
}

function renderDie(val, i, isHeld) {
    const wrapper = document.createElement('div');
    wrapper.className = 'die-wrapper';

    // Up Arrow
    const upBtn = document.createElement('div');
    upBtn.className = 'die-arrow arrow-up';
    upBtn.innerHTML = '▲';
    upBtn.onclick = (e) => { e.stopPropagation(); changeDieValue(i, 1); };

    // Die
    const d = document.createElement('div');
    d.className = 'die' + (isHeld ? ' held' : '');
    d.onclick = () => toggleHold(i);
    
    // Pointer Events for Drag
    d.onpointerdown = (e) => handlePointerDown(e, i);
    d.onpointermove = handlePointerMove;
    d.onpointerup = handlePointerUp;
    d.onpointercancel = handlePointerUp; // Safety
    
    // Create 9 dots
    for (let dotIdx = 0; dotIdx < 9; dotIdx++) {
        const dot = document.createElement('div');
        dot.className = 'dot';
        if (val > 0 && DOT_MAP[val].includes(dotIdx)) {
            dot.style.visibility = 'visible';
        }
        d.appendChild(dot);
    }

    // Down Arrow
    const downBtn = document.createElement('div');
    downBtn.className = 'die-arrow arrow-down';
    downBtn.innerHTML = '▼';
    downBtn.onclick = (e) => { e.stopPropagation(); changeDieValue(i, -1); };

    // If held or game over, hide arrows/disable drag visuals (optional, but requested behavior is 'frozen dice can't be changed')
    if (isHeld || appState.gameOver) {
        upBtn.style.opacity = '0';
        downBtn.style.opacity = '0';
        upBtn.style.pointerEvents = 'none';
        downBtn.style.pointerEvents = 'none';
        d.style.cursor = 'default';
    } else {
        d.style.touchAction = 'none'; // Prevent scroll while dragging die
    }

    wrapper.appendChild(upBtn);
    wrapper.appendChild(d);
    wrapper.appendChild(downBtn);
    
    return wrapper;
}

// --- Logic ---

function calculateScore(category, dice) {
    const counts = {};
    let sum = 0;
    dice.forEach(d => {
        counts[d] = (counts[d] || 0) + 1;
        sum += d;
    });
    const countsArr = Object.values(counts);

    switch (category) {
        case 'ones': return (counts[1] || 0) * 1;
        case 'twos': return (counts[2] || 0) * 2;
        case 'threes': return (counts[3] || 0) * 3;
        case 'fours': return (counts[4] || 0) * 4;
        case 'fives': return (counts[5] || 0) * 5;
        case 'sixes': return (counts[6] || 0) * 6;
        case 'threeOfAKind': return countsArr.some(c => c >= 3) ? sum : 0;
        case 'fourOfAKind': return countsArr.some(c => c >= 4) ? sum : 0;
        case 'fullHouse': return (countsArr.includes(3) && countsArr.includes(2)) || countsArr.includes(5) ? 25 : 0;
        case 'smallStraight': 
            const uDiceS = [...new Set(dice)].sort((a,b)=>a-b).join('');
            return /1234|2345|3456/.test(uDiceS) ? 30 : 0;
        case 'largeStraight': 
            const uDiceL = [...new Set(dice)].sort((a,b)=>a-b).join('');
            return /12345|23456/.test(uDiceL) ? 40 : 0;
        case 'yahtzee': return countsArr.includes(5) ? 50 : 0;
        case 'chance': return sum;
        default: return 0;
    }
}

function updatePlayerTotals(player) {
    let upper = 0;
    ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'].forEach(c => {
        if (player.scores[c] !== undefined) upper += player.scores[c];
    });
    player.scores.subtotal = upper;
    player.scores.bonus = upper >= 63 ? 35 : 0;
    player.scores.upperTotal = upper + player.scores.bonus;
    
    let lower = 0;
    ['threeOfAKind', 'fourOfAKind', 'fullHouse', 'smallStraight', 'largeStraight', 'yahtzee', 'chance'].forEach(c => {
        if (player.scores[c] !== undefined) lower += player.scores[c];
    });
    player.scores.lowerTotal = lower;
    player.scores.grandTotal = player.scores.upperTotal + lower;
    
    // Series Total = Previous wins/accumulated + current Grand Total
    player.scores.seriesTotal = (player.seriesBase || 0) + player.scores.grandTotal;
}

// --- Actions ---

function addPlayer() {
    const name = playerNameInput.value.trim();
    if (name) {
        // seriesBase tracks locked-in scores from previous games
        appState.players.push({ name, scores: {}, seriesBase: 0 });
        playerNameInput.value = '';
        renderSetup();
    }
}

function removePlayer(idx) {
    appState.players.splice(idx, 1);
    renderSetup();
}

function renderSetup() {
    playerListEl.innerHTML = '';
    appState.players.forEach((p, i) => {
        const li = document.createElement('li');
        li.className = 'player-tag';
        li.innerHTML = `${p.name} <span class="remove-player" onclick="removePlayer(${i})">×</span>`;
        playerListEl.appendChild(li);
    });
    startGameBtn.disabled = appState.players.length === 0;
}

function startGame() {
    appState.currentPlayerIndex = 0;
    resetTurn();
    setupScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    buildScoreTable();
    renderGame();
}

function quickStart() {
    appState.players = [{ name: 'Player 1', scores: {}, seriesBase: 0 }];
    startGame();
}

function resetTurn() {
    // If resetting turn, reset dice to 0? Or keep them? 
    // Standard game: dice clear.
    appState.dice = [0, 0, 0, 0, 0];
    appState.rollsLeft = 3;
    appState.held = [false, false, false, false, false];
}

function roll() {
    if (appState.rollsLeft > 0 && !appState.gameOver) {
        // Animate
        const diceEls = document.querySelectorAll('.die');
        diceEls.forEach(d => {
            if (!d.classList.contains('held')) {
                d.style.transform = `rotate(${Math.random() * 360}deg)`;
            }
        });

        setTimeout(() => {
            for (let i = 0; i < 5; i++) {
                if (!appState.held[i]) {
                    appState.dice[i] = Math.ceil(Math.random() * 6);
                }
            }
            appState.rollsLeft--;
            renderGame();
        }, 150); 
    }
}

function toggleHold(index) {
    if (appState.rollsLeft < 3 && !appState.gameOver) {
        appState.held[index] = !appState.held[index];
        renderGame();
    }
}

function selectCategory(cat, playerIndex) {
    if (appState.gameOver) return;
    if (playerIndex !== appState.currentPlayerIndex) return;
    
    // Allow scoring if dice are manually set even if rollsLeft == 3?
    // User requirement: "game becomes a scoresheet". 
    // So we should relax the "must roll" constraint if dice have values > 0.
    const diceSum = appState.dice.reduce((a,b) => a+b, 0);
    if (diceSum === 0) return; 

    const player = appState.players[playerIndex];
    if (player.scores[cat] !== undefined) return;

    player.scores[cat] = calculateScore(cat, appState.dice);
    updatePlayerTotals(player);

    const allFull = appState.players.every(p => 
        SCORABLE_CATS.every(c => p.scores[c] !== undefined)
    );

    if (allFull) {
        appState.gameOver = true;
        renderGame();
    } else {
        appState.currentPlayerIndex = (appState.currentPlayerIndex + 1) % appState.players.length;
        resetTurn();
        renderGame();
    }
}

function playAgain() {
    // Accumulate scores into seriesBase
    appState.players.forEach(p => {
        p.seriesBase = (p.seriesBase || 0) + (p.scores.grandTotal || 0);
        p.scores = {};
        // Init the new series total for display immediately
        p.scores.seriesTotal = p.seriesBase;
    });
    
    appState.gameOver = false;
    appState.currentPlayerIndex = 0;
    resetTurn();
    buildScoreTable();
    gameOverControls.classList.add('hidden');
    rollBtn.classList.remove('hidden'); 
    renderGame();
}

function newGroup() {
    appState.players = [];
    appState.gameOver = false;
    resetTurn();
    gameScreen.classList.add('hidden');
    setupScreen.classList.remove('hidden');
    gameOverControls.classList.add('hidden');
    rollBtn.classList.remove('hidden');
    renderSetup();
}

// --- Rendering ---

function buildScoreTable() {
    scoreHeader.innerHTML = '<th>Category</th>';
    appState.players.forEach(p => {
        const th = document.createElement('th');
        th.textContent = p.name;
        scoreHeader.appendChild(th);
    });

    scoreBody.innerHTML = '';
    CATEGORIES.forEach(catDef => {
        const tr = document.createElement('tr');
        if (catDef.isHeader) tr.className = 'total-row';

        const tdLabel = document.createElement('td');
        tdLabel.textContent = catDef.label;
        if (catDef.isHeader) tdLabel.style.fontWeight = '800';
        tr.appendChild(tdLabel);

        appState.players.forEach((p, pIdx) => {
            const td = document.createElement('td');
            td.id = `cell-${pIdx}-${catDef.key}`;
            
            if (!catDef.type) {
                td.className = 'score-cell';
                td.onclick = () => selectCategory(catDef.key, pIdx);
            } else {
                td.style.backgroundColor = 'var(--bg-color)';
                td.style.cursor = 'default';
            }
            tr.appendChild(td);
        });
        scoreBody.appendChild(tr);
    });
}

function renderGame() {
    // 1. Dice
    diceContainer.innerHTML = '';
    appState.dice.forEach((val, i) => {
        diceContainer.appendChild(renderDie(val, i, appState.held[i]));
    });

    // 2. Status
    const currentPlayer = appState.players[appState.currentPlayerIndex];
    
    if (appState.gameOver) {
        turnIndicator.textContent = "GAME OVER";
        turnIndicator.style.background = "var(--accent-color)";
        msgEl.textContent = "Check totals below!";
        rollBtn.classList.add('hidden'); 
        gameOverControls.classList.remove('hidden');
    } else {
        turnIndicator.textContent = `${currentPlayer.name}'s Turn`;
        turnIndicator.style.background = "var(--text-color)";
        
        // Update message for flexibility
        if (appState.rollsLeft === 3 && appState.dice[0] === 0) msgEl.textContent = "Roll or set dice";
        else if (appState.rollsLeft === 0) msgEl.textContent = "Select category";
        else msgEl.textContent = `${appState.rollsLeft} rolls left`;
        
        rollBtn.textContent = appState.rollsLeft === 0 ? "Score to continue" : "ROLL";
        rollBtn.disabled = appState.rollsLeft === 0;
    }

    // 3. Highlight Columns
    const headerCells = scoreHeader.querySelectorAll('th');
    headerCells.forEach((th, i) => {
        if (i === 0) return;
        const pIdx = i - 1;
        if (pIdx === appState.currentPlayerIndex && !appState.gameOver) {
            th.classList.add('current-player-col');
            th.style.color = 'var(--primary-color)';
        } else {
            th.classList.remove('current-player-col');
            th.style.color = '';
        }
    });

    // 4. Update Table
    CATEGORIES.forEach(catDef => {
        appState.players.forEach((p, pIdx) => {
            const td = document.getElementById(`cell-${pIdx}-${catDef.key}`);
            if (!td) return;

            const val = p.scores[catDef.key];
            const isMyTurn = (pIdx === appState.currentPlayerIndex) && !appState.gameOver;
            
            td.textContent = (val !== undefined) ? val : '';
            if (catDef.type === 'calc') {
                // If it's the new Series Total row, show seriesTotal property
                if (catDef.key === 'seriesTotal') {
                     // Default to seriesBase if current game score is 0/undefined
                     const total = p.scores.seriesTotal !== undefined ? p.scores.seriesTotal : (p.seriesBase || 0);
                     td.textContent = total;
                }
                td.style.fontWeight = 'bold';
            }

            if (isMyTurn && !appState.gameOver) {
                 td.classList.add('current-player-col');
            } else {
                 td.classList.remove('current-player-col');
            }

            if (!catDef.type) {
                if (val !== undefined) {
                    td.classList.add('filled');
                    td.classList.remove('active-turn');
                } else if (isMyTurn) {
                    // Always active if it's my turn, even if I haven't rolled yet (manual entry support)
                     td.classList.add('active-turn');
                } else {
                    td.classList.remove('active-turn');
                }
            }
        });
    });
}

// --- Init ---
document.getElementById('addPlayerBtn').onclick = addPlayer;
playerNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addPlayer();
});
document.getElementById('startGameBtn').onclick = startGame;
document.getElementById('quickStartBtn').onclick = quickStart;
document.getElementById('rollBtn').onclick = roll;
document.getElementById('playAgainBtn').onclick = playAgain;
document.getElementById('newGroupBtn').onclick = newGroup;

renderSetup();
