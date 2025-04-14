// Game configuration
const config = {
    gridSize: { width: 17, height: 15 },
    initialTime: 15,
    timeDecrement: 0.05,
    minDynamicWallChance: 0.2,
    maxDynamicWallChance: 0.4,
    obstacleChance: 0.05,
    enemySpeed: 0.7, // Probability of enemy making a move when player moves
    minMovesBetweenShifts: 2, // Minimum moves before a shift can happen
    maxMovesBetweenShifts: 4, // Maximum moves before a shift must happen
    baseScorePerLevel: 100, // Base score awarded for completing a level
    timeBonus: 10, // Score points per remaining second
    wallShiftScore: 5, // Score for each successful wall navigation after shift
    soundEnabled: true // Toggle for sound effects
};

// Game state
let gameState = {
    level: 1,
    time: config.initialTime,
    score: 0,
    grid: [],
    playerPosition: { row: 0, col: 0 },
    enemyPosition: { row: 0, col: 0 },
    exitPosition: { row: 0, col: 0 },
    isGameStarted: false,
    isGameOver: false,
    timerInterval: null,
    lastShiftTime: 0,
    movesSinceLastShift: 0
};

// DOM Elements
const gameBoard = document.getElementById('game-board');
const timeDisplay = document.getElementById('time');
const levelDisplay = document.getElementById('level');
const scoreDisplay = document.getElementById('score');
const finalScoreDisplay = document.getElementById('final-score');
const startButton = document.getElementById('start-button');
const startOverlay = document.getElementById('start-overlay');
const restartButton = document.getElementById('restart-button');
const gameOverModal = document.getElementById('game-over');
const gameOverMessage = document.getElementById('game-over-message');
const soundToggle = document.getElementById('sound-toggle');

// Sound elements
const moveSound = document.getElementById('move-sound');
const shiftSound = document.getElementById('shift-sound');
const levelCompleteSound = document.getElementById('level-complete-sound');
const gameOverSound = document.getElementById('game-over-sound');
const exitReachedSound = document.getElementById('exit-reached-sound');

// Audio functions
function playSound(sound) {
    if (config.soundEnabled) {
        sound.currentTime = 0;
        sound.volume = 0.1; // Set volume to 1/10 (10%) of full volume
        sound.play().catch(error => {
            console.log('Sound play error: User interaction needed');
        });
    }
}

// Toggle sound on/off
function toggleSound() {
    config.soundEnabled = !config.soundEnabled;
    
    if (config.soundEnabled) {
        soundToggle.textContent = '🔊';
        soundToggle.classList.remove('sound-off');
        soundToggle.classList.add('sound-on');
    } else {
        soundToggle.textContent = '🔇';
        soundToggle.classList.remove('sound-on');
        soundToggle.classList.add('sound-off');
    }
}

// Initialize event listeners
function initEventListeners() {
    startButton.addEventListener('click', startGame);
    restartButton.addEventListener('click', restartGame);
    document.addEventListener('keydown', handleKeyPress);
    soundToggle.addEventListener('click', toggleSound);
    
    // Check if this is a touch device and show/hide mobile controls accordingly
    if (isTouchDevice()) {
        document.getElementById('mobile-controls').style.display = 'block';
    }
    
    // Initialize touch controls for mobile
    initTouchControls();
}

// Calculate time for current level (increases by 2 seconds every 3 levels)
function getTimeForLevel(level) {
    // Base time is 10 seconds
    // Add 2 seconds for every 3 levels
    const extraTime = Math.floor((level - 1) / 3) * 2;
    return config.initialTime + extraTime;
}

// Start the game
function startGame() {
    if (gameState.isGameStarted) return;
    
    gameState.isGameStarted = true;
    gameState.isGameOver = false;
    gameState.level = 1;
    gameState.time = getTimeForLevel(1); // Use the getTimeForLevel function
    gameState.score = 0;
    gameState.movesSinceLastShift = 0;
    
    updateDisplay();
    generateMaze();
    startTimer();
    
    // Hide the start overlay
    startOverlay.classList.add('hidden');
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
    scoreDisplay.textContent = gameState.score;
}

// Generate the maze
function generateMaze() {
    gameBoard.innerHTML = '';
    gameBoard.style.gridTemplateColumns = `repeat(${config.gridSize.width}, 1fr)`;
    gameBoard.style.gridTemplateRows = `repeat(${config.gridSize.height}, 1fr)`;
    
    gameState.grid = [];
    
    // Create empty grid
    for (let row = 0; row < config.gridSize.height; row++) {
        gameState.grid[row] = [];
        for (let col = 0; col < config.gridSize.width; col++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.dataset.row = row;
            cell.dataset.col = col;
            gameBoard.appendChild(cell);
            
            // Decide cell type (wall, path, obstacle)
            let cellType = 'path';
            
            // Border walls
            if (row === 0 || row === config.gridSize.height - 1 || col === 0 || col === config.gridSize.width - 1) {
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
    
    // Ensure spawn area in top-left is clear for player movement
    clearSpawnArea();
    
    // Place player at top left (not in corner, but close)
    placePlayer(1, 1);
    
    // Place exit at bottom right
    placeExit(config.gridSize.height - 2, config.gridSize.width - 2);
    
    // Place enemy in one of the other corners (not where player or exit are)
    placeEnemyInCorner();
    
    // Ensure there's a path to exit
    createPathToExit();
}

// Clear the spawn area to ensure player has room to move
function clearSpawnArea() {
    // Clear a 3x3 area around the spawn point (excluding border walls)
    for (let row = 1; row <= 2; row++) {
        for (let col = 1; col <= 2; col++) {
            gameState.grid[row][col] = 'path';
            const cell = getCellElement(row, col);
            cell.className = 'cell';
        }
    }
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
    if (row >= 0 && row < config.gridSize.height && col >= 0 && col < config.gridSize.width) {
        gameState.exitPosition = { row, col };
        gameState.grid[row][col] = 'exit';
        
        const cell = getCellElement(row, col);
        cell.className = 'cell exit';
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
        row < config.gridSize.height && 
        col >= 0 && 
        col < config.gridSize.width && 
        gameState.grid[row][col] !== 'wall'
    );
}

// Ensure there's a path from player to exit
function createPathToExit() {
    const { row: playerRow, col: playerCol } = gameState.playerPosition;
    const { row: exitRow, col: exitCol } = gameState.exitPosition;
    
    // Clear any walls in the player's and exit's cells
    gameState.grid[playerRow][playerCol] = 'path';
    gameState.grid[exitRow][exitCol] = 'exit';
    
    // Create a zigzag path from player to exit
    let currentRow = playerRow;
    let currentCol = playerCol;
    
    // First move vertically to the same row as the exit
    while (currentRow < exitRow) {
        currentRow++;
        
        // Skip if there's an obstacle (find an alternate path)
        if (gameState.grid[currentRow][currentCol] === 'obstacle') {
            // Try to go around the obstacle horizontally
            if (currentCol + 1 < config.gridSize.width - 1 && gameState.grid[currentRow - 1][currentCol + 1] !== 'obstacle') {
                // Go right first
                currentCol++;
                gameState.grid[currentRow - 1][currentCol] = 'path';
                getCellElement(currentRow - 1, currentCol).className = 'cell';
            } else if (currentCol - 1 > 0 && gameState.grid[currentRow - 1][currentCol - 1] !== 'obstacle') {
                // Go left first
                currentCol--;
                gameState.grid[currentRow - 1][currentCol] = 'path';
                getCellElement(currentRow - 1, currentCol).className = 'cell';
            }
        }
        
        // Make sure we're not overwriting an obstacle
        if (gameState.grid[currentRow][currentCol] !== 'obstacle') {
            gameState.grid[currentRow][currentCol] = 'path';
            getCellElement(currentRow, currentCol).className = 'cell';
        }
    }
    
    // Then move horizontally to the exit
    while (currentCol < exitCol) {
        currentCol++;
        
        // Skip if there's an obstacle (find an alternate path)
        if (gameState.grid[currentRow][currentCol] === 'obstacle') {
            // Try to go around the obstacle vertically
            if (currentRow + 1 < config.gridSize.height - 1 && gameState.grid[currentRow + 1][currentCol - 1] !== 'obstacle') {
                // Go down first
                currentRow++;
                gameState.grid[currentRow][currentCol - 1] = 'path';
                getCellElement(currentRow, currentCol - 1).className = 'cell';
            } else if (currentRow - 1 > 0 && gameState.grid[currentRow - 1][currentCol - 1] !== 'obstacle') {
                // Go up first
                currentRow--;
                gameState.grid[currentRow][currentCol - 1] = 'path';
                getCellElement(currentRow, currentCol - 1).className = 'cell';
            }
        }
        
        // Make sure we're not overwriting an obstacle
        if (gameState.grid[currentRow][currentCol] !== 'obstacle') {
            gameState.grid[currentRow][currentCol] = 'path';
            getCellElement(currentRow, currentCol).className = 'cell';
        }
    }
    
    // Make sure the exit is properly marked
    gameState.grid[exitRow][exitCol] = 'exit';
    const exitCell = getCellElement(exitRow, exitCol);
    exitCell.className = 'cell exit';
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
    
    // Check if position is valid (within grid and not a wall or obstacle)
    const isValidMove = isValidPosition(newRow, newCol) && gameState.grid[newRow][newCol] !== 'obstacle';
    
    // If the move is valid, move the player
    if (isValidMove) {
        // Store the current type of the cell before moving
        const targetCellType = gameState.grid[newRow][newCol];
        
        placePlayer(newRow, newCol);
        
        // Check if player reached the exit
        if (targetCellType === 'exit' || checkExitReached(newRow, newCol)) {
            levelComplete();
            return;
        }
        
        // If player successfully moved after a wall shift
        const now = Date.now();
        if (now - gameState.lastShiftTime < 3000 && gameState.lastShiftTime > 0) {
            // Award points for successfully navigating after a shift
            gameState.score += config.wallShiftScore;
            updateDisplay();
        }
        
        // Increment the counter of moves since last shift
        gameState.movesSinceLastShift++;
    }
    
    // Move enemy after player attempts to move, even if the player hit a wall
    moveEnemy();
    
    // Only shift the maze if the player actually moved
    if (isValidMove) {
        // Check if we should shift the maze
        // Either we've reached the maximum number of moves between shifts
        // or we're past the minimum and the random chance hits
        const shouldShift = 
            gameState.movesSinceLastShift >= config.maxMovesBetweenShifts || 
            (gameState.movesSinceLastShift >= config.minMovesBetweenShifts && 
             Math.random() < 0.5); // 50% chance after min moves threshold
        
        if (shouldShift) {
            gameState.lastShiftTime = Date.now();
            gameState.movesSinceLastShift = 0; // Reset counter
            shiftMaze();
        }
    }
}

// Move the enemy (simple AI that follows the player)
function moveEnemy() {
    const { row: enemyRow, col: enemyCol } = gameState.enemyPosition;
    const { row: playerRow, col: playerCol } = gameState.playerPosition;
    
    // Calculate distance to player
    const distanceToPlayer = Math.abs(playerRow - enemyRow) + Math.abs(playerCol - enemyCol);
    
    // Calculate directions for potential moves
    const directions = [];
    
    // Add directions with appropriate priority and randomness
    if (playerRow < enemyRow) directions.push({ row: -1, col: 0, priority: Math.abs(playerRow - enemyRow) }); // Up
    if (playerRow > enemyRow) directions.push({ row: 1, col: 0, priority: Math.abs(playerRow - enemyRow) });  // Down
    if (playerCol < enemyCol) directions.push({ row: 0, col: -1, priority: Math.abs(playerCol - enemyCol) }); // Left
    if (playerCol > enemyCol) directions.push({ row: 0, col: 1, priority: Math.abs(playerCol - enemyCol) });  // Right
    
    // Sort directions by priority (higher priority first)
    directions.sort((a, b) => b.priority - a.priority);
    
    // Add slight randomness when close to player
    if (distanceToPlayer <= 2 && directions.length >= 2 && Math.random() < 0.3) {
        // 30% chance to swap the top two priorities when close
        // This makes it a bit unpredictable without making the AI stupid
        [directions[0], directions[1]] = [directions[1], directions[0]];
    }
    
    // Try each direction in order of priority
    for (const dir of directions) {
        const newRow = enemyRow + dir.row;
        const newCol = enemyCol + dir.col;
        
        if (isValidPosition(newRow, newCol) && gameState.grid[newRow][newCol] !== 'obstacle') {
            placeEnemy(newRow, newCol);
            
            // Check if enemy caught the player
            if (newRow === gameState.playerPosition.row && newCol === gameState.playerPosition.col) {
                endGame('The creature caught you! Better luck next time.');
            }
            
            return; // Stop after making a valid move
        }
    }
    
    // If no direct path, try diagonal or random movement
    const randomDirections = [
        { row: -1, col: -1 }, // Up-Left
        { row: -1, col: 1 },  // Up-Right
        { row: 1, col: -1 },  // Down-Left
        { row: 1, col: 1 },   // Down-Right
        { row: -1, col: 0 },  // Up
        { row: 1, col: 0 },   // Down
        { row: 0, col: -1 },  // Left
        { row: 0, col: 1 }    // Right
    ];
    
    // Shuffle random directions
    for (let i = randomDirections.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [randomDirections[i], randomDirections[j]] = [randomDirections[j], randomDirections[i]];
    }
    
    for (const dir of randomDirections) {
        const newRow = enemyRow + dir.row;
        const newCol = enemyCol + dir.col;
        
    if (isValidPosition(newRow, newCol) && gameState.grid[newRow][newCol] !== 'obstacle') {
        placeEnemy(newRow, newCol);
        
        // Check if enemy caught the player
        if (newRow === gameState.playerPosition.row && newCol === gameState.playerPosition.col) {
            endGame('The creature caught you! Better luck next time.');
            }
            
            return;
        }
    }
}

// Shift parts of the maze randomly
function shiftMaze() {
    // Play shift sound
    playSound(shiftSound);
    
    // Add a visual flash effect to the game board
    gameBoard.classList.add('flash');
    setTimeout(() => {
        gameBoard.classList.remove('flash');
    }, 300);
    
    // Choose a shift type based on level and randomness
    const shiftType = Math.random();
    
    if (shiftType < 0.4) {
        // Wall flips (original behavior - 40% chance)
        performWallFlips();
    } else if (shiftType < 0.7) {
        // Shift a corridor - 30% chance
        shiftCorridor();
    } else {
        // Add random obstacles - 30% chance
        addRandomObstacles();
    }
    
    // Ensure there's still a path to the exit after shifting
    createPathToExit();
}

// Performs the original wall-flipping behavior
function performWallFlips() {
    // Number of walls to shift (based on level)
    const shiftsCount = Math.min(5 + gameState.level, 15);
    
    for (let i = 0; i < shiftsCount; i++) {
        // Pick a random location (not on player, enemy, or exit)
        let row, col;
        let validLocation = false;
        
        while (!validLocation) {
            row = Math.floor(Math.random() * (config.gridSize.height - 2)) + 1;
            col = Math.floor(Math.random() * (config.gridSize.width - 2)) + 1;
            
            const isPlayer = row === gameState.playerPosition.row && col === gameState.playerPosition.col;
            const isEnemy = row === gameState.enemyPosition.row && col === gameState.enemyPosition.col;
            const isExit = row === gameState.exitPosition.row && col === gameState.exitPosition.col;
            const isObstacle = gameState.grid[row][col] === 'obstacle';
            
            validLocation = !isPlayer && !isEnemy && !isExit && !isObstacle;
        }
        
        // Toggle between wall and path
        const cell = getCellElement(row, col);
        
        if (gameState.grid[row][col] === 'wall') {
            gameState.grid[row][col] = 'path';
            cell.classList.remove('wall');
            cell.classList.add('wall-shifting');
            
            // Remove animation class after animation completes
            setTimeout(() => {
                cell.classList.remove('wall-shifting');
            }, 500);
        } else if (gameState.grid[row][col] === 'path') {
            gameState.grid[row][col] = 'wall';
            cell.classList.add('wall');
            cell.classList.add('wall-shifting');
            
            // Remove animation class after animation completes
            setTimeout(() => {
                cell.classList.remove('wall-shifting');
            }, 500);
        }
    }
}

// Shifts an entire corridor in the maze
function shiftCorridor() {
    // Decide if shifting a row or column
    const isRow = Math.random() < 0.5;
    
    // Select a random row/column to shift (avoiding borders)
    const index = Math.floor(Math.random() * (config.gridSize.height - 4)) + 2;
    
    // Determine shift direction (positive or negative)
    const shiftDirection = Math.random() < 0.5 ? 1 : -1;
    
    // Store the cells that will be shifted
    const originalCells = [];
    
    // Don't shift cells with player, enemy, exit, or obstacles
    const skipCells = [];
    
    // Create a map of obstacles to preserve
    const obstaclePositions = new Set();
    
    // Collect data for shifting
    if (isRow) {
        // Get original row data
        for (let col = 1; col < config.gridSize.width - 1; col++) {
            // Track obstacles
            if (gameState.grid[index][col] === 'obstacle') {
                obstaclePositions.add(`${index},${col}`);
            }
            
            originalCells.push({
                row: index,
                col: col,
                type: gameState.grid[index][col]
            });
            
            // Check if cell contains player, enemy, exit, or obstacle
            const isPlayer = index === gameState.playerPosition.row && col === gameState.playerPosition.col;
            const isEnemy = index === gameState.enemyPosition.row && col === gameState.enemyPosition.col;
            const isExit = index === gameState.exitPosition.row && col === gameState.exitPosition.col;
            const isObstacle = gameState.grid[index][col] === 'obstacle';
            
            if (isPlayer || isEnemy || isExit || isObstacle) {
                skipCells.push(col);
            }
        }
    } else {
        // Get original column data
        for (let row = 1; row < config.gridSize.height - 1; row++) {
            // Track obstacles
            if (gameState.grid[row][index] === 'obstacle') {
                obstaclePositions.add(`${row},${index}`);
            }
            
            originalCells.push({
                row: row,
                col: index,
                type: gameState.grid[row][index]
            });
            
            // Check if cell contains player, enemy, exit, or obstacle
            const isPlayer = row === gameState.playerPosition.row && index === gameState.playerPosition.col;
            const isEnemy = row === gameState.enemyPosition.row && index === gameState.enemyPosition.col;
            const isExit = row === gameState.exitPosition.row && index === gameState.exitPosition.col;
            const isObstacle = gameState.grid[row][index] === 'obstacle';
            
            if (isPlayer || isEnemy || isExit || isObstacle) {
                skipCells.push(row);
            }
        }
    }
    
    // Apply the shift
    for (let i = 0; i < originalCells.length; i++) {
        const cell = originalCells[i];
        
        // Skip obstacles - they remain in place
        if (cell.type === 'obstacle') continue;
        
        // Determine the new position
        let newPos;
        if (isRow) {
            newPos = (cell.col + shiftDirection) % (config.gridSize.width - 2);
            if (newPos === 0) newPos = config.gridSize.width - 2;
            if (newPos < 1) newPos = config.gridSize.width - 2 + newPos;
            
            // Skip if cell contains special elements or if target position has an obstacle
            if (skipCells.includes(cell.col) || skipCells.includes(newPos) || 
                obstaclePositions.has(`${cell.row},${newPos}`)) continue;
            
            // Apply the shift
            gameState.grid[cell.row][newPos] = cell.type;
            
            // Update cell appearance
            const domCell = getCellElement(cell.row, newPos);
            domCell.className = 'cell';
            if (cell.type === 'wall') domCell.classList.add('wall');
            
            // Add shifting animation
            domCell.classList.add('wall-shifting');
            setTimeout(() => {
                domCell.classList.remove('wall-shifting');
            }, 500);
        } else {
            newPos = (cell.row + shiftDirection) % (config.gridSize.height - 2);
            if (newPos === 0) newPos = config.gridSize.height - 2;
            if (newPos < 1) newPos = config.gridSize.height - 2 + newPos;
            
            // Skip if cell contains special elements or if target position has an obstacle
            if (skipCells.includes(cell.row) || skipCells.includes(newPos) || 
                obstaclePositions.has(`${newPos},${cell.col}`)) continue;
            
            // Apply the shift
            gameState.grid[newPos][cell.col] = cell.type;
            
            // Update cell appearance
            const domCell = getCellElement(newPos, cell.col);
            domCell.className = 'cell';
            if (cell.type === 'wall') domCell.classList.add('wall');
            
            // Add shifting animation
            domCell.classList.add('wall-shifting');
            setTimeout(() => {
                domCell.classList.remove('wall-shifting');
            }, 500);
        }
    }
}

// Adds random obstacles and clear paths 
function addRandomObstacles() {
    // Number of features to add (obstacles + paths)
    const featureCount = Math.min(3 + Math.floor(gameState.level / 2), 8);
    
    for (let i = 0; i < featureCount; i++) {
        // Pick a random location (not on player, enemy, or exit)
        let row, col;
        let validLocation = false;
        
        while (!validLocation) {
            row = Math.floor(Math.random() * (config.gridSize.height - 4)) + 2;
            col = Math.floor(Math.random() * (config.gridSize.width - 4)) + 2;
            
            const isPlayer = row === gameState.playerPosition.row && col === gameState.playerPosition.col;
            const isEnemy = row === gameState.enemyPosition.row && col === gameState.enemyPosition.col;
            const isExit = row === gameState.exitPosition.row && col === gameState.exitPosition.col;
            
            validLocation = !isPlayer && !isEnemy && !isExit;
        }
        
        // Decide what type of feature to add
        if (Math.random() < 0.3) {
            // Add obstacle
            gameState.grid[row][col] = 'obstacle';
            const cell = getCellElement(row, col);
            cell.className = 'cell obstacle';
            cell.classList.add('wall-shifting');
            
            // Remove animation class after animation completes
            setTimeout(() => {
                cell.classList.remove('wall-shifting');
            }, 500);
        } else {
            // Create a small path (clear a small area)
            const pathSize = Math.floor(Math.random() * 2) + 2; // 2-3 cells
            
            for (let r = -1; r <= 1; r++) {
                for (let c = -1; c <= 1; c++) {
                    if (Math.abs(r) + Math.abs(c) <= 1) { // + shape
                        const newRow = row + r;
                        const newCol = col + c;
                        
                        if (newRow > 0 && newRow < config.gridSize.height - 1 && 
                            newCol > 0 && newCol < config.gridSize.width - 1) {
                            
                            const isPlayerHere = newRow === gameState.playerPosition.row && newCol === gameState.playerPosition.col;
                            const isEnemyHere = newRow === gameState.enemyPosition.row && newCol === gameState.enemyPosition.col;
                            const isExitHere = newRow === gameState.exitPosition.row && newCol === gameState.exitPosition.col;
                            
                            if (!isPlayerHere && !isEnemyHere && !isExitHere) {
                                gameState.grid[newRow][newCol] = 'path';
                                const cell = getCellElement(newRow, newCol);
                                cell.className = 'cell';
                                cell.classList.add('wall-shifting');
                                
                                // Remove animation class after animation completes
                                setTimeout(() => {
                                    cell.classList.remove('wall-shifting');
                                }, 500);
                            }
                        }
                    }
                }
            }
        }
    }
}

// Handle level completion
function levelComplete() {
    // Play level complete sound
    playSound(levelCompleteSound);
    
    // Calculate score for completing the level
    const timeBonus = Math.ceil(gameState.time) * config.timeBonus;
    const levelScore = config.baseScorePerLevel * gameState.level;
    const levelCompleteBonus = levelScore + timeBonus;
    
    gameState.score += levelCompleteBonus;
    
    // Update level and reset timer to appropriate time for the new level
    gameState.level++;
    gameState.time = getTimeForLevel(gameState.level);
    
    updateDisplay();
    generateMaze();
}

// End the game
function endGame(message) {
    clearInterval(gameState.timerInterval);
    gameState.isGameOver = true;
    gameState.isGameStarted = false;
    
    // Remove game over sound
    // playSound(gameOverSound);
    
    gameOverMessage.textContent = message + ` You reached level ${gameState.level}.`;
    finalScoreDisplay.textContent = gameState.score;
    gameOverModal.classList.add('active');
    
    // Show the start overlay again
    startOverlay.classList.remove('hidden');
}

// Check if player has reached the exit
function checkExitReached(row, col) {
    return (
        row === gameState.exitPosition.row && 
        col === gameState.exitPosition.col
    );
}

// Place enemy in one of the available corners
function placeEnemyInCorner() {
    // Define the possible corners
    const corners = [
        { row: 1, col: config.gridSize.width - 2 },  // top-right
        { row: config.gridSize.height - 2, col: 1 }   // bottom-left
    ];
    
    // Choose a random corner
    const cornerIndex = Math.floor(Math.random() * corners.length);
    const corner = corners[cornerIndex];
    
    // Place the enemy
    placeEnemy(corner.row, corner.col);
}

// Mobile touch controls
function initTouchControls() {
    const joystickBase = document.getElementById('joystick-base');
    const joystickThumb = document.getElementById('joystick-thumb');
    
    if (!joystickBase || !joystickThumb) return;
    
    let isDragging = false;
    let centerX, centerY;
    let lastDirection = null;
    let joystickTimer = null;
    
    // Calculate base center position
    function updateJoystickCenter() {
        const rect = joystickBase.getBoundingClientRect();
        centerX = rect.left + rect.width / 2;
        centerY = rect.top + rect.height / 2;
        
        // Reset thumb position to center
        joystickThumb.style.left = '50%';
        joystickThumb.style.top = '50%';
        joystickThumb.style.transform = 'translate(-50%, -50%)';
    }
    
    function handleStart(e) {
        isDragging = true;
        updateJoystickCenter();
        handleMove(e);
    }
    
    function handleMove(e) {
        if (!isDragging) return;
        
        // Get touch position or mouse position
        const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
        
        // Calculate distance from center
        const deltaX = clientX - centerX;
        const deltaY = clientY - centerY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        // Limit distance to joystick radius
        const maxDistance = joystickBase.offsetWidth / 2;
        const limitedDistance = Math.min(distance, maxDistance);
        
        // Calculate angle
        const angle = Math.atan2(deltaY, deltaX);
        
        // Calculate new position
        const limitedX = centerX + limitedDistance * Math.cos(angle);
        const limitedY = centerY + limitedDistance * Math.sin(angle);
        
        // Update thumb position relative to joystick base
        const relX = limitedX - joystickBase.getBoundingClientRect().left;
        const relY = limitedY - joystickBase.getBoundingClientRect().top;
        
        joystickThumb.style.left = relX + 'px';
        joystickThumb.style.top = relY + 'px';
        joystickThumb.style.transform = 'translate(-50%, -50%)';
        
        // Determine movement direction
        determineDirection(deltaX, deltaY, limitedDistance / maxDistance);
    }
    
    function handleEnd() {
        if (!isDragging) return;
        
        isDragging = false;
        lastDirection = null;
        
        // Reset thumb position
        joystickThumb.style.left = '50%';
        joystickThumb.style.top = '50%';
        joystickThumb.style.transform = 'translate(-50%, -50%)';
        
        // Clear continuous movement timer
        if (joystickTimer) {
            clearInterval(joystickTimer);
            joystickTimer = null;
        }
    }
    
    function determineDirection(deltaX, deltaY, intensity) {
        // Need minimum intensity to trigger movement
        if (intensity < 0.3) return;
        
        // Determine primary direction
        let direction;
        
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            // Horizontal movement
            direction = deltaX > 0 ? 'right' : 'left';
        } else {
            // Vertical movement
            direction = deltaY > 0 ? 'down' : 'up';
        }
        
        // Only trigger if direction changed
        if (direction !== lastDirection) {
            lastDirection = direction;
            
            // Clear existing interval
            if (joystickTimer) {
                clearInterval(joystickTimer);
            }
            
            // Move immediately
            moveFromJoystick(direction);
            
            // Set up continuous movement if joystick is held
            const moveInterval = 300 - Math.min(intensity * 200, 150); // Faster interval with higher intensity
            joystickTimer = setInterval(() => {
                moveFromJoystick(direction);
            }, moveInterval);
        }
    }
    
    function moveFromJoystick(direction) {
        if (!gameState.isGameStarted || gameState.isGameOver) return;
        
        let moveDirection;
        
        switch (direction) {
            case 'up':
                moveDirection = { row: -1, col: 0 };
                break;
            case 'down':
                moveDirection = { row: 1, col: 0 };
                break;
            case 'left':
                moveDirection = { row: 0, col: -1 };
                break;
            case 'right':
                moveDirection = { row: 0, col: 1 };
                break;
            default:
                return;
        }
        
        movePlayer(moveDirection);
    }
    
    // Add event listeners for both touch and mouse
    joystickBase.addEventListener('touchstart', handleStart);
    joystickBase.addEventListener('touchmove', handleMove);
    joystickBase.addEventListener('touchend', handleEnd);
    
    // For testing on desktop
    joystickBase.addEventListener('mousedown', handleStart);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    
    // Update center position on resize or orientation change
    window.addEventListener('resize', updateJoystickCenter);
    window.addEventListener('orientationchange', updateJoystickCenter);
    
    // Initialize center position
    updateJoystickCenter();
}

// Detect if device supports touch
function isTouchDevice() {
    return (('ontouchstart' in window) ||
           (navigator.maxTouchPoints > 0) ||
           (navigator.msMaxTouchPoints > 0));
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
}); 