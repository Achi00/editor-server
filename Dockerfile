# Use an official Node.js runtime as the base image
FROM node:14-slim

# Set the working directory in the container to /app
WORKDIR /app

# Install any needed packages specified in package.json
# This is a placeholder - the actual package.json will be mounted at runtime
COPY package*.json ./

# Make port 3000 available to the world outside this container
EXPOSE 3000

# Define environment variable
ENV NODE_ENV=production

# Run npm install when the container launches
CMD ["npm", "install"]