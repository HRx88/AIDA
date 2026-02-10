# CNAD ASG2 AIDA
## Project Overview
AIDA is a cloud-native microservices-based system designed to support Persons with Intellectual Disability (PWIDs) in completing and tracking Activities of Daily Living (ADLs) such as self-care routines and household tasks. The system focuses on empowering users through gentle guidance, reminders and accessible digital interactions such as a virtual pet that acts as a visual motivator and a reward mechanism that reinforces consistent task completion.

In addition, AIDA supports MINDS staff and volunteers by providing access to manage client profiles, configure task support and communicate with users when assistance is needed. By leveraging a modular and scalable architecture, AIDA is designed for long-term usability, ethical AI use, and deployment across different care environments.

## Problem Statement
PWIDs may face challenges in  completing daily tasks which could impact their overall well-being. Existing solutions often rely on invasive monitoring methods that compromise privacy and autonomy within the home environment.

This project addresses the question:
How might we use technology to support and empower PWIDs in completing and tracking their daily tasks, without unnecessarily infringing on the privacy of their home environment?

This project explores how technology can support and empower PWIDs to manage and track daily tasks in a privacy-respecting, safe, and user-friendly manner, while enabling MINDS staff and volunteers to provide appropriate support through controlled access.

## Architecture & Architecture Decision Records (ADR)


## Tech Stack
- Frontend: HTML, CSS, JavaScript
- Backend / Services: Node.js and Python-based microservices
- Authentication & Profile Management: Auth-service with role-based permissions
- Communication: Video call service and voice interaction module
- Containerisation: Docker, Docker Compose
- Architecture Style: Cloud-native microservices with RESTful APIs

## Core Features
- User authentication and role-based access control  
- Profile management for PWIDs and staff  
- Task scheduling and reminders for ADLs  
- Virtual pet for motivation and engagement  
- Reward system to reinforce task completion  
- Video and voice communication for support  
  
## Assumptions / limitations
- Users have access to a basic digital device and internet connectivity
- Task completion is self-reported and not automatically detected
- The system avoids intrusive monitoring methods (e.g. cameras or sensors) to preserve user privacy
- AI features are assistive and supportive, not autonomous decision-makers
- The system is designed as a prototype and may require further testing for large-scale deployment
  
## Setup Instructions
1. Clone the repository
git clone https://github.com/HRx88/AIDA.git

2. Navigate into the project directory
cd AIDA

3. Build and run all services using Docker
docker-compose up --build

4. Access the frontend via the configured local port
