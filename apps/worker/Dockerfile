FROM python:3.11-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1 PYTHONPATH=/app/src
COPY apps/worker/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY apps/worker/src ./src
COPY contracts/ /contracts/
CMD ["python", "-m", "worker"]
