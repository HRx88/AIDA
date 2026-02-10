# CNADASG2

test

test2

## Project Overview
AIDA is a cloud-native microservices-based system designed to support Persons with Intellectual Disability (PWIDs) in completing and tracking Activities of Daily Living (ADLs) such as self-care routines and household tasks. The system focuses on empowering users through gentle guidance, reminders, and accessible digital interactions.

In addition, AIDA supports MINDS staff and volunteers by providing access to manage client profiles, configure task support and communicate with users when assistance is needed. By leveraging a modular and scalable architecture, AIDA is designed for long-term usability, ethical AI use, and deployment across different care environments.

## Problem Statement
PWIDs may face challenges in  completing daily tasks, which can negatively their overall well-being. Existing technological solutions often rely on invasive monitoring methods that compromise privacy and autonomy within the home environment.

This project addresses the question:
How might we use technology to support and empower PWIDs in completing and tracking their daily tasks, without unnecessarily infringing on the privacy of their home environment?

AIDA aims to provide supportive, privacy-respecting assistance while ensuring safety, usability, and ethical data handling for both PWIDs and MINDS staff.

## Architecture & Architecture Decision Records (ADR)

## Features
## Tech Stack
- Frontend: HTML, CSS, JavaScript
- Backend / Services: Node.js and Python-based microservices
- Authentication & Profile Management: Auth-service with role-based permissions
- Communication: Video call service and voice interaction module
- Containerisation: Docker, Docker Compose
- Architecture Style: Cloud-native microservices with RESTful APIs
- 
## Assumptions / limitations

## Setup Instructions

# Clone the repository
git clone https://github.com/HRx88/AIDA.git

# Navigate into the project directory
cd AIDA

# Build and run all services using Docker
docker-compose up --build

# Access the frontend via the configured local port
