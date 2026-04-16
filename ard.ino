#include <ArduinoJson.h> // Required: Install via Library Manager

// -------- PIN CONFIG --------
const int trigPin = 8;
const int echoPin = 7;
const int pumpPin = 9;

// -------- SYSTEM PARAMETERS --------
float H = 13.0;          // total tank height in cm
float setpoint = 6.0;    // desired level in cm (Initial)

// -------- OUTPUT LIMITS --------
const int minUsefulPWM = 140;   
const int maxPWM = 220;

// -------- PI VARIABLES --------
float error = 0.0;
float prevError = 0.0;
float integral = 0.0;
float u = 0.0;
unsigned long prevTime = 0;

// -------- PUMP START SUPPORT --------
bool pumpRunning = false;
unsigned long pumpStartTime = 0;
const unsigned long kickTime = 500;      
const unsigned long minOnTime = 1500;    

// -------- SENSOR READ --------
float readLevelCm() {
  long duration;
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  duration = pulseIn(echoPin, HIGH, 30000);
  if (duration == 0) return -1.0;

  float distance = duration * 0.0343 / 2.0;
  distance = distance - 0.7;   
  float level = H - distance;

  if (level < 0) level = 0;
  if (level > H) level = H;
  return level;
}

float getStableLevel() {
  float sum = 0.0;
  int count = 0;
  for (int i = 0; i < 5; i++) {
    float x = readLevelCm();
    if (x >= 0) { sum += x; count++; }
    delay(30);
  }
  if (count == 0) return -1.0;
  return sum / count;
}

void setup() {
  Serial.begin(9600);
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);
  pinMode(pumpPin, OUTPUT);
  analogWrite(pumpPin, 0);
  prevTime = millis();
}

void loop() {
  // === 1. RECEIVE SETPOINT FROM WEB ===
  if (Serial.available() > 0) {
    StaticJsonDocument<200> rxDoc;
    DeserializationError err = deserializeJson(rxDoc, Serial);
    if (!err) {
      if (rxDoc.containsKey("sp")) {
        float spPercent = rxDoc["sp"]; 
        // Convert % from web (0-100) to cm (0-H)
        setpoint = (spPercent / 100.0) * H;
      }
    }
  }

  float level = getStableLevel();

  // Safety/Sensor Protection
  if (level < 0 || level < 0.3 || level > 12.5) {
    analogWrite(pumpPin, 0);
    integral = 0;
    pumpRunning = false;
    sendJsonData(level, 0); // Send status even when off
    return;
  }

  // === PI CALCULATION (YOUR ORIGINAL LOGIC) ===
  unsigned long now = millis();
  float dt = (now - prevTime) / 1000.0;
  if (dt <= 0) dt = 0.01;
  prevTime = now;

  error = setpoint - level;
  if (abs(error) < 0.05) error = 0.0;

  float Kp, Ki;
  if (level < 4.5) { Kp = 24.0; Ki = 4.0; } 
  else { Kp = 16.0; Ki = 2.5; }

  if ((prevError < 0 && error > 0) || (prevError > 0 && error < 0)) {
    integral = 0.3 * integral;
  }

  integral += error * dt;
  if (integral > 12.0) integral = 12.0;
  if (integral < -4.0) integral = -4.0;

  u = Kp * error + Ki * integral;
  if (u < 0) u = 0;
  if (u > maxPWM) u = maxPWM;

  int pwmCommand = (int)u;
  if (pwmCommand > 0 && pwmCommand < minUsefulPWM) pwmCommand = minUsefulPWM;

  int appliedPWM = 0;
  if (pwmCommand > 0) {
    if (!pumpRunning) { pumpRunning = true; pumpStartTime = now; }
    unsigned long onDuration = now - pumpStartTime;
    appliedPWM = (onDuration < kickTime) ? 255 : pwmCommand;
  } else {
    if (pumpRunning && (now - pumpStartTime < minOnTime)) {
      unsigned long onDuration = now - pumpStartTime;
      appliedPWM = (onDuration < kickTime) ? 255 : minUsefulPWM;
    } else {
      appliedPWM = 0;
      pumpRunning = false;
    }
  }

  analogWrite(pumpPin, appliedPWM);
  prevError = error;

  // === 2. SEND DATA TO WEB (REPLACES YOUR OLD DEBUG) ===
  sendJsonData(level, appliedPWM);

  delay(200); // Reduced delay for smoother UI updates
}

// Helper function to format JSON for the server
void sendJsonData(float level, int pwm) {
  StaticJsonDocument<200> txDoc;
  
  // The server expects "distance" to calculate height
  // Or we can send height directly if you updated server.js
  txDoc["distance"] = H - level; 
  txDoc["sp"] = (setpoint / H) * 100.0; // Send as %
  txDoc["pi"] = u;
  txDoc["valve"] = map(pwm, 0, 255, 0, 100); // PWM to %
  
  serializeJson(txDoc, Serial);
  Serial.println(); // CRITICAL: Tells server "end of message"
}               
