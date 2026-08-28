#include <TM1637Display.h>

// ============================================================
//  DESTRUCTOMATIC T-47 — firmware final del Arduino Nano
// ============================================================
//
// Cableado propuesto:
//   TM1637 CLK  -> D4
//   TM1637 DIO  -> D5
//   Botón de Soquetín -> D2 a GND
//   Cable correcto    -> D3 a GND (intacto = LOW, cortado = HIGH)
//   DESATIBAR BONBA   -> D6 a GND
//
// Todos los pulsadores/sensores usan INPUT_PULLUP.
// No hace falta resistencia externa.
//
// Serie USB: 115200 baud.
//
// Comandos que recibe de la app:
//   INICIAR
//   PAUSA
//   RESET
//   ESTADO
//   TIEMPO:1810       (segundos)
//
// Eventos que envía a la app:
//   BUTTON            (al SOLTAR el botón de Soquetín)
//   CABLE_OK          (cuando se corta el cable correcto)
//   FINAL             (al pulsar DESATIBAR BONBA)
//   TIMER_ZERO        (cuando el contador llega a 00:00)
//   TIME:<segundos>   (estado/sincronización)
// ============================================================

const uint8_t PIN_BUTTON = 2;
const uint8_t PIN_CABLE  = 3;
const uint8_t PIN_CLK    = 4;
const uint8_t PIN_DIO    = 5;
const uint8_t PIN_FINAL  = 6;

const unsigned long DEBOUNCE_MS = 35;
const long RESET_SECONDS = 90L * 60L + 45L; // 90:45

TM1637Display display(PIN_CLK, PIN_DIO);

long secondsLeft = RESET_SECONDS;
bool timerRunning = false;
bool zeroReported = false;
unsigned long lastTickMs = 0;

String serialLine;

// Estados de entradas ya estabilizados.
bool buttonStable;
bool cableStable;
bool finalStable;

bool buttonRawPrev;
bool cableRawPrev;
bool finalRawPrev;

unsigned long buttonChangedMs = 0;
unsigned long cableChangedMs = 0;
unsigned long finalChangedMs = 0;

bool cableEventSent = false;

void showTime() {
  long s = secondsLeft;
  if (s < 0) s = 0;

  long minutes = s / 60;
  int seconds = s % 60;
  if (minutes > 99) minutes = 99;

  int value = (int)(minutes * 100L + seconds);
  // 0b01000000 enciende los dos puntos centrales.
  display.showNumberDecEx(value, 0b01000000, true, 4, 0);
}

void sendTime() {
  Serial.print(F("TIME:"));
  Serial.println(secondsLeft);
}

void setTime(long newSeconds) {
  if (newSeconds < 0) newSeconds = 0;
  if (newSeconds > 5999) newSeconds = 5999; // 99:59, límite visual del display
  secondsLeft = newSeconds;
  zeroReported = (secondsLeft == 0);
  lastTickMs = millis();
  showTime();
  sendTime();
}

void resetExperience() {
  secondsLeft = RESET_SECONDS;
  timerRunning = true;       // INICIAR EXPERIENCIA manda RESET: el reloj empieza acá.
  zeroReported = false;
  cableEventSent = false;
  lastTickMs = millis();
  showTime();
  Serial.println(F("RESET_OK"));
  sendTime();
}

void processCommand(String cmd) {
  cmd.trim();
  if (!cmd.length()) return;

  if (cmd == F("INICIAR")) {
    timerRunning = true;
    zeroReported = false;
    lastTickMs = millis();
    Serial.println(F("RUNNING"));
    return;
  }

  if (cmd == F("PAUSA")) {
    timerRunning = false;
    Serial.println(F("PAUSED"));
    return;
  }

  if (cmd == F("RESET")) {
    resetExperience();
    return;
  }

  if (cmd == F("ESTADO")) {
    Serial.print(F("STATE:"));
    Serial.print(timerRunning ? F("RUNNING") : F("PAUSED"));
    Serial.print(F(",TIME:"));
    Serial.print(secondsLeft);
    Serial.print(F(",BUTTON:"));
    Serial.print(buttonStable ? F("UP") : F("DOWN"));
    Serial.print(F(",CABLE:"));
    Serial.print(cableStable ? F("CUT") : F("INTACT"));
    Serial.print(F(",FINAL:"));
    Serial.println(finalStable ? F("UP") : F("DOWN"));
    return;
  }

  if (cmd.startsWith(F("TIEMPO:"))) {
    long value = cmd.substring(7).toInt();
    setTime(value);
    return;
  }

  Serial.print(F("UNKNOWN:"));
  Serial.println(cmd);
}

void readSerial() {
  while (Serial.available()) {
    char c = (char)Serial.read();
    if (c == '\n') {
      processCommand(serialLine);
      serialLine = "";
    } else if (c != '\r') {
      if (serialLine.length() < 80) serialLine += c;
    }
  }
}

void updateTimer() {
  if (!timerRunning || secondsLeft <= 0) return;

  unsigned long now = millis();
  while (timerRunning && secondsLeft > 0 && (unsigned long)(now - lastTickMs) >= 1000UL) {
    lastTickMs += 1000UL;
    secondsLeft--;
    showTime();

    if (secondsLeft <= 0) {
      secondsLeft = 0;
      timerRunning = false;
      showTime();
      if (!zeroReported) {
        zeroReported = true;
        Serial.println(F("TIMER_ZERO"));
      }
    }
  }
}

void updateButton() {
  bool raw = digitalRead(PIN_BUTTON); // HIGH = suelto, LOW = pulsado
  unsigned long now = millis();

  if (raw != buttonRawPrev) {
    buttonRawPrev = raw;
    buttonChangedMs = now;
  }

  if (raw != buttonStable && (unsigned long)(now - buttonChangedMs) >= DEBOUNCE_MS) {
    bool old = buttonStable;
    buttonStable = raw;

    // El juego necesita continuar cuando SUELTA el botón, no cuando lo presiona.
    if (old == LOW && buttonStable == HIGH) {
      Serial.println(F("BUTTON"));
    }
  }
}

void updateCable() {
  bool raw = digitalRead(PIN_CABLE); // LOW intacto (a GND), HIGH cortado
  unsigned long now = millis();

  if (raw != cableRawPrev) {
    cableRawPrev = raw;
    cableChangedMs = now;
  }

  if (raw != cableStable && (unsigned long)(now - cableChangedMs) >= DEBOUNCE_MS) {
    cableStable = raw;
    if (cableStable == HIGH && !cableEventSent) {
      cableEventSent = true;
      Serial.println(F("CABLE_OK"));
    }
  }
}

void updateFinalButton() {
  bool raw = digitalRead(PIN_FINAL); // HIGH = suelto, LOW = pulsado
  unsigned long now = millis();

  if (raw != finalRawPrev) {
    finalRawPrev = raw;
    finalChangedMs = now;
  }

  if (raw != finalStable && (unsigned long)(now - finalChangedMs) >= DEBOUNCE_MS) {
    finalStable = raw;
    if (finalStable == LOW) {
      Serial.println(F("FINAL"));
    }
  }
}

void setup() {
  pinMode(PIN_BUTTON, INPUT_PULLUP);
  pinMode(PIN_CABLE, INPUT_PULLUP);
  pinMode(PIN_FINAL, INPUT_PULLUP);

  Serial.begin(115200);
  serialLine.reserve(80);

  display.setBrightness(7, true);

  buttonStable = buttonRawPrev = digitalRead(PIN_BUTTON);
  cableStable  = cableRawPrev  = digitalRead(PIN_CABLE);
  finalStable  = finalRawPrev  = digitalRead(PIN_FINAL);

  // Si al encender ya está cortado, no generar un falso evento de corte.
  cableEventSent = (cableStable == HIGH);

  showTime();
  Serial.println(F("BOMBA_READY"));
  sendTime();
}

void loop() {
  readSerial();
  updateTimer();
  updateButton();
  updateCable();
  updateFinalButton();
}
