# engine/

Shared game code lives here — but only once a **second** game actually needs it.
Don't abstract early; duplicate first, extract on the second use.

Candidates when the time comes: WS client wrapper, input handling, lobby UI.
