const CATEGORIES = [
    'ones', 'twos', 'threes', 'fours', 'fives', 'sixes',
    'threeOfAKind', 'fourOfAKind', 'fullHouse', 'smallStraight', 'largeStraight', 'yahtzee', 'chance'
];

let gameState = {
    dice: [0, 0, 0, 0, 0],
    rollsLeft: 3,
    held: [false, false, false, false, false],
    scores: {}, 
    gameOver: false
};

// --- Core Logic (Ported from Server) ---

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

function getTotals() {
    let upper = 0;
    ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'].forEach(c => {
        if (gameState.scores[c] !== undefined) upper += gameState.scores[c];
    });
    const bonus = upper >= 63 ? 35 : 0;
    
    let lower = 0;
    ['threeOfAKind', 'fourOfAKind', 'fullHouse', 'smallStraight', 'largeStraight', 'yahtzee', 'chance'].forEach(c => {
        if (gameState.scores[c] !== undefined) lower += gameState.scores[c];
    });
    
    return {
        upper,
        bonus,
        lower,
        grand: upper + bonus + lower
    };
}

// --- UI Logic ---

function render() {
    // Dice
    const diceContainer = document.getElementById('diceContainer');
    diceContainer.innerHTML = '';
    gameState.dice.forEach((val, i) => {
        const d = document.createElement('div');
        d.className = 'die' + (gameState.held[i] ? ' held' : '');
        d.textContent = val || '-';
        d.onclick = () => toggleHold(i);
        diceContainer.appendChild(d);
    });

    // Message & Button
    const msgEl = document.getElementById('message');
    const rollBtn = document.getElementById('rollBtn');
    
    if (gameState.gameOver) {
        msgEl.textContent = "Game Over!";
        rollBtn.textContent = "ROLL";
        rollBtn.disabled = true;
    } else {
        if (gameState.rollsLeft === 3) msgEl.textContent = "Roll the dice to start!";
        else if (gameState.rollsLeft === 0) msgEl.textContent = "Select a category to score.";
        else msgEl.textContent = "Roll again or select a category.";
        
        rollBtn.textContent = `ROLL (${gameState.rollsLeft} left)`;
        rollBtn.disabled = gameState.rollsLeft === 0;
    }

    // Scores
    const rows = document.querySelectorAll('#scoreTable tr');
    rows.forEach(row => {
        const cat = row.getAttribute('data-cat');
        const scoreVal = row.querySelector('.score-val');
        
        if (gameState.scores[cat] !== undefined) {
            scoreVal.textContent = gameState.scores[cat];
            row.classList.add('used');
            row.onclick = null;
        } else {
            scoreVal.textContent = '';
            row.classList.remove('used');
            row.onclick = () => selectCategory(cat);
        }
    });

    // Totals
    const t = getTotals();
    document.getElementById('upperTotal').textContent = t.upper;
    document.getElementById('bonus').textContent = t.bonus;
    document.getElementById('lowerTotal').textContent = t.lower;
    document.getElementById('grandTotal').innerHTML = `<strong>${t.grand}</strong>`;
}

// --- Actions ---

function roll() {
    if (gameState.rollsLeft > 0 && !gameState.gameOver) {
        for (let i = 0; i < 5; i++) {
            if (!gameState.held[i]) {
                gameState.dice[i] = Math.ceil(Math.random() * 6);
            }
        }
        gameState.rollsLeft--;
        render();
    }
}

function toggleHold(index) {
    if (gameState.rollsLeft < 3 && !gameState.gameOver) {
        gameState.held[index] = !gameState.held[index];
        render();
    }
}

function selectCategory(cat) {
    // Only allow scoring if rolled at least once
    if (gameState.rollsLeft === 3 && gameState.dice[0] === 0) return;

    if (gameState.scores[cat] === undefined && !gameState.gameOver) {
        gameState.scores[cat] = calculateScore(cat, gameState.dice);
        
        // Check game over
        if (Object.keys(gameState.scores).length === CATEGORIES.length) {
            gameState.gameOver = true;
        } else {
            // Reset for next turn
            gameState.rollsLeft = 3;
            gameState.dice = [0,0,0,0,0];
            gameState.held = [false, false, false, false, false];
        }
        render();
    }
}

function reset() {
    gameState = {
        dice: [0, 0, 0, 0, 0],
        rollsLeft: 3,
        held: [false, false, false, false, false],
        scores: {},
        gameOver: false
    };
    render();
}

// --- Init ---

document.getElementById('rollBtn').onclick = roll;
document.getElementById('resetBtn').onclick = reset;
render();
