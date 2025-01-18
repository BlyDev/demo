import express from 'express';
import HTTP_CODES from './utils/httpCodes.mjs';

const server = express();
const port = (process.env.PORT || 8000);

server.set('port', port);
server.use(express.static('public'));

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

function generateRandomPoem() {
    const shuffledLines = lines.sort(() => Math.random() - 0.5);
    return shuffledLines.slice(0, 4).join("\n"); 
}

const quotes = [
    "The only way to do great work is to love what you do. – Steve Jobs",
    "In the middle of every difficulty lies opportunity. – Albert Einstein",
    "Do not wait to strike till the iron is hot, but make it hot by striking. – William Butler Yeats",
    "It is never too late to be what you might have been. – George Eliot",
    "Life is what happens when you're busy making other plans. – John Lennon",
    "The best way to predict the future is to create it. – Peter Drucker",
];

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

server.get("/", getRoot);
server.get("/tmp/poem", getPoem);
server.get("/tmp/quote", getQuote);

server.listen(server.get('port'), function () {
    console.log('server running on port', server.get('port'));
});
