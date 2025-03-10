import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import session from 'express-session';
import FileStore from 'session-file-store';
import cors from 'cors';
import { query } from './db.mjs';

const fileStore = FileStore(session);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const server = express();
const port = process.env.PORT || 8000;

server.use(cors());
server.use(session({
    store: new fileStore({ path: './sessions' }),
    secret: 'super-secret-key-wowowowo',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));
server.use(express.static(path.join(__dirname, 'public')));
server.use(express.json());


let unoDeck = [];
let discardPile = [];
let players = [];
let currentPlayerIndex = 0;
let direction = 1;



const generateUnoDeck = () => {
    const colors = ['Red', 'Yellow', 'Green', 'Blue'];
    const values = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'Skip', 'Reverse', '+2'];
    const specialCards = ['Wild', 'Wild +4'];
    let deck = [];
    colors.forEach(color => {
        values.forEach(value => {
            deck.push({ color, value });
            if (value !== '0') deck.push({ color, value });
        });
    });
    specialCards.forEach(card => {
        for (let i = 0; i < 4; i++) {
            deck.push({ color: 'Black', value: card });
        }
    });
    return deck.sort(() => Math.random() - 0.5);
};

const getNextPlayerIndex = () => {
    return (currentPlayerIndex + direction + players.length) % players.length;
};

const giveCardsToNextPlayer = async (numCards) => {
    const nextPlayerIndex = getNextPlayerIndex();
    const nextPlayer = players[nextPlayerIndex];
    if (unoDeck.length < numCards) {
        unoDeck = discardPile.slice(0, -1).sort(() => Math.random() - 0.5);
        discardPile = [discardPile[discardPile.length - 1]];
    }
    for (let i = 0; i < numCards; i++) {
        if (unoDeck.length > 0) {
            nextPlayer.hand.push(unoDeck.pop());
        }
    }
    console.log(`${nextPlayer.name} drew ${numCards} cards!`);
    await query(
      'UPDATE players SET hand = $1 WHERE player_id = $2',
      [JSON.stringify(nextPlayer.hand), nextPlayer.id]
    );
};

server.post('/api/uno/start', async (req, res) => {
    try {
        console.log("\n--- Starting New Uno Game ---");
        if (!req.body.players || req.body.players.length < 2) {
            console.error("ERROR: At least two players are required!");
            return res.status(400).json({ error: "At least two players are required to start the game." });
        }
        players = req.body.players.map(name => ({ id: uuidv4(), name, hand: [] }));
        unoDeck = generateUnoDeck();
        discardPile = [unoDeck.pop()];
        currentPlayerIndex = 0;
        direction = 1;
        players.forEach(player => {
            for (let i = 0; i < 7; i++) {
                const card = unoDeck.pop();
                if (card) {
                    player.hand.push(card);
                } else {
                    console.error("Error: not enough cards in deck");
                }
            }
        });
        let gameId = null;
        try {
            const gameResult = await query(
                'INSERT INTO games (status) VALUES ($1) RETURNING id',
                ['active']
            );
            if (gameResult.rows.length > 0) {
                gameId = gameResult.rows[0].id;
                console.log("Game inserted:", gameResult.rows);
            } else {
                console.warn("Warning: No game id returned from DB");
            }
        } catch (dbError) {
            console.error("Error inserting game:", dbError);
        }
        for (const player of players) {
            try {
                await query(
                    'INSERT INTO players (game_id, player_id, player_name, hand) VALUES ($1, $2, $3, $4)',
                    [gameId, player.id, player.name, JSON.stringify(player.hand)]
                );
            } catch (dbError) {
                console.error(`Error inserting player ${player.name}:`, dbError);
            }
        }
        console.log("Game Started! Players:", players);
        res.status(201).json({ gameId, players, discardPile, currentPlayer: players[currentPlayerIndex].name });
    } catch (error) {
        console.error("Error starting game:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});


server.get('/api/uno/state', (req, res) => {
    console.log("\n--- Fetching Game State ---");
    if (players.length === 0) {
        console.error("ERROR: No players in the game!");
        return res.status(400).json({ error: "No players in the game." });
    }
    if (!players[currentPlayerIndex]) {
        console.error("ERROR: Invalid game state. No current player.");
        return res.status(400).json({ error: "Invalid game state. No current player." });
    }
    console.log("Game state sent:", {
        players,
        discardPile,
        currentPlayer: players[currentPlayerIndex].name
    });
    res.status(200).json({
        players,
        discardPile,
        currentPlayer: players[currentPlayerIndex].name
    });
});

server.post('/api/uno/draw', async (req, res) => {
    try {
        const { playerId } = req.body;
        console.log("\n--- Incoming Draw Request ---");
        console.log("🔹 Player ID:", playerId);
        
        const player = players.find(p => p.id === playerId);
        if (!player) {
            console.error("ERROR: Player not found!");
            return res.status(404).json({ error: 'Player not found' });
        }
        
        if (players[currentPlayerIndex].id !== playerId) {
            console.error("ERROR: Not your turn!");
            return res.status(400).json({ error: 'Not your turn' });
        }
        
        if (unoDeck.length === 0) {
            console.warn("🔄 Reshuffling discard pile into deck...");
            if (discardPile.length > 1) {
                const topCard = discardPile[discardPile.length - 1];
                unoDeck = discardPile.slice(0, -1).sort(() => Math.random() - 0.5);
                discardPile = [topCard];
            } else {
                console.error("ERROR: Not enough cards to reshuffle.");
                return res.status(500).json({ error: "No cards left to draw." });
            }
        }
        
        const drawnCard = unoDeck.pop();
        if (!drawnCard) {
            console.error("ERROR: No card drawn, deck might be empty.");
            return res.status(500).json({ error: "Failed to draw a card." });
        }
        player.hand.push(drawnCard);
        console.log(`${player.name} drew a card:`, drawnCard);
        
        try {
            await query(
                'UPDATE players SET hand = $1 WHERE player_id = $2',
                [JSON.stringify(player.hand), player.id]
            );
        } catch (dbError) {
            console.error(`Error updating hand for ${player.name} in draw:`, dbError);
        }
        
        currentPlayerIndex = getNextPlayerIndex();
        return res.status(200).json({ drawnCard, nextPlayer: players[currentPlayerIndex].name });
    } catch (error) {
        console.error("Error during draw:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
});


server.post('/api/uno/play', async (req, res) => {
    try {
        const { playerId, cardIndex, chosenColor } = req.body;
        console.log("\n--- Incoming Play Request ---");
        console.log("Player ID:", playerId);
        console.log("Card Index:", cardIndex);
        console.log("Chosen Color:", chosenColor);
        
        const player = players.find(p => p.id === playerId);
        if (!player) {
            console.error("ERROR: Player not found!");
            return res.status(404).json({ error: 'Player not found' });
        }
        
        if (players[currentPlayerIndex].id !== playerId) {
            console.error("ERROR: Not your turn!");
            return res.status(400).json({ error: 'Not your turn' });
        }
        
        if (typeof cardIndex !== 'number' || cardIndex < 0 || cardIndex >= player.hand.length) {
            console.error("ERROR: Invalid card index:", cardIndex);
            return res.status(400).json({ error: "Invalid card index" });
        }
        
        const playedCard = player.hand[cardIndex];
        if (!playedCard) {
            console.error("ERROR: No card found at index", cardIndex);
            return res.status(400).json({ error: "No card at given index" });
        }
        
        const topCard = discardPile[discardPile.length - 1];
        console.log("Played Card:", playedCard);
        console.log("Top Card Before Play:", topCard);
        
        if (playedCard.color === "Black") {
            if (!["Red", "Yellow", "Green", "Blue"].includes(chosenColor)) {
                console.error("ERROR: Invalid color choice! Received:", chosenColor);
                return res.status(400).json({ error: "Invalid color choice" });
            }
            console.log("Wild card played! Changing color to:", chosenColor);
            discardPile.push({ color: chosenColor, value: playedCard.value });
            player.hand.splice(cardIndex, 1);
            try {
                await query('UPDATE players SET hand = $1 WHERE player_id = $2', [
                    JSON.stringify(player.hand),
                    player.id
                ]);
            } catch (dbError) {
                console.error(`Error updating hand for ${player.name} in play (wild):`, dbError);
            }
            if (playedCard.value === "Wild +4") {
                try {
                    await giveCardsToNextPlayer(4);
                } catch (dbError) {
                    console.error("Error giving cards to next player for Wild +4:", dbError);
                }
            }
            currentPlayerIndex = getNextPlayerIndex();
            return res.status(200).json({ playedCard, nextPlayer: players[currentPlayerIndex].name });
        }
        
        if (playedCard.color !== topCard.color && playedCard.value !== topCard.value) {
            console.error("ERROR: Invalid move - Colors or values do not match!", {
                topCard,
                playedCard
            });
            return res.status(400).json({ error: "Invalid move" });
        }
        
        player.hand.splice(cardIndex, 1);
        discardPile.push(playedCard);
        try {
            await query('UPDATE players SET hand = $1 WHERE player_id = $2', [
                JSON.stringify(player.hand),
                player.id
            ]);
        } catch (dbError) {
            console.error(`Error updating hand for ${player.name} in play:`, dbError);
        }
        
        switch (playedCard.value) {
            case "+2":
                try {
                    await giveCardsToNextPlayer(2);
                } catch (dbError) {
                    console.error("Error giving cards to next player for +2:", dbError);
                }
                break;
            case "Wild +4":
                try {
                    await giveCardsToNextPlayer(4);
                } catch (dbError) {
                    console.error("Error giving cards to next player for Wild +4:", dbError);
                }
                break;
            case "Skip":
                currentPlayerIndex = getNextPlayerIndex();
                break;
            case "Reverse":
                direction *= -1;
                if (players.length === 2) {
                    currentPlayerIndex = getNextPlayerIndex();
                }
                break;
            default:
                break;
        }
        
        currentPlayerIndex = getNextPlayerIndex();
        console.log("Next Player:", players[currentPlayerIndex].name);
        return res.status(200).json({ playedCard, nextPlayer: players[currentPlayerIndex].name });
    } catch (error) {
        console.error("Error during play:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});


server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

if (typeof navigator !== 'undefined' && "serviceWorker" in navigator) {
    navigator.serviceWorker.register("/service-worker.js")
        .then(() => console.log("Service Worker registered"))
        .catch((err) => console.log("Service Worker failed:", err));
}
