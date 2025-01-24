const createDeckBtn = document.getElementById("createDeckBtn");
const shuffleDeckBtn = document.getElementById("shuffleDeckBtn");
const getDeckBtn = document.getElementById("getDeckBtn");
const drawCardBtn = document.getElementById("drawCardBtn");
const deckIdInput = document.getElementById("deckIdInput");
const responseContainer = document.getElementById("responseContainer");
const cardContainer = document.getElementById("cardContainer");

let currentDeckId = "";

async function apiRequest(method, endpoint) {
  const response = await fetch(endpoint, { method });
  return response.json();
}

createDeckBtn.addEventListener("click", async () => {
  const response = await apiRequest("POST", "/temp/deck");
  currentDeckId = response.deck_id;
  deckIdInput.value = currentDeckId;
  shuffleDeckBtn.disabled = false;
  getDeckBtn.disabled = false;
  drawCardBtn.disabled = false;

  responseContainer.innerText = `Deck Created! ID: ${currentDeckId}`;
});


shuffleDeckBtn.addEventListener("click", async () => {
  if (!currentDeckId) return alert("No deck ID found!");
  const response = await apiRequest("PATCH", `/temp/deck/shuffle/${currentDeckId}`);
  responseContainer.innerText = response.message;
});

getDeckBtn.addEventListener("click", async () => {
  if (!currentDeckId) return alert("No deck ID found!");
  const response = await apiRequest("GET", `/temp/deck/${currentDeckId}`);
  responseContainer.innerText = JSON.stringify(response, null, 2);
});

drawCardBtn.addEventListener("click", async () => {
  if (!currentDeckId) return alert("No deck ID found!");
  const response = await apiRequest("GET", `/temp/deck/${currentDeckId}/card`);

  if (response.error) {
    responseContainer.innerText = response.error;
  } else {
    responseContainer.innerText = `You drew: ${response.rank} of ${response.suit}`;
    cardContainer.innerText = `🎴 ${response.rank} of ${response.suit}`;
  }
});
