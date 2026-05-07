FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# Runtime: "node" or "bun"
ARG RUNTIME=node
ENV RUNTIME=${RUNTIME}
# Node.js version (default: 20, ignored if RUNTIME=bun)
ARG NODE_VERSION=20

# Install base dependencies
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    bash \
    python3 \
    php \
    bc \
    procps \
    ca-certificates \
    gnupg \
    unzip \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js when RUNTIME=node
RUN if [ "$RUNTIME" = "node" ]; then \
        mkdir -p /etc/apt/keyrings && \
        curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg && \
        echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_VERSION}.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list && \
        apt-get update && \
        apt-get install -y nodejs && \
        rm -rf /var/lib/apt/lists/*; \
    fi

# Install Bun when RUNTIME=bun
# Symlink bun→node so #!/usr/bin/env node shebangs resolve to Bun's node-compat runtime.
# Same workaround Bun-only users apply on host systems.
RUN if [ "$RUNTIME" = "bun" ]; then \
        curl -fsSL https://bun.sh/install | bash && \
        ln -s /root/.bun/bin/bun /usr/local/bin/bun && \
        ln -s /root/.bun/bin/bunx /usr/local/bin/bunx && \
        ln -s /root/.bun/bin/bun /usr/local/bin/node; \
    fi

# Install mocha globally (only needed for Node runtime)
RUN if [ "$RUNTIME" = "node" ]; then \
        npm install -g mocha; \
    fi

WORKDIR /var/pm2

# Copy package files first (for layer caching)
COPY package*.json ./

# Install dependencies
RUN if [ "$RUNTIME" = "bun" ]; then \
        bun install; \
    else \
        npm install; \
    fi

# Environment
ENV PM2_DISCRETE_MODE=true
ENV PM2_SILENT=true
ENV NODE_ENV=test

CMD ["bash"]
