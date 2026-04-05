FROM node:20-slim

WORKDIR /app

# Install grpc-health-probe
RUN apt-get update && apt-get install -y wget && \
    GRPC_HEALTH_PROBE_VERSION=v0.4.47 && \
    wget -qO/bin/grpc-health-probe https://github.com/grpc-ecosystem/grpc-health-probe/releases/download/${GRPC_HEALTH_PROBE_VERSION}/grpc_health_probe-linux-amd64 && \
    chmod +x /bin/grpc-health-probe && \
    apt-get purge -y wget && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY . .

CMD ["node", "index.js"]
