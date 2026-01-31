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
    { key: 'grandTotal', label: 'GRAND TOTAL', type: 'calc', isHeader: true }
];

const SCORABLE_CATS = CATEGORIES.filter(c => !c.type).map(c => c.key);

let appState = {
    players: [],
    currentPlayerIndex: 0,
    dice: [0, 0, 0, 0, 0],
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

function renderDie(val, i, isHeld) {
    const d = document.createElement('div');
    d.className = 'die' + (isHeld ? ' held' : '');
    d.onclick = () => toggleHold(i);
    
    // Create 9 dots
    for (let dotIdx = 0; dotIdx < 9; dotIdx++) {
        const dot = document.createElement('div');
        dot.className = 'dot';
        if (val > 0 && DOT_MAP[val].includes(dotIdx)) {
            dot.style.visibility = 'visible';
        }
        d.appendChild(dot);
    }
    return d;
}

// --- Logic (Same as before) ---

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
}

// --- Actions ---

function addPlayer() {
    const name = playerNameInput.value.trim();
    if (name) {
        appState.players.push({ name, scores: {} });
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
    appState.players = [{ name: 'Player 1', scores: {} }];
    startGame();
}

function resetTurn() {
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
        }, 150); // Slight delay for animation feel
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
    if (appState.rollsLeft === 3 && appState.dice[0] === 0) return;

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
    appState.players.forEach(p => p.scores = {});
    appState.gameOver = false;
    appState.currentPlayerIndex = 0;
    resetTurn();
    buildScoreTable();
    gameOverControls.classList.add('hidden');
    rollBtn.classList.remove('hidden'); // Show roll button again
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
        rollBtn.classList.add('hidden'); // Hide roll button
        gameOverControls.classList.remove('hidden');
    } else {
        turnIndicator.textContent = `${currentPlayer.name}'s Turn`;
        turnIndicator.style.background = "var(--text-color)";
        
        if (appState.rollsLeft === 3) msgEl.textContent = "Roll to start";
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
            if (catDef.type === 'calc' && val !== undefined) td.style.fontWeight = 'bold';

            if (isMyTurn && !appState.gameOver) {
                 td.classList.add('current-player-col');
            } else {
                 td.classList.remove('current-player-col');
            }

            if (!catDef.type) {
                if (val !== undefined) {
                    td.classList.add('filled');
                    td.classList.remove('active-turn');
                } else if (isMyTurn && appState.rollsLeft < 3) {
                    td.classList.add('active-turn');
                    // Preview score potential could go here
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
