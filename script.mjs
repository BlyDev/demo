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


server.post('/api/uno/start', (req, res) => {
    players = req.body.players.map(name => ({ id: uuidv4(), name, hand: [] }));
    unoDeck = generateUnoDeck();
    discardPile = [unoDeck.pop()];
    currentPlayerIndex = 0;
    players.forEach(player => {
        for (let i = 0; i < 7; i++) {
            player.hand.push(unoDeck.pop());
        }
    });
    res.status(201).json({ players, discardPile, currentPlayer: players[currentPlayerIndex].name });
});

server.get('/api/uno/state', (req, res) => {
    res.status(200).json({ players, discardPile, currentPlayer: players[currentPlayerIndex].name });
});


server.post('/api/uno/play', (req, res) => {
    const { playerId, cardIndex } = req.body;
    const player = players.find(p => p.id === playerId);
    if (!player) return res.status(404).json({ error: 'Player not found' });
    if (players[currentPlayerIndex].id !== playerId) return res.status(400).json({ error: 'Not your turn' });
    const playedCard = player.hand[cardIndex];
    const topCard = discardPile[discardPile.length - 1];
    if (playedCard.color === topCard.color || playedCard.value === topCard.value || playedCard.color === 'Black') {
        player.hand.splice(cardIndex, 1);
        discardPile.push(playedCard);
        currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
        res.status(200).json({ playedCard, nextPlayer: players[currentPlayerIndex].name });
    } else {
        res.status(400).json({ error: 'Invalid move' });
    }
});


server.post('/api/uno/draw', (req, res) => {
    const { playerId } = req.body;
    const player = players.find(p => p.id === playerId);
    if (!player) return res.status(404).json({ error: 'Player not found' });
    if (players[currentPlayerIndex].id !== playerId) return res.status(400).json({ error: 'Not your turn' });
    if (unoDeck.length === 0) {
        unoDeck = discardPile.slice(0, -1).sort(() => Math.random() - 0.5);
        discardPile = [discardPile[discardPile.length - 1]];
    }
    const drawnCard = unoDeck.pop();
    player.hand.push(drawnCard);
    currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
    res.status(200).json({ drawnCard, nextPlayer: players[currentPlayerIndex].name });
});

server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
