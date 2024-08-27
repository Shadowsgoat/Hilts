const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const random = require('random');
const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
    partials: [Partials.Channel],
});

// Store user balances
let userBalances = {};

// Utility function to get user balance
function getBalance(user) {
    if (!userBalances[user.id]) {
        userBalances[user.id] = 1000; // Starting balance
    }
    return userBalances[user.id];
}

// Utility function to update balance
function updateBalance(user, amount) {
    if (!userBalances[user.id]) {
        userBalances[user.id] = 1000; // Starting balance
    }
    userBalances[user.id] += amount;
}

// Slash command handler
client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
    
    const commands = [
        {
            name: 'balance',
            description: 'Check your current balance.'
        },
        {
            name: 'slots',
            description: 'Play a slot machine game.'
        },
        {
            name: 'dice',
            description: 'Roll a dice.'
        },
        {
            name: 'leaderboard',
            description: 'Check the leaderboard.'
        },
        {
            name: 'mines',
            description: 'Play the Mines game.',
            options: [{
                name: 'bet',
                type: 4, // Integer
                description: 'The amount to bet',
                required: true
            }]
        },
        {
            name: 'towers',
            description: 'Play the Towers game.',
            options: [{
                name: 'bet',
                type: 4, // Integer
                description: 'The amount to bet',
                required: true
            }]
        }
    ];

    const rest = new REST({ version: '9' }).setToken('YOUR_BOT_TOKEN');
    rest.put(Routes.applicationCommands(client.user.id), { body: commands })
        .then(() => console.log('Successfully registered application commands.'))
        .catch(console.error);
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName } = interaction;
    const user = interaction.user;

    if (commandName === 'balance') {
        const balance = getBalance(user);
        await interaction.reply(`${user.username}, your current balance is ${balance} coins!`);
    } 

    else if (commandName === 'slots') {
        const balance = getBalance(user);
        const bet = 100; // Fixed bet for simplicity
        
        if (balance < bet) {
            await interaction.reply(`${user.username}, you don't have enough coins to play!`);
            return;
        }

        const symbols = ['🍒', '🍋', '🍉', '🔔', '⭐', '💎'];
        const slot1 = symbols[random.int(0, symbols.length - 1)];
        const slot2 = symbols[random.int(0, symbols.length - 1)];
        const slot3 = symbols[random.int(0, symbols.length - 1)];
        const result = `| ${slot1} | ${slot2} | ${slot3} |`;

        if (slot1 === slot2 && slot2 === slot3) {
            const winnings = bet * 10;
            updateBalance(user, winnings);
            await interaction.reply(`${result}\nJackpot! ${user.username}, you won ${winnings} coins!`);
        } else {
            updateBalance(user, -bet);
            await interaction.reply(`${result}\nSorry ${user.username}, better luck next time! Lost ${bet} coins.`);
        }
    } 

    else if (commandName === 'dice') {
        const balance = getBalance(user);
        const bet = 50; // Fixed bet for simplicity
        
        if (balance < bet) {
            await interaction.reply(`${user.username}, you don't have enough coins to play!`);
            return;
        }

        const diceRoll = random.int(1, 6);
        const result = `🎲 You rolled a ${diceRoll}!`;

        if (diceRoll === 6) {
            const winnings = bet * 5;
            updateBalance(user, winnings);
            await interaction.reply(`${result} Lucky roll! ${user.username}, you won ${winnings} coins!`);
        } else {
            updateBalance(user, -bet);
            await interaction.reply(`${result} Sorry ${user.username}, you lost ${bet} coins.`);
        }
    } 

    else if (commandName === 'leaderboard') {
        const sortedBalances = Object.entries(userBalances).sort(([, a], [, b]) => b - a);
        const topUsers = sortedBalances.slice(0, 5).map(([userId, balance]) => `<@${userId}>: ${balance} coins`).join('\n');
        await interaction.reply(`**Leaderboard:**\n${topUsers}`);
    } 

    else if (commandName === 'mines') {
        const bet = interaction.options.getInteger('bet');
        const balance = getBalance(user);

        if (bet > balance) {
            await interaction.reply(`${user.username}, you don't have enough coins to place that bet!`);
            return;
        }

        const numMines = 3;
        const boardSize = 5;
        const minePositions = new Set(random.sample(Array.from({ length: boardSize * boardSize }, (_, i) => i), numMines));
        const board = Array(boardSize * boardSize).fill('⬛');

        function displayBoard() {
            return board.map((tile, idx) => `${tile}`).join('').match(/.{1,5}/g).join('\n');
        }

        await interaction.reply(`${user.username}, you are playing Mines! Pick a tile by typing its number (1-${boardSize * boardSize}).\n${displayBoard()}`);

        let i = 0;
        while (i < boardSize * boardSize - numMines) {
            const filter = msg => msg.author.id === user.id && /^\d+$/.test(msg.content);
            const guess = await interaction.channel.awaitMessages({ filter, max: 1, time: 30000 });
            const tile = parseInt(guess.first().content) - 1;

            if (minePositions.has(tile)) {
                board[tile] = '💣';
                updateBalance(user, -bet);
                await interaction.channel.send(`${user.username}, you hit a mine! You lose ${bet} coins.\n${displayBoard()}`);
                return;
            }

            board[tile] = '✅';
            await interaction.channel.send(`${user.username}, good choice! Continue or type 'stop' to cash out.\n${displayBoard()}`);

            const stop = await interaction.channel.awaitMessages({ filter: m => m.author.id === user.id && m.content.toLowerCase() === 'stop', max: 1, time: 30000 });
            if (stop.size > 0) {
                const winnings = Math.floor(bet * 1.5);
                updateBalance(user, winnings);
                await interaction.channel.send(`${user.username}, you cashed out and won ${winnings} coins!\n${displayBoard()}`);
                return;
            }
            i++;
        }

        const winnings = bet * 2;
        updateBalance(user, winnings);
        await interaction.channel.send(`${user.username}, you cleared the board and won ${winnings} coins!\n${displayBoard()}`);
    } 

    else if (commandName === 'towers') {
        const bet = interaction.options.getInteger('bet');
        const balance = getBalance(user);

        if (bet > balance) {
            await interaction.reply(`${user.username}, you don't have enough coins to place that bet!`);
            return;
        }

        const numLevels = 5;
        let level = 1;
        let multiplier = 1.2;

        while (level <= numLevels) {
            await interaction.reply(`${user.username}, you're on level ${level}. Pick a tower (1, 2, or 3).`);

            const filter = msg => msg.author.id === user.id && ['1', '2', '3'].includes(msg.content);
            const guess = await interaction.channel.awaitMessages({ filter, max: 1, time: 30000 });
            const choice = parseInt(guess.first().content);

            const safeTower = random.int(1, 3);

            if (choice === safeTower) {
                const winnings = Math.floor(bet * multiplier);
                await interaction.channel.send(`${user.username}, you chose wisely! You can cash out ${winnings} coins or continue to the next level.`);
                level++;
                multiplier += 0.5;

                const stop = await interaction.channel.awaitMessages({ filter: m => m.author.id === user.id && m.content.toLowerCase() === 'cash out', max: 1, time: 30000 });
                if (stop.size > 0) {
                    updateBalance(user, winnings);
                    await interaction.channel.send(`${user.username}, you cashed out and won ${winnings} coins!`);
                    return;
                }
            } else {
                updateBalance(user, -bet);
                await interaction.channel.send(`${user.username}, you chose the wrong tower and lost ${bet} coins.`);
                return;
            }
        }

        const winnings = Math.floor(bet * multiplier);
        updateBalance(user, winnings);
        await interaction.channel.send(`${user.username}, you reached the top and won ${winnings} coins!`);
    }
});

client.login('MTI0MTgxODEyMjUyMTAxODUxOA.GE3jr3.AXEMUWWqcq5M8Rxgzobozny4FiLdvVm3iVdxgo');
