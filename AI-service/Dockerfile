FROM python:3.12-slim

WORKDIR /app

# Install Python dependencies
COPY AI-service/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy AI modules
COPY ai/ ./ai/

# Copy UI templates and static files
COPY ui/ ./ui/

# Copy the main server file
COPY AI-service/main.py ./main.py

EXPOSE 5010

CMD ["python", "main.py"]
