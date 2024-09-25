# # Use Node.js slim image
# FROM node:18-slim

# # Set the working directory in the container
# WORKDIR /app

# # Copy the docker-server folder to the container
# COPY docker-server/package.json ./package.json
# COPY docker-server/server.js ./server.js

# # Install necessary packages
# RUN npm install

# # Expose port 3000 (where the server will run)
# EXPOSE 3000

# # Start the Node.js server when the container starts
# CMD ["node", "server.js"]

FROM node:18-slim

# Create a non-root user
RUN useradd --user-group --create-home --shell /bin/false appuser

# Set the working directory
WORKDIR /app

# Copy server files
COPY docker-server/package.json ./package.json
COPY docker-server/server.js ./server.js

# Install dependencies
RUN npm install

# Change ownership to the non-root user
RUN chown -R appuser:appuser /app

# Switch to the non-root user
USER appuser

# Expose port 3000
EXPOSE 3000

# Start the server
CMD ["node", "server.js"]
