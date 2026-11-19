#include <Arduino.h>
#include "config.h"

// Réutilisation des broches D0, D1, D2 définies dans config.h
const int PIN_CLK = PIN_JOYSTICK_X;      // D0
const int PIN_DT  = PIN_JOYSTICK_Y;      // D1
const int PIN_SW  = PIN_JOYSTICK_SELECT; // D2

int compteur = 0;
int dernierEtatCLK;

void setup() {
  Serial.begin(115200);

  pinMode(PIN_CLK, INPUT);
  pinMode(PIN_DT, INPUT);
  pinMode(PIN_SW, INPUT_PULLUP); // Pull-up interne pour le bouton du clic

  dernierEtatCLK = digitalRead(PIN_CLK);
}

void loop() {
  // 1. Lecture de la rotation
  int etatCLK = digitalRead(PIN_CLK);
  if (etatCLK != dernierEtatCLK && etatCLK == LOW) {
    if (digitalRead(PIN_DT) != etatCLK) {
      compteur++;
      Serial.print("Sens horaire (+) -> Compteur : ");
    } else {
      compteur--;
      Serial.print("Sens anti-horaire (-) -> Compteur : ");
    }
    Serial.println(compteur);
  }
  dernierEtatCLK = etatCLK;

  // 2. Lecture du clic sur l'axe
  if (digitalRead(PIN_SW) == LOW) {
    Serial.println("Clic encodeur ! Remise a zero.");
    compteur = 0;
    delay(250); // Anti-rebond simple
  }
}