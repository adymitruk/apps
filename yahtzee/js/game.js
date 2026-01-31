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

const CATEGORIES_UPPER = [
    { key: 'ones', label: 'Ones' },
    { key: 'twos', label: 'Twos' },
    { key: 'threes', label: 'Threes' },
    { key: 'fours', label: 'Fours' },
    { key: 'fives', label: 'Fives' },
    { key: 'sixes', label: 'Sixes' },
    { key: 'subtotal', label: 'Sum', type: 'calc' },
    { key: 'bonus', label: 'Bonus', type: 'calc' },
    { key: 'upperTotal', label: 'Upper Total', type: 'calc', isHeader: true }
];

const CATEGORIES_LOWER = [
    { key: 'threeOfAKind', label: '3 of a Kind' },
    { key: 'fourOfAKind', label: '4 of a Kind' },
    { key: 'fullHouse', label: 'Full House' },
    { key: 'smallStraight', label: 'Sm. Straight' },
    { key: 'largeStraight', label: 'Lg. Straight' },
    { key: 'yahtzee', label: 'Yahtzee' },
    { key: 'chance', label: 'Chance' },
    { key: 'lowerTotal', label: 'Lower Total', type: 'calc' },
    { key: 'grandTotal', label: 'GRAND TOTAL', type: 'calc', isHeader: true }
];

// Combine for logic lookups, but render separately
const ALL_CATS = [...CATEGORIES_UPPER, ...CATEGORIES_LOWER];
const SCORABLE_CATS = ALL_CATS.filter(c => !c.type).map(c => c.key);

let appState = {
    players: [], // { name: "Adam", games: [ { scores: {}, totals: {} } ] }
    currentGameIndex: 0, 
    currentPlayerIndex: 0,
    dice: [0, 0, 0, 0, 0],
    rollsLeft: 3,
    held: [false, false, false, false, false],
    gameOver: false,
    viewingPlayerIndex: 0 // Which player card is currently shown
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
const gameOverControls = document.getElementById('gameOverControls');
const msgEl = document.getElementById('message');

// New DOM Elements for Split Layout
const playerTabsEl = document.getElementById('playerTabs');
const tableUpperBody = document.getElementById('tableUpperBody');
const tableLowerBody = document.getElementById('tableLowerBody');
const tableUpperHead = document.getElementById('tableUpperHead');
const tableLowerHead = document.getElementById('tableLowerHead');

// --- Helpers ---
const DOT_MAP = {
    1: [4],
    2: [2, 6],
    3: [2, 4, 6],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8]
};

// ... (Input/Dice handling code remains similar, updated to use appState) ...
// [Retaining the manual input / drag logic from previous edit, just ensuring it maps to new state]
let dragStartY = 0;
let isDragging = false;
let activeDieIndex = -1;

function handlePointerDown(e, index) {
    if (appState.held[index] || appState.gameOver) return;
    isDragging = true;
    dragStartY = e.clientY;
    activeDieIndex = index;
    e.target.setPointerCapture(e.pointerId);
}
function handlePointerMove(e) {
    if (!isDragging || activeDieIndex === -1) return;
    const deltaY = dragStartY - e.clientY;
    if (Math.abs(deltaY) > 30) {
        changeDieValue(activeDieIndex, deltaY > 0 ? 1 : -1);
        dragStartY = e.clientY;
    }
}
function handlePointerUp(e) { isDragging = false; activeDieIndex = -1; }

function changeDieValue(index, delta) {
    if (appState.held[index] || appState.gameOver) return;
    let newVal = (appState.dice[index] || 1) + delta;
    if (newVal > 6) newVal = 1; if (newVal < 1) newVal = 6;
    appState.dice[index] = newVal;
    renderGame();
}

function renderDie(val, i, isHeld) {
    const wrapper = document.createElement('div');
    wrapper.className = 'die-wrapper';
    
    const upBtn = document.createElement('div');
    upBtn.className = 'die-arrow arrow-up';
    upBtn.innerHTML = '▲';
    upBtn.onclick = (e) => { e.stopPropagation(); changeDieValue(i, 1); };

    const d = document.createElement('div');
    d.className = 'die' + (isHeld ? ' held' : '');
    d.onclick = () => toggleHold(i);
    d.onpointerdown = (e) => handlePointerDown(e, i);
    d.onpointermove = handlePointerMove;
    d.onpointerup = handlePointerUp;
    d.onpointercancel = handlePointerUp;

    for (let dotIdx = 0; dotIdx < 9; dotIdx++) {
        const dot = document.createElement('div');
        dot.className = 'dot';
        if (val > 0 && DOT_MAP[val].includes(dotIdx)) dot.style.visibility = 'visible';
        d.appendChild(dot);
    }

    const downBtn = document.createElement('div');
    downBtn.className = 'die-arrow arrow-down';
    downBtn.innerHTML = '▼';
    downBtn.onclick = (e) => { e.stopPropagation(); changeDieValue(i, -1); };

    if (isHeld || appState.gameOver) {
        upBtn.style.opacity = '0'; downBtn.style.opacity = '0';
        upBtn.style.pointerEvents = 'none'; downBtn.style.pointerEvents = 'none';
        d.style.cursor = 'default';
    } else { d.style.touchAction = 'none'; }

    wrapper.appendChild(upBtn); wrapper.appendChild(d); wrapper.appendChild(downBtn);
    return wrapper;
}

// --- Logic ---

function calculateScore(category, dice) {
    const counts = {};
    let sum = 0;
    dice.forEach(d => { counts[d] = (counts[d] || 0) + 1; sum += d; });
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

function updateGameTotals(gameObj) {
    const scores = gameObj.scores;
    
    // Upper
    let upper = 0;
    ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'].forEach(c => {
        if (scores[c] !== undefined) upper += scores[c];
    });
    scores.subtotal = upper;
    scores.bonus = upper >= 63 ? 35 : 0;
    scores.upperTotal = upper + scores.bonus;
    
    // Lower
    let lower = 0;
    ['threeOfAKind', 'fourOfAKind', 'fullHouse', 'smallStraight', 'largeStraight', 'yahtzee', 'chance'].forEach(c => {
        if (scores[c] !== undefined) lower += scores[c];
    });
    scores.lowerTotal = lower;
    scores.grandTotal = scores.upperTotal + lower;
}

// --- Actions ---

function addPlayer() {
    const name = playerNameInput.value.trim();
    if (name) {
        // Init with one empty game
        appState.players.push({ 
            name, 
            games: [{ scores: {} }] 
        });
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
    appState.viewingPlayerIndex = 0;
    appState.currentGameIndex = 0;
    appState.gameOver = false;
    resetTurn();
    setupScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    renderGame();
}

function quickStart() {
    appState.players = [{ name: 'Player 1', games: [{ scores: {} }] }];
    startGame();
}

function resetTurn() {
    appState.dice = [0, 0, 0, 0, 0];
    appState.rollsLeft = 3;
    appState.held = [false, false, false, false, false];
}

function roll() {
    if (appState.rollsLeft > 0 && !appState.gameOver) {
        const diceEls = document.querySelectorAll('.die');
        diceEls.forEach(d => {
            if (!d.classList.contains('held')) d.style.transform = `rotate(${Math.random() * 360}deg)`;
        });

        setTimeout(() => {
            for (let i = 0; i < 5; i++) {
                if (!appState.held[i]) appState.dice[i] = Math.ceil(Math.random() * 6);
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

function selectCategory(cat) {
    // Current player is the one whose turn it is. 
    // We only allow scoring on their card.
    // If the view is on another player, maybe jump to current?
    if (appState.gameOver) return;

    // Check if dice have value
    const diceSum = appState.dice.reduce((a,b) => a+b, 0);
    if (diceSum === 0) return;

    // Get current player state
    const player = appState.players[appState.currentPlayerIndex];
    const game = player.games[appState.currentGameIndex];

    if (game.scores[cat] !== undefined) return; // Already filled

    // Calculate & Store
    game.scores[cat] = calculateScore(cat, appState.dice);
    updateGameTotals(game);

    // Check End of Game (All players filled current game)
    const allPlayersDone = appState.players.every(p => 
        SCORABLE_CATS.every(c => p.games[appState.currentGameIndex].scores[c] !== undefined)
    );

    if (allPlayersDone) {
        appState.gameOver = true;
        renderGame();
    } else {
        // Next Turn
        appState.currentPlayerIndex = (appState.currentPlayerIndex + 1) % appState.players.length;
        // Auto-switch view to next player
        appState.viewingPlayerIndex = appState.currentPlayerIndex;
        
        resetTurn();
        renderGame();
    }
}

function playAgain() {
    // Start new game column
    appState.players.forEach(p => {
        p.games.push({ scores: {} });
    });
    appState.currentGameIndex++;
    appState.gameOver = false;
    appState.currentPlayerIndex = 0;
    appState.viewingPlayerIndex = 0;
    resetTurn();
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

function setViewPlayer(idx) {
    appState.viewingPlayerIndex = idx;
    renderGame(); // Re-render table for this player
}

// --- Rendering ---

function renderTabs() {
    playerTabsEl.innerHTML = '';
    appState.players.forEach((p, i) => {
        const btn = document.createElement('button');
        btn.className = 'tab-btn' + (i === appState.viewingPlayerIndex ? ' active' : '');
        // Marker for whose turn it is
        const isTurn = (i === appState.currentPlayerIndex && !appState.gameOver);
        btn.innerHTML = `${p.name} ${isTurn ? ' <span class="turn-dot">●</span>' : ''}`;
        btn.onclick = () => setViewPlayer(i);
        playerTabsEl.appendChild(btn);
    });
}

function renderTableSection(catList, headEl, bodyEl) {
    const viewingPlayer = appState.players[appState.viewingPlayerIndex];
    if (!viewingPlayer) return;

    // Header: Category | Game 1 | Game 2 ...
    let htmlHead = '<tr><th>Category</th>';
    viewingPlayer.games.forEach((g, i) => {
        const isCurrent = (i === appState.currentGameIndex);
        htmlHead += `<th class="${isCurrent ? 'current-game-col' : ''}">Game ${i+1}</th>`;
    });
    htmlHead += '</tr>';
    headEl.innerHTML = htmlHead;

    // Body
    bodyEl.innerHTML = '';
    catList.forEach(catDef => {
        const tr = document.createElement('tr');
        if (catDef.isHeader) tr.className = 'total-row';

        const tdLabel = document.createElement('td');
        tdLabel.textContent = catDef.label;
        if (catDef.type === 'calc') tdLabel.style.fontWeight = 'bold';
        tr.appendChild(tdLabel);

        viewingPlayer.games.forEach((g, gIdx) => {
            const td = document.createElement('td');
            const val = g.scores[catDef.key];
            const isCurrentGame = (gIdx === appState.currentGameIndex);
            
            // Interaction: Only allow clicking if:
            // 1. It is the Current Game Column
            // 2. It is the Viewing Player's Turn
            // 3. Not game over
            const canInteract = isCurrentGame && 
                                (appState.viewingPlayerIndex === appState.currentPlayerIndex) && 
                                !appState.gameOver &&
                                !catDef.type;

            td.textContent = (val !== undefined) ? val : '';
            if (catDef.type === 'calc') td.style.fontWeight = 'bold';

            if (isCurrentGame) {
                td.classList.add('current-game-cell');
                if (canInteract && val === undefined) {
                    td.classList.add('score-cell');
                    td.classList.add('active-turn'); // Highlight potential move
                    td.onclick = () => selectCategory(catDef.key);
                }
            } else {
                td.classList.add('history-cell');
            }
            
            tr.appendChild(td);
        });
        bodyEl.appendChild(tr);
    });
}

function renderGame() {
    // 1. Dice & Status
    diceContainer.innerHTML = '';
    appState.dice.forEach((val, i) => {
        diceContainer.appendChild(renderDie(val, i, appState.held[i]));
    });

    const currentPlayer = appState.players[appState.currentPlayerIndex];
    if (appState.gameOver) {
        turnIndicator.textContent = "GAME OVER";
        turnIndicator.style.background = "var(--accent-color)";
        msgEl.textContent = "Check final scores.";
        rollBtn.classList.add('hidden'); 
        gameOverControls.classList.remove('hidden');
    } else {
        turnIndicator.textContent = `${currentPlayer.name}'s Turn`;
        turnIndicator.style.background = "var(--text-color)";
        
        if (appState.rollsLeft === 3 && appState.dice[0] === 0) msgEl.textContent = "Roll or set dice";
        else if (appState.rollsLeft === 0) msgEl.textContent = "Select category";
        else msgEl.textContent = `${appState.rollsLeft} rolls left`;
        
        rollBtn.classList.remove('hidden');
        gameOverControls.classList.add('hidden');
        rollBtn.textContent = appState.rollsLeft === 0 ? "Score..." : "ROLL";
        rollBtn.disabled = appState.rollsLeft === 0;
    }

    // 2. Tabs
    renderTabs();

    // 3. Score Tables (Split)
    renderTableSection(CATEGORIES_UPPER, tableUpperHead, tableUpperBody);
    renderTableSection(CATEGORIES_LOWER, tableLowerHead, tableLowerBody);
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
