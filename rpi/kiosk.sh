#!/bin/bash
# kiosk.sh — Launch AIDA companion on RPi screen
# Usage: ./kiosk.sh <LAPTOP_IP> [USER_ID] [FULL_NAME]

LAPTOP_IP="${1:-192.168.1.10}"
USER_ID="${2:-1}"
FULL_NAME="${3:-Friend}"

AI_SERVICE_URL="http://${LAPTOP_IP}:5010"

# Activate virtual environment
source ~/aida/venv/bin/activate

# Reconnect JBL Bluetooth speaker (if not auto-connected)
bluetoothctl connect B8:69:C2:80:10:C5 2>/dev/null || true
sleep 2

# Set Bluetooth speaker as default audio output
pactl set-card-profile bluez_card.B8_69_C2_80_10_C5 a2dp-sink 2>/dev/null || true
pactl set-default-sink bluez_output.B8_69_C2_80_10_C5.1 2>/dev/null || true

# Start voice server in background
cd ~/aida
MIC_INDEX=${MIC_INDEX:-0} python3 -m app.main &
VOICE_PID=$!

sleep 3  # wait for voice server to start

# Launch Chromium in kiosk mode
chromium-browser \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --incognito \
  --window-size=800,480 \
  --window-position=0,0 \
  "${AI_SERVICE_URL}/wake?userId=${USER_ID}&fullName=${FULL_NAME}"

# Cleanup
kill $VOICE_PID 2>/dev/null
