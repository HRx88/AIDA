#!/bin/bash
# setup.sh — One-time RPi setup for AIDA companion
set -e

echo "=== AIDA RPi Setup ==="

# System dependencies (including Bluetooth audio)
sudo apt update
sudo apt install -y portaudio19-dev python3-pyaudio espeak flac \
  chromium-browser unclutter pulseaudio-module-bluetooth bluez pipewire-alsa

# Create virtual environment
python3 -m venv ~/aida/venv
source ~/aida/venv/bin/activate
pip install flask flask-cors SpeechRecognition pyttsx3

# Disable screen blanking
sudo bash -c 'cat >> /etc/xdg/lxsession/LXDE-pi/autostart << EOF
@xset s off
@xset -dpms
@xset s noblank
@unclutter -idle 0.1 -root
EOF'

echo "=== Setup complete. Reboot recommended. ==="
