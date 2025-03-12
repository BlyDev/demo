import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import session from 'express-session';
import FileStore from 'session-file-store';
import cors from 'cors';
import { query } from './db.mjs';


class DAL {
    static async insertGame(game) {
        return await query(
            'INSERT INTO games (status, players, discard_pile, current_player_index, direction) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [
                game.status,
                JSON.stringify(game.players.map(p => ({ id: p.id, name: p.name, hand: p.hand }))),
                JSON.stringify(game.discardPile),
                game.currentPlayerIndex,
                game.direction
            ]
        );
    }
    static async insertPlayer(gameId, player) {
        return await query(
            'INSERT INTO players (game_id, player_id, player_name, hand) VALUES ($1, $2, $3, $4)',
            [gameId, player.id, player.name, JSON.stringify(player.hand)]
        );
    }
    static async updatePlayerHand(playerId, hand) {
        return await query(
            'UPDATE players SET hand = $1 WHERE player_id = $2',
            [JSON.stringify(hand), playerId]
        );
    }
}

class Card {
    constructor(color, value) {
        this.color = color;
        this.value = value;
    }
}

class Player {
    constructor(id, name) {
        this.id = id;
        this.name = name;
        this.hand = [];
    }

    async updateHand() {
        await DAL.updatePlayerHand(this.id, this.hand);
    }
}

class Game {
    constructor(playerNames) {
        this.status = 'active';
        this.players = playerNames.map(name => new Player(uuidv4(), name));
        this.deck = this.generateUnoDeck();
        this.discardPile = [];
        this.currentPlayerIndex = 0;
        this.direction = 1;
        this.id = null;
    }

    generateUnoDeck() {
        const colors = ['Red', 'Yellow', 'Green', 'Blue'];
        const values = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'Skip', 'Reverse', '+2'];
        const specialCards = ['Wild', 'Wild +4'];
        let deck = [];
        colors.forEach(color => {
            values.forEach(value => {
                deck.push(new Card(color, value));
                if (value !== '0') deck.push(new Card(color, value));
            });
        });
        specialCards.forEach(card => {
            for (let i = 0; i < 4; i++) {
                deck.push(new Card('Black', card));
            }
        });
        return deck.sort(() => Math.random() - 0.5);
    }

    start() {
        this.discardPile = [this.deck.pop()];
        this.players.forEach(player => {
            for (let i = 0; i < 7; i++) {
                const card = this.deck.pop();
                if (card) {
                    player.hand.push(card);
                } else {
                    console.error("Error: ikke nok kort i stokken");
                }
            }
        });
    }

    getNextPlayerIndex() {
        return (this.currentPlayerIndex + this.direction + this.players.length) % this.players.length;
    }

    async giveCardsToNextPlayer(numCards) {
        const nextPlayerIndex = this.getNextPlayerIndex();
        const nextPlayer = this.players[nextPlayerIndex];
        if (this.deck.length < numCards) {
            this.deck = this.discardPile.slice(0, -1).sort(() => Math.random() - 0.5);
            this.discardPile = [this.discardPile[this.discardPile.length - 1]];
        }
        for (let i = 0; i < numCards; i++) {
            if (this.deck.length > 0) {
                nextPlayer.hand.push(this.deck.pop());
            }
        }
        console.log(`${nextPlayer.name} trakk ${numCards} kort!`);
        await nextPlayer.updateHand();
    }

    async drawCard(playerId) {
        const player = this.players.find(p => p.id === playerId);
        if (!player) throw new Error("Spiller ikke funnet");
        if (this.players[this.currentPlayerIndex].id !== playerId) throw new Error("Ikke din tur");
        if (this.deck.length === 0) {
            if (this.discardPile.length > 1) {
                const topCard = this.discardPile[this.discardPile.length - 1];
                this.deck = this.discardPile.slice(0, -1).sort(() => Math.random() - 0.5);
                this.discardPile = [topCard];
            } else {
                throw new Error("Ingen kort igjen å trekke");
            }
        }
        const drawnCard = this.deck.pop();
        if (!drawnCard) throw new Error("Kunne ikke trekke kort");
        player.hand.push(drawnCard);
        await player.updateHand();
        this.currentPlayerIndex = this.getNextPlayerIndex();
        return { drawnCard, nextPlayer: this.players[this.currentPlayerIndex].name };
    }

    async playCard({ playerId, cardIndex, chosenColor }) {
        const player = this.players.find(p => p.id === playerId);
        if (!player) throw new Error("Spiller ikke funnet");
        if (this.players[this.currentPlayerIndex].id !== playerId) throw new Error("Ikke din tur");
        if (typeof cardIndex !== 'number' || cardIndex < 0 || cardIndex >= player.hand.length) throw new Error("Ugyldig kortindeks");

        const playedCard = player.hand[cardIndex];
        if (!playedCard) throw new Error("Ingen kort funnet ved angitt indeks");

        const topCard = this.discardPile[this.discardPile.length - 1];
        if (playedCard.color === "Black") {
            if (!["Red", "Yellow", "Green", "Blue"].includes(chosenColor)) {
                throw new Error("Ugyldig fargevalg");
            }
            console.log("Wild card spilt! Endrer farge til:", chosenColor);
            this.discardPile.push(new Card(chosenColor, playedCard.value));
            player.hand.splice(cardIndex, 1);
            await player.updateHand();
            if (playedCard.value === "Wild +4") {
                await this.giveCardsToNextPlayer(4);
            }
            this.currentPlayerIndex = this.getNextPlayerIndex();
            return { playedCard, nextPlayer: this.players[this.currentPlayerIndex].name };
        }

        if (playedCard.color !== topCard.color && playedCard.value !== topCard.value) {
            throw new Error("Ugyldig trekk: farge eller verdi stemmer ikke");
        }

        player.hand.splice(cardIndex, 1);
        this.discardPile.push(playedCard);
        await player.updateHand();

        switch (playedCard.value) {
            case "+2":
                await this.giveCardsToNextPlayer(2);
                break;
            case "Wild +4":
                await this.giveCardsToNextPlayer(4);
                break;
            case "Skip":
                this.currentPlayerIndex = this.getNextPlayerIndex();
                break;
            case "Reverse":
                this.direction *= -1;
                if (this.players.length === 2) {
                    this.currentPlayerIndex = this.getNextPlayerIndex();
                }
                break;
            default:
                break;
        }

        this.currentPlayerIndex = this.getNextPlayerIndex();
        return { playedCard, nextPlayer: this.players[this.currentPlayerIndex].name };
    }
}

const fileStore = FileStore(session);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const server = express();
const port = process.env.PORT || 8000;

function requestLogger(req, res, next) {
    console.log(`${req.method} ${req.url} - ${new Date().toISOString()}`);
    console.log(`Body:`, req.body);
    console.log(`Headers:`, req.headers);
    next();
}

server.use(requestLogger);
server.use(cors());
server.use(session({
    store: new fileStore({ path: './sessions' }),
    secret: '123haha123',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));
server.use(express.static(path.join(__dirname, 'public')));
server.use(express.json());
server.use((err, req, res, next) => {
    console.error(`Error: ${err.message}`);
    res.status(err.status || 500).json({
        error: err.message || 'Internt serverfeil'
    });
});

let currentGame = null;

server.post('/api/uno/start', async (req, res) => {
    try {
        console.log("\n--- Starter nytt Uno-spill ---");
        if (!req.body.players || req.body.players.length < 2) {
            console.error("FEIL: Minst to spillere kreves");
            return res.status(400).json({ error: "Minst to spillere kreves for å starte spillet." });
        }
        currentGame = new Game(req.body.players);
        currentGame.start();

        let gameId = null;
        try {
            const gameResult = await DAL.insertGame(currentGame);
            if (gameResult.rows.length > 0) {
                gameId = gameResult.rows[0].id;
                currentGame.id = gameId;
                console.log("Spill lagret:", gameResult.rows);
            } else {
                console.warn("Advarsel: Ingen spill-ID returnert fra DB");
            }
        } catch (dbError) {
            console.error("Feil ved lagring av spill:", dbError);
        }
        for (const player of currentGame.players) {
            try {
                await DAL.insertPlayer(gameId, player);
            } catch (dbError) {
                console.error(`Feil ved innsetting av spiller ${player.name}:`, dbError);
            }
        }
        console.log("Spill startet! Spillere:", currentGame.players);
        res.status(201).json({
            gameId,
            players: currentGame.players.map(p => ({ id: p.id, name: p.name, hand: p.hand })),
            discardPile: currentGame.discardPile,
            currentPlayer: currentGame.players[currentGame.currentPlayerIndex].name
        });
    } catch (error) {
        console.error("Feil ved start av spill:", error);
        res.status(500).json({ error: "Intern serverfeil" });
    }
});

server.get('/api/uno/state', (req, res) => {
    console.log("\n--- Henter spillstatus ---");
    if (!currentGame || currentGame.players.length === 0) {
        console.error("FEIL: Ingen spillere i spillet");
        return res.status(400).json({ error: "Ingen spillere i spillet." });
    }
    console.log("Spillstatus sendt:", {
        players: currentGame.players,
        discardPile: currentGame.discardPile,
        currentPlayer: currentGame.players[currentGame.currentPlayerIndex].name
    });
    res.status(200).json({
        players: currentGame.players,
        discardPile: currentGame.discardPile,
        currentPlayer: currentGame.players[currentGame.currentPlayerIndex].name
    });
});

server.post('/api/uno/draw', async (req, res) => {
    try {
        const { playerId } = req.body;
        console.log("\n--- Trekker kort ---");
        const result = await currentGame.drawCard(playerId);
        res.status(200).json(result);
    } catch (error) {
        console.error("Feil under korttrekking:", error);
        res.status(500).json({ error: error.message || "Intern serverfeil" });
    }
});

server.post('/api/uno/play', async (req, res) => {
    try {
        const { playerId, cardIndex, chosenColor } = req.body;
        console.log("\n--- Spill trekk mottatt ---");
        const result = await currentGame.playCard({ playerId, cardIndex, chosenColor });
        res.status(200).json(result);
    } catch (error) {
        console.error("Feil under spilltrekk:", error);
        res.status(500).json({ error: error.message || "Intern serverfeil" });
    }
});

server.listen(port, () => {
    console.log(`Server kjører på http://localhost:${port}`);
});

if (typeof navigator !== 'undefined' && "serviceWorker" in navigator) {
    navigator.serviceWorker.register("/service-worker.js")
        .then(() => console.log("Service Worker registrert"))
        .catch((err) => console.log("Service Worker feilet:", err));
}
