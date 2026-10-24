# Combat and party references

Reference source snapshots reviewed for the combat and replay improvements:

| Project | Revision | Use in Pana |
| --- | --- | --- |
| [Cla-Go](https://github.com/Kwusv55/Cla-Go) | `0cb5e7d0d5b8394623fec1e603a1bbf4b8ffd043` | Adapted Verlet distance constraints, weighted impact and floor friction in Pepazo's knockout solver. |
| [grandma-gta](https://github.com/andyhuo520/grandma-gta) | `dbf0dc568b7d332d444694a899d8986e693fc8d8` | Maximum-extension sampling idea for Trifulca's procedural attack timing; existing Pana melee, knockback and recovery retained. |
| [parlour](https://github.com/braedonsaunders/parlour) | `e0e38e961f096116d3875d7c19802c8e4fb5f49d` | Rule replay and incremental claim verification design; deterministic bot pacing and simulation gates adapted to Dominó. |

Full MIT notices are preserved in the adjacent files. No external character
models, voices, artwork, frontend framework or transport implementation are
included. Pana keeps its own shared sculpt, synthesized sound and Colyseus rooms.
