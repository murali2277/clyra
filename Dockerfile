# Stage 1: Build the frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .
RUN npm run build
RUN ls -la /app/dist # Add this line to inspect the build output

# Stage 2: Build the backend and serve the frontend
FROM node:20-alpine

WORKDIR /app

# Copy backend package.json and install dependencies
COPY server/package.json server/package-lock.json ./server/
RUN npm install --prefix ./server

# Copy backend source code
COPY server/server.js ./server/

# Copy the built frontend from the frontend-builder stage
COPY --from=frontend-builder /app/dist ./public/

# Expose the port the server runs on
EXPOSE 3001

# Command to run the backend server
CMD ["node", "server/server.js"]
