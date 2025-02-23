Versjon: 1.0.0
Dette er et Uno API bygget med Node.js og Express, publisert på Render. API støtter CRUD operasjoner for å spille Uno digitalt, inkludert start av nytt spill, spille kort og trekke kort.
PROD URL: https://demo-1-o5lq.onrender.com

Start spillet:
POST /api/uno/start/
body:
{
  "players": ["Alice", "Bob", "Charlie"]
}

Sjekk spillstatus:
GET /api/uno/state/

Spille et kort:
POST /api/uno/play
body:
{
  "playerId": "{{playerId}}",
  "cardIndex": 0
}

Trekke kort:
POST /api/uno/draw
body:
{
  "playerId": "{{playerId}}"
}
