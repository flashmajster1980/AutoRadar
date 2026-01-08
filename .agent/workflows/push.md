---
description: Rýchly Git Push všetkých zmien bez potvrdzovania
---

// turbo-all

Tento workflow automaticky pridá všetky zmeny, vytvorí commit a odošle dáta na GitHub.

1. Pridať zmeny a commitnúť
```powershell
git add . ; git commit -m "Manual fast update via /push"
```

2. Odoslať na GitHub
```powershell
git push origin main
```
