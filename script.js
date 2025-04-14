// Game configuration
const config = {
    gridSize: 15,
    initialTime: 60,
    timeDecrement: 0.05,
    minDynamicWallChance: 0.2,
    maxDynamicWallChance: 0.4,
    obstacleChance: 0.05,
    enemySpeed: 0.7, // Probability of enemy making a move when player moves
    wallShiftChance: 0.3, // Chance that walls will shift after player movement
};

// Game state
let gameState = {
    level: 1,
    time: config.initialTime,
    grid: [],
    playerPosition: { row: 0, col: 0 },
    enemyPosition: { row: 0, col: 0 },
    exitPosition: { row: 0, col: 0 },
    isGameStarted: false,
    isGameOver: false,
    timerInterval: null
};

// DOM Elements
const gameBoard = document.getElementById('game-board');
const timeDisplay = document.getElementById('time');
const levelDisplay = document.getElementById('level');
const startButton = document.getElementById('start-button');
const restartButton = document.getElementById('restart-button');
const gameOverModal = document.getElementById('game-over');
const gameOverMessage = document.getElementById('game-over-message');

// Initialize event listeners
function initEventListeners() {
    startButton.addEventListener('click', startGame);
    restartButton.addEventListener('click', restartGame);
    document.addEventListener('keydown', handleKeyPress);
}

// Start the game
function startGame() {
    if (gameState.isGameStarted) return;
    
    gameState.isGameStarted = true;
    gameState.isGameOver = false;
    gameState.level = 1;
    gameState.time = config.initialTime;
    
    updateDisplay();
    generateMaze();
    startTimer();
    
    startButton.disabled = true;
    gameOverModal.classList.remove('active');
}

// Restart the game
function restartGame() {
    gameOverModal.classList.remove('active');
    startGame();
}

// Update the display with current game state
function updateDisplay() {
    timeDisplay.textContent = Math.ceil(gameState.time);
    levelDisplay.textContent = gameState.level;
}

// Generate the maze
function generateMaze() {
    gameBoard.innerHTML = '';
    gameBoard.style.gridTemplateColumns = `repeat(${config.gridSize}, 1fr)`;
    gameBoard.style.gridTemplateRows = `repeat(${config.gridSize}, 1fr)`;
    
    gameState.grid = [];
    
    // Create empty grid
    for (let row = 0; row < config.gridSize; row++) {
        gameState.grid[row] = [];
        for (let col = 0; col < config.gridSize; col++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.dataset.row = row;
            cell.dataset.col = col;
            gameBoard.appendChild(cell);
            
            // Decide cell type (wall, path, obstacle)
            let cellType = 'path';
            
            // Border walls
            if (row === 0 || row === config.gridSize - 1 || col === 0 || col === config.gridSize - 1) {
                cellType = 'wall';
            } 
            // Random walls (more walls at higher levels)
            else if (Math.random() < getDynamicWallChance()) {
                cellType = 'wall';
            }
            // Random obstacles
            else if (Math.random() < config.obstacleChance * gameState.level) {
                cellType = 'obstacle';
            }
            
            gameState.grid[row][col] = cellType;
            if (cellType === 'wall') cell.classList.add('wall');
            if (cellType === 'obstacle') cell.classList.add('obstacle');
        }
    }
    
    // Place player at top left (not in corner, but close)
    placePlayer(1, 1);
    
    // Place exit at bottom right
    placeExit(config.gridSize - 2, config.gridSize - 2);
    
    // Place enemy far from player
    placeEnemy(config.gridSize - 2, 1);
    
    // Ensure there's a path to exit (simple open path for now)
    ensurePath();
}

// Calculate wall chance based on level
function getDynamicWallChance() {
    // Increases wall density with level, but caps at maxDynamicWallChance
    return Math.min(
        config.minDynamicWallChance + (gameState.level - 1) * 0.02,
        config.maxDynamicWallChance
    );
}

// Place player on the grid
function placePlayer(row, col) {
    // Ensure the position is valid
    if (isValidPosition(row, col)) {
        // Clear any existing player
        const currentPlayerCell = document.querySelector('.player');
        if (currentPlayerCell) {
            currentPlayerCell.remove();
        }
        
        // Update player position
        gameState.playerPosition = { row, col };
        gameState.grid[row][col] = 'path'; // Ensure the cell is a path
        
        // Create player element
        const cell = getCellElement(row, col);
        const playerElement = document.createElement('div');
        playerElement.classList.add('player');
        cell.appendChild(playerElement);
    }
}

// Place exit on the grid
function placeExit(row, col) {
    if (isValidPosition(row, col)) {
        gameState.exitPosition = { row, col };
        gameState.grid[row][col] = 'exit';
        
        const cell = getCellElement(row, col);
        cell.classList.add('exit');
    }
}

// Place enemy on the grid
function placeEnemy(row, col) {
    if (isValidPosition(row, col)) {
        // Clear any existing enemy
        const currentEnemyCell = document.querySelector('.enemy');
        if (currentEnemyCell) {
            currentEnemyCell.remove();
        }
        
        // Update enemy position
        gameState.enemyPosition = { row, col };
        
        // Create enemy element
        const cell = getCellElement(row, col);
        const enemyElement = document.createElement('div');
        enemyElement.classList.add('enemy');
        cell.appendChild(enemyElement);
    }
}

// Get cell element by row and column
function getCellElement(row, col) {
    return document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
}

// Check if position is valid (within grid and not a wall)
function isValidPosition(row, col) {
    return (
        row >= 0 && 
        row < config.gridSize && 
        col >= 0 && 
        col < config.gridSize && 
        gameState.grid[row][col] !== 'wall'
    );
}

// Ensure there's at least a basic path to the exit
function ensurePath() {
    const { row: playerRow, col: playerCol } = gameState.playerPosition;
    const { row: exitRow, col: exitCol } = gameState.exitPosition;
    
    // Create a simple path (can be enhanced with more complex algorithm)
    for (let row = playerRow; row <= exitRow; row++) {
        gameState.grid[row][playerCol] = 'path';
        const cell = getCellElement(row, playerCol);
        cell.className = 'cell';
    }
    
    for (let col = playerCol; col <= exitCol; col++) {
        gameState.grid[exitRow][col] = 'path';
        const cell = getCellElement(exitRow, col);
        cell.className = 'cell';
    }
    
    // Make sure the exit is still an exit
    gameState.grid[exitRow][exitCol] = 'exit';
    getCellElement(exitRow, exitCol).classList.add('exit');
}

// Start the timer
function startTimer() {
    clearInterval(gameState.timerInterval);
    
    gameState.timerInterval = setInterval(() => {
        gameState.time -= config.timeDecrement * gameState.level;
        
        if (gameState.time <= 0) {
            gameState.time = 0;
            endGame('Time\'s up! You were trapped in the shifting maze.');
        }
        
        updateDisplay();
    }, 100);
}

// Handle key press for player movement
function handleKeyPress(event) {
    if (!gameState.isGameStarted || gameState.isGameOver) return;
    
    let direction;
    
    switch (event.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
            direction = { row: -1, col: 0 };
            break;
        case 'ArrowDown':
        case 's':
        case 'S':
            direction = { row: 1, col: 0 };
            break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
            direction = { row: 0, col: -1 };
            break;
        case 'ArrowRight':
        case 'd':
        case 'D':
            direction = { row: 0, col: 1 };
            break;
        default:
            return; // Ignore other keys
    }
    
    movePlayer(direction);
}

// Move the player
function movePlayer(direction) {
    const { row, col } = gameState.playerPosition;
    const newRow = row + direction.row;
    const newCol = col + direction.col;
    
    // Check if the move is valid
    if (isValidPosition(newRow, newCol) && gameState.grid[newRow][newCol] !== 'obstacle') {
        placePlayer(newRow, newCol);
        
        // Check if player reached the exit
        if (gameState.grid[newRow][newCol] === 'exit') {
            levelComplete();
            return;
        }
        
        // Move enemy after player
        if (Math.random() < config.enemySpeed) {
            moveEnemy();
        }
        
        // Dynamically shift the maze
        if (Math.random() < config.wallShiftChance) {
            shiftMaze();
        }
    }
}

// Move the enemy (simple AI that follows the player)
function moveEnemy() {
    const { row: enemyRow, col: enemyCol } = gameState.enemyPosition;
    const { row: playerRow, col: playerCol } = gameState.playerPosition;
    
    // Determine direction toward player (simple approach)
    let newRow = enemyRow;
    let newCol = enemyCol;
    
    // Decide whether to move horizontally or vertically
    if (Math.random() < 0.5) {
        // Move horizontally first
        newCol = enemyCol + (playerCol > enemyCol ? 1 : (playerCol < enemyCol ? -1 : 0));
        if (!isValidPosition(newRow, newCol) || gameState.grid[newRow][newCol] === 'obstacle') {
            // If horizontal move is blocked, try vertical
            newCol = enemyCol;
            newRow = enemyRow + (playerRow > enemyRow ? 1 : (playerRow < enemyRow ? -1 : 0));
        }
    } else {
        // Move vertically first
        newRow = enemyRow + (playerRow > enemyRow ? 1 : (playerRow < enemyRow ? -1 : 0));
        if (!isValidPosition(newRow, newCol) || gameState.grid[newRow][newCol] === 'obstacle') {
            // If vertical move is blocked, try horizontal
            newRow = enemyRow;
            newCol = enemyCol + (playerCol > enemyCol ? 1 : (playerCol < enemyCol ? -1 : 0));
        }
    }
    
    // If a valid move was found, move the enemy
    if (isValidPosition(newRow, newCol) && gameState.grid[newRow][newCol] !== 'obstacle') {
        placeEnemy(newRow, newCol);
        
        // Check if enemy caught the player
        if (newRow === gameState.playerPosition.row && newCol === gameState.playerPosition.col) {
            endGame('The creature caught you! Better luck next time.');
        }
    }
}

// Shift parts of the maze randomly
function shiftMaze() {
    // Number of walls to shift (based on level)
    const shiftsCount = Math.min(5 + gameState.level, 15);
    
    for (let i = 0; i < shiftsCount; i++) {
        // Pick a random location (not on player, enemy, or exit)
        let row, col;
        let validLocation = false;
        
        while (!validLocation) {
            row = Math.floor(Math.random() * (config.gridSize - 2)) + 1;
            col = Math.floor(Math.random() * (config.gridSize - 2)) + 1;
            
            const isPlayer = row === gameState.playerPosition.row && col === gameState.playerPosition.col;
            const isEnemy = row === gameState.enemyPosition.row && col === gameState.enemyPosition.col;
            const isExit = row === gameState.exitPosition.row && col === gameState.exitPosition.col;
            
            validLocation = !isPlayer && !isEnemy && !isExit;
        }
        
        // Toggle between wall and path
        const cell = getCellElement(row, col);
        
        if (gameState.grid[row][col] === 'wall') {
            gameState.grid[row][col] = 'path';
            cell.classList.remove('wall');
        } else if (gameState.grid[row][col] === 'path') {
            gameState.grid[row][col] = 'wall';
            cell.classList.add('wall');
        }
    }
    
    // Ensure there's still a path to the exit
    ensurePath();
}

// Handle level completion
function levelComplete() {
    gameState.level++;
    gameState.time = Math.max(config.initialTime - (gameState.level - 1) * 5, 30); // Decrease time with levels
    
    updateDisplay();
    generateMaze();
}

// End the game
function endGame(message) {
    clearInterval(gameState.timerInterval);
    gameState.isGameOver = true;
    gameState.isGameStarted = false;
    
    gameOverMessage.textContent = message + ` You reached level ${gameState.level}.`;
    gameOverModal.classList.add('active');
    
    startButton.disabled = false;
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
}); 