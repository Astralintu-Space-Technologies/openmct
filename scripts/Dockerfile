FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY zmq-ws-bridge.py .

EXPOSE 8765
ENTRYPOINT ["python3", "zmq-ws-bridge.py"]
CMD ["--ws-host", "0.0.0.0", "--ws-port", "8765"]
