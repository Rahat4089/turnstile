FROM oven/bun:1

# Install Python
RUN apt-get update && \
    apt-get install -y python3 python3-pip && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy project files
COPY . .

# Run setup.py
RUN python3 setup.py install

# Install Bun dependencies
RUN bun install

# Start the application
CMD ["bun", "start"]
