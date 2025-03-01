const startGameBtn = document.getElementById("startGameBtn");
const playerNamesInput = document.getElementById("playerNames");
const gameArea = document.getElementById("gameArea");
const currentPlayerDisplay = document.getElementById("currentPlayer");
const topCardDisplay = document.getElementById("topCard");
const playerHandDiv = document.getElementById("playerHand");
const drawCardBtn = document.getElementById("drawCardBtn");
const playCardBtn = document.getElementById("playCardBtn");
const responseContainer = document.getElementById("responseContainer");

let currentPlayerId = "";
let selectedCardIndex = null;
let selectedCard = null;

async function apiRequest(method, endpoint, body = null) {
    const options = { method, headers: { "Content-Type": "application/json" } };
    if (body) options.body = JSON.stringify(body);
    const response = await fetch(endpoint, options);

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
    }

    return response.json();
}

startGameBtn.addEventListener("click", async () => {
    const playerNames = playerNamesInput.value.split(",").map(name => name.trim());
    if (playerNames.length < 2) return alert("You need at least two players!");

    try {
        const response = await apiRequest("POST", "/api/uno/start", { players: playerNames });

        gameArea.style.display = "block";
        playerNamesInput.disabled = true;
        startGameBtn.disabled = true;

        updateGameState();
    } catch (error) {
        console.error("Error starting game:", error);
        alert("Failed to start game. Please try again.");
    }
});

async function updateGameState() {
  console.log("Refreshing Game State...");

  try {
      const response = await apiRequest("GET", "/api/uno/state");

      if (response.error) {
          console.warn("Game state error:", response.error);
          return; 
      }

      console.log("Game State Updated:", response);

      currentPlayerDisplay.innerText = response.currentPlayer || "Unknown";
      const topCard = response.discardPile[response.discardPile.length - 1];
      topCardDisplay.innerText = `${topCard.color} ${topCard.value}`;

      const player = response.players.find(p => p.name === response.currentPlayer);
      if (player) {
          currentPlayerId = player.id;
      }

      playerHandDiv.innerHTML = "";
      if (player) {
          player.hand.forEach((card, index) => {
              const cardBtn = document.createElement("button");
              cardBtn.innerText = `${card.color} ${card.value}`;
              cardBtn.onclick = () => {
                  selectedCardIndex = index;
                  selectedCard = card;
                  playCardBtn.disabled = false;
              };
              playerHandDiv.appendChild(cardBtn);
          });
      }

  } catch (error) {
      console.warn("Failed to update game state (probably not started yet):", error.message);
  }
}


playCardBtn.addEventListener("click", async () => {
    if (selectedCardIndex === null || !selectedCard) return alert("Velg et kort!");

    let chosenColor = null;

    if (selectedCard.color === "Black") {
        do {
            chosenColor = prompt("Choose a color: Red, Yellow, Green, or Blue");
            if (chosenColor) {
                chosenColor = chosenColor.trim();
            }
        } while (!["Red", "Yellow", "Green", "Blue"].includes(chosenColor));

        console.log("Chosen Color:", chosenColor);
    }

    console.log("Sending Request to Server:");
    console.log("Player ID:", currentPlayerId);
    console.log("Card Index:", selectedCardIndex);
    console.log("Chosen Color:", chosenColor);

    try {
        const response = await apiRequest("POST", "/api/uno/play", {
            playerId: currentPlayerId,
            cardIndex: selectedCardIndex,
            chosenColor: chosenColor || null 
        });

        console.log("Move Successful:", response);
        playCardBtn.disabled = true;
        updateGameState();
    } catch (error) {
        console.error("Server Error:", error);
        alert(error.message);
    }
});

drawCardBtn.addEventListener("click", async () => {
    try {
        const response = await apiRequest("POST", "/api/uno/draw", { playerId: currentPlayerId });

        console.log("Card Drawn:", response);
        updateGameState();
    } catch (error) {
        console.error("Error drawing card:", error);
        alert(error.message);
    }
});

updateGameState();
