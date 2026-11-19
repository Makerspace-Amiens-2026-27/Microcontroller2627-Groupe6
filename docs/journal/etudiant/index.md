---
layout: default
title: Groupe
parent: Journal de bord
has_children: true
---

# 2026-11-13 1h30

On a installer PlatformIO, on a finit le td 1 toolchain faire clignoter la led de l'esp32-s3 et le td2 port série.

# 2026-11-18 1h30

Le bouton est en pullup donc l'etat du bouton au repos correspond a l'etat logique 1 et l'etat du bouton appuyer correspond a l'etat logique 0.
La valeur du joystique en  x=1867 l'etat select passe bien a 1 lorsque l'on clique sur le joystique.
le buzzer a fait du bruit (attention au delay qui est bloquant)

# 2026-11-19 1h30
Test du pontentiomètre on tourne la valeur augmente dans le positif pour sens horaire et négatif dans le sens anti horaire