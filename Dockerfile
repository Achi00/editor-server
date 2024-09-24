# # Use an official Node.js runtime as the base image
# FROM node:14-slim

# # Set the working directory in the container to /app
# WORKDIR /app

# # Install any needed packages specified in package.json
# # This is a placeholder - the actual package.json will be mounted at runtime
# COPY package*.json ./

# # Make port 3000 available to the world outside this container
# EXPOSE 3000

# # Define environment variable
# ENV NODE_ENV=production

# # Run npm install when the container launches
# CMD ["npm", "install"]

# Use Node.js slim image
FROM node:18-slim

# Set the working directory in the container
WORKDIR /app

# Copy the docker-server folder to the container
COPY docker-server/package.json ./package.json
COPY docker-server/server.js ./server.js

# Install necessary packages
RUN npm install

# Expose port 3000 (where the server will run)
EXPOSE 3000

# Start the Node.js server when the container starts
CMD ["node", "server.js"]

