const CATEGORIES = [
    { key: 'ones', label: 'Ones' },
    { key: 'twos', label: 'Twos' },
    { key: 'threes', label: 'Threes' },
    { key: 'fours', label: 'Fours' },
    { key: 'fives', label: 'Fives' },
    { key: 'sixes', label: 'Sixes' },
    { key: 'subtotal', label: 'Sum', type: 'calc' },
    { key: 'bonus', label: 'Bonus', type: 'calc' },
    { key: 'upperTotal', label: 'Upper Total', type: 'calc' },
    { key: 'threeOfAKind', label: 'Three of a Kind' },
    { key: 'fourOfAKind', label: 'Four of a Kind' },
    { key: 'fullHouse', label: 'Full House' },
    { key: 'smallStraight', label: 'Small Straight' },
    { key: 'largeStraight', label: 'Large Straight' },
    { key: 'yahtzee', label: 'Yahtzee' },
    { key: 'chance', label: 'Chance' },
    { key: 'lowerTotal', label: 'Lower Total', type: 'calc' },
    { key: 'grandTotal', label: 'GRAND TOTAL', type: 'calc' }
];

const SCORABLE_CATS = CATEGORIES.filter(c => !c.type).map(c => c.key);

let appState = {
    players: [], // { name: "Adam", scores: { ones: 3, ... } }
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
const scoreFoot = document.getElementById('scoreFoot'); // Not used in this grid layout, simplified to body
const gameOverControls = document.getElementById('gameOverControls');
const msgEl = document.getElementById('message');

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
}

// --- Setup Actions ---

function addPlayer() {
    const name = playerNameInput.value.trim();
    if (name) {
        appState.players.push({ name, scores: {} });
        playerNameInput.value = '';
        renderSetup();
    }
}

function renderSetup() {
    playerListEl.innerHTML = '';
    appState.players.forEach((p, i) => {
        const li = document.createElement('li');
        li.textContent = p.name;
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
    // Don't reset gameOver here, that's global
}

// --- Game Actions ---

function roll() {
    if (appState.rollsLeft > 0 && !appState.gameOver) {
        for (let i = 0; i < 5; i++) {
            if (!appState.held[i]) {
                appState.dice[i] = Math.ceil(Math.random() * 6);
            }
        }
        appState.rollsLeft--;
        renderGame();
    }
}

function toggleHold(index) {
    if (appState.rollsLeft < 3 && !appState.gameOver) {
        appState.held[index] = !appState.held[index];
        renderGame();
    }
}

function selectCategory(cat, playerIndex) {
    // Validate: correct player, game running, dice rolled
    if (appState.gameOver) return;
    if (playerIndex !== appState.currentPlayerIndex) return;
    if (appState.rollsLeft === 3 && appState.dice[0] === 0) return; // Haven't rolled yet

    const player = appState.players[playerIndex];
    if (player.scores[cat] !== undefined) return; // Already scored

    // Score it
    player.scores[cat] = calculateScore(cat, appState.dice);
    updatePlayerTotals(player);

    // Check End of Game (if all players full)
    const allFull = appState.players.every(p => 
        SCORABLE_CATS.every(c => p.scores[c] !== undefined)
    );

    if (allFull) {
        appState.gameOver = true;
        renderGame();
    } else {
        // Next Turn
        appState.currentPlayerIndex = (appState.currentPlayerIndex + 1) % appState.players.length;
        resetTurn();
        renderGame();
    }
}

function playAgain() {
    // Reset scores, keep players
    appState.players.forEach(p => p.scores = {});
    appState.gameOver = false;
    appState.currentPlayerIndex = 0;
    resetTurn();
    buildScoreTable(); // Clear visual scores
    gameOverControls.classList.add('hidden');
    renderGame();
}

function newGroup() {
    appState.players = [];
    appState.gameOver = false;
    resetTurn();
    gameScreen.classList.add('hidden');
    setupScreen.classList.remove('hidden');
    gameOverControls.classList.add('hidden');
    renderSetup();
}

// --- Rendering ---

function buildScoreTable() {
    // Header
    scoreHeader.innerHTML = '<th>Category</th>';
    appState.players.forEach(p => {
        const th = document.createElement('th');
        th.textContent = p.name;
        scoreHeader.appendChild(th);
    });

    // Body
    scoreBody.innerHTML = '';
    CATEGORIES.forEach(catDef => {
        const tr = document.createElement('tr');
        // Label
        const tdLabel = document.createElement('td');
        if (catDef.type === 'calc') tdLabel.innerHTML = `<strong>${catDef.label}</strong>`;
        else tdLabel.textContent = catDef.label;
        tr.appendChild(tdLabel);

        // Player Columns
        appState.players.forEach((p, pIdx) => {
            const td = document.createElement('td');
            td.id = `cell-${pIdx}-${catDef.key}`;
            
            if (!catDef.type) {
                // Scorable cell
                td.className = 'score-cell';
                td.onclick = () => selectCategory(catDef.key, pIdx);
            } else {
                // Calculated cell
                td.style.backgroundColor = '#f9f9f9';
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
        const d = document.createElement('div');
        d.className = 'die' + (appState.held[i] ? ' held' : '');
        d.textContent = val || '-';
        d.onclick = () => toggleHold(i);
        diceContainer.appendChild(d);
    });

    // 2. Status / Message
    const currentPlayer = appState.players[appState.currentPlayerIndex];
    
    if (appState.gameOver) {
        turnIndicator.textContent = "GAME OVER";
        msgEl.textContent = "Check totals below!";
        rollBtn.textContent = "DONE";
        rollBtn.disabled = true;
        gameOverControls.classList.remove('hidden');
    } else {
        turnIndicator.textContent = `Current Turn: ${currentPlayer.name}`;
        
        if (appState.rollsLeft === 3) msgEl.textContent = "Roll the dice!";
        else if (appState.rollsLeft === 0) msgEl.textContent = "Select a category.";
        else msgEl.textContent = "Roll again or select category.";
        
        rollBtn.textContent = `ROLL (${appState.rollsLeft})`;
        rollBtn.disabled = appState.rollsLeft === 0;
    }

    // 3. Highlight active column
    const headerCells = scoreHeader.querySelectorAll('th');
    headerCells.forEach((th, i) => {
        // i=0 is Label, i=1 is Player 0
        if (i === 0) return;
        const pIdx = i - 1;
        if (pIdx === appState.currentPlayerIndex && !appState.gameOver) th.classList.add('current-player');
        else th.classList.remove('current-player');
    });

    // 4. Update Cells
    CATEGORIES.forEach(catDef => {
        appState.players.forEach((p, pIdx) => {
            const td = document.getElementById(`cell-${pIdx}-${catDef.key}`);
            if (!td) return;

            const val = p.scores[catDef.key];
            const isMyTurn = (pIdx === appState.currentPlayerIndex) && !appState.gameOver;
            
            // Render Value
            td.innerHTML = (val !== undefined) ? val : '';
            if (catDef.type === 'calc' && val !== undefined) td.innerHTML = `<strong>${val}</strong>`;

            // Classes
            if (isMyTurn) td.classList.add('current-player');
            else td.classList.remove('current-player');

            if (!catDef.type) {
                if (val !== undefined) {
                    td.classList.add('filled');
                    td.classList.remove('active-turn');
                } else if (isMyTurn && appState.rollsLeft < 3) {
                    // It is my turn, I have rolled, and this is empty
                    td.classList.add('active-turn');
                } else {
                    td.classList.remove('active-turn');
                }
            }
        });
    });
}

// --- Event Listeners ---
document.getElementById('addPlayerBtn').onclick = addPlayer;
playerNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addPlayer();
});
startGameBtn.onclick = startGame;
document.getElementById('quickStartBtn').onclick = quickStart;

document.getElementById('rollBtn').onclick = roll;
document.getElementById('playAgainBtn').onclick = playAgain;
document.getElementById('newGroupBtn').onclick = newGroup;

// Init
renderSetup();
