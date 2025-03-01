import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import session from 'express-session';
import FileStore from 'session-file-store';
import HTTP_CODES from './utils/httpCodes.mjs';

const fileStore = FileStore(session);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const server = express();
const port = process.env.PORT || 8000;

server.use(session({
    store: new fileStore({ path: './sessions' }),
    secret: 'super-secret-key-wowowowo',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));
server.use(express.static(path.join(__dirname, 'public')));
server.use(express.json());

const lines = [
    "The forest whispers softly,",
    "As the clouds begin to dance,",
    "Through the mountains, over rivers,",
    "In the moonlight's gentle trance.",
    "Stars are scattered like diamonds,",
    "On the velvet sky so deep,",
    "The wind sings through the branches,",
    "A lullaby to help us sleep.",
    "Breezes carry stories,",
    "Of lands we've never seen,",
    "Where the oceans kiss the shorelines,",
    "And the fields are always green.",
    "The mountains stand like giants,",
    "With secrets they have kept,",
    "Whispering to the wanderers,",
    "Of the dreams they've long since slept.",
    "The river hums a quiet tune,",
    "As the day fades into night,",
    "Underneath the silver moon,",
    "Everything feels just right."
];

const quotes = [
    "The only way to do great work is to love what you do. – Steve Jobs",
    "In the middle of every difficulty lies opportunity. – Albert Einstein",
    "Do not wait to strike till the iron is hot, but make it hot by striking. – William Butler Yeats",
    "It is never too late to be what you might have been. – George Eliot",
    "Life is what happens when you're busy making other plans. – John Lennon",
    "The best way to predict the future is to create it. – Peter Drucker",
];

function generateRandomPoem() {
    const shuffledLines = lines.sort(() => Math.random() - 0.5);
    return shuffledLines.slice(0, 4).join("\n");
}

function getRoot(req, res, next) {
    res.status(HTTP_CODES.SUCCESS.OK).send('Hello World').end();
}

function getPoem(req, res, next) {
    const randomPoem = generateRandomPoem();
    res.status(HTTP_CODES.SUCCESS.OK).send(randomPoem).end();
}

function getQuote(req, res, next) {
    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
    res.status(HTTP_CODES.SUCCESS.OK).send(randomQuote).end();
}

server.post('/tmp/sum/:a/:b', (req, res) => {
    const a = parseFloat(req.params.a);
    const b = parseFloat(req.params.b);
    if (isNaN(a) || isNaN(b)) {
        return res.status(HTTP_CODES.SUCCESS.BAD_REQUEST).json({
            error: "Both parameters must be valid numbers."
        });
    }
    const sum = a + b;
    return res.status(HTTP_CODES.SUCCESS.OK).json({
        sum: sum
    });
});

const standardDeck = () => {
    const suits = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'Jack', 'Queen', 'King', 'Ace'];
    return suits.flatMap(suit => ranks.map(rank => ({ suit, rank })));
};
const decks = {};

server.post('/temp/deck', (req, res) => {
    const deckId = uuidv4();
    decks[deckId] = standardDeck();
    req.session.deckId = deckId;
    res.status(201).json({ deck_id: deckId });
});

server.patch('/temp/deck/shuffle/:deck_id', (req, res) => {
    const { deck_id } = req.params;
    if (!decks[deck_id]) {
        return res.status(404).json({ error: 'Deck not found' });
    }
    decks[deck_id] = decks[deck_id].sort(() => Math.random() - 0.5);
    res.status(200).json({ message: 'Deck shuffled' });
});

server.get('/temp/deck/:deck_id', (req, res) => {
    const { deck_id } = req.params;
    if (!decks[deck_id]) {
        return res.status(404).json({ error: 'Deck not found' });
    }
    res.status(200).json(decks[deck_id]);
});

server.get('/temp/deck/:deck_id/card', (req, res) => {
    const { deck_id } = req.params;
    if (!decks[deck_id]) {
        return res.status(404).json({ error: 'Deck not found' });
    }
    if (decks[deck_id].length === 0) {
        return res.status(404).json({ error: 'No cards left in the deck' });
    }
    const randomIndex = Math.floor(Math.random() * decks[deck_id].length);
    const [card] = decks[deck_id].splice(randomIndex, 1);
    res.status(200).json(card);
});

server.use((err, req, res, next) => {
    console.error(`Error during ${req.method} ${req.url}:`, err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error'
    });
});




//------------------------------------------------------------------------------------------------------------



const colors = ['Red', 'Yellow', 'Green', 'Blue'];
const values = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'Skip', 'Reverse', '+2'];
const specialCards = ['Wild', 'Wild +4'];

const generateUnoDeck = () => {
    let deck = [];
    colors.forEach(color => {
        values.forEach(value => {
            deck.push({ color, value });
            if (value !== '0') deck.push({ color, value });
        });
    });
    specialCards.forEach(card => {
        deck.push({ color: 'Black', value: card });
        deck.push({ color: 'Black', value: card });
        deck.push({ color: 'Black', value: card });
        deck.push({ color: 'Black', value: card });
    });
    return deck.sort(() => Math.random() - 0.5);
};

let unoDeck = generateUnoDeck();
let discardPile = [];
let players = [];
let currentPlayerIndex = 0;
let direction = 1;

server.post('/api/uno/start', (req, res) => {
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
            player.hand.push(unoDeck.pop());
        }
    });

    console.log("Game Started! Players:", players);
    
    res.status(201).json({ players, discardPile, currentPlayer: players[currentPlayerIndex].name });
});


server.get('/api/uno/state', (req, res) => {
    console.log("\n--- Fetching Game State ---");

    if (players.length === 0) {
        console.error("ERROR: No players in the game!");
        return res.status(400).json({ error: "No players in the game." });
    }

    if (!players[currentPlayerIndex]) {
        console.error("ERROR: Current player index is invalid!");
        return res.status(400).json({ error: "Invalid game state. No current player." });
    }

    res.status(200).json({
        players,
        discardPile,
        currentPlayer: players[currentPlayerIndex]?.name || "Unknown"
    });

    console.log("Game state sent:", {
        players,
        discardPile,
        currentPlayer: players[currentPlayerIndex]?.name || "Unknown"
    });
});



server.post('/api/uno/draw', (req, res) => {
    const { playerId } = req.body;
    const player = players.find(p => p.id === playerId);

    console.log("\n--- Incoming Draw Request ---");
    console.log("🔹 Player ID:", playerId);

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
        unoDeck = discardPile.slice(0, -1).sort(() => Math.random() - 0.5);
        discardPile = [discardPile[discardPile.length - 1]];
    }

    const drawnCard = unoDeck.pop();
    player.hand.push(drawnCard);

    console.log(`${player.name} drew a card:`, drawnCard);

    currentPlayerIndex = getNextPlayerIndex();
    res.status(200).json({ drawnCard, nextPlayer: players[currentPlayerIndex].name });
});



server.post('/api/uno/play', (req, res) => {
    const { playerId, cardIndex, chosenColor } = req.body;
    const player = players.find(p => p.id === playerId);

    console.log("\n--- Incoming Play Request ---");
    console.log("Player ID:", playerId);
    console.log("Card Index:", cardIndex);
    console.log("Chosen Color:", chosenColor);

    if (!player) {
        console.error("ERROR: Player not found!");
        return res.status(404).json({ error: 'Player not found' });
    }

    if (players[currentPlayerIndex].id !== playerId) {
        console.error("ERROR: Not your turn!");
        return res.status(400).json({ error: 'Not your turn' });
    }

    const playedCard = player.hand[cardIndex];
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

        console.log("Wild card applied! Discard pile now:", discardPile[discardPile.length - 1]);

        if (playedCard.value === "Wild +4") {
            giveCardsToNextPlayer(4);
        }

        currentPlayerIndex = getNextPlayerIndex();
        return res.status(200).json({ playedCard, nextPlayer: players[currentPlayerIndex].name });
    }

    console.log("Validating move: Played Card:", playedCard, "Top Card:", topCard);
    if (playedCard.color !== topCard.color && playedCard.value !== topCard.value) {
        console.error("ERROR: Invalid move - Colors do not match!");
        console.log("Expected Color:", topCard.color, " | Provided Color:", playedCard.color);
        return res.status(400).json({ error: "Invalid move" });
    }

    console.log("Move is valid!");

    player.hand.splice(cardIndex, 1);
    discardPile.push(playedCard);

    console.log("Top Card After Play:", discardPile[discardPile.length - 1]);

    switch (playedCard.value) {
        case "+2":
            giveCardsToNextPlayer(2);
            break;
        case "Wild +4":
            giveCardsToNextPlayer(4);
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
    }

    currentPlayerIndex = getNextPlayerIndex();
    console.log("Next Player:", players[currentPlayerIndex].name);

    return res.status(200).json({ playedCard, nextPlayer: players[currentPlayerIndex].name });
});

const giveCardsToNextPlayer = (numCards) => {
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
};

const getNextPlayerIndex = () => {
    return (currentPlayerIndex + direction + players.length) % players.length;
};

server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/service-worker.js")
        .then(() => console.log("Service Worker registered"))
        .catch((err) => console.log("Service Worker failed:", err));
}
