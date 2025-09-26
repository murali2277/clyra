# CLyra - Real-time Chat Application

CLyra is a real-time chat application built with React for the frontend and Node.js for the backend, utilizing WebRTC for peer-to-peer communication and Socket.IO for signaling.

## Project Structure

The project is organized into two main parts:

*   **Client (`clyra/`):** The React frontend application.
*   **Server (`clyra/server/`):** The Node.js backend signaling server.

## Requirements

To run this project, you need:

*   Node.js (LTS version recommended)
*   npm (Node Package Manager)

## Setup Instructions

Follow these steps to set up and run the project locally:

### 1. Clone the Repository (if applicable)

If you haven't already, clone the project repository:

```bash
git clone [repository-url]
cd clyra
```

### 2. Install Client Dependencies

Navigate to the client directory and install the dependencies:

```bash
cd clyra
npm install
```

### 3. Install Server Dependencies

Navigate to the server directory and install the dependencies:

```bash
cd server
npm install
```

## Running the Application

### 1. Start the Signaling Server

From the `clyra/server` directory, start the Node.js signaling server:

```bash
cd clyra/server
node server.js
```

The server will typically run on `http://localhost:3001`.

### 2. Start the Client Application

From the `clyra` directory, start the React development server:

```bash
cd clyra
npm run dev
```

The client application will typically open in your browser at `http://localhost:5173` (or another available port like `5174`).

## Features

*   Real-time chat
*   WebRTC for peer-to-peer data transfer
*   Socket.IO for signaling
*   Google authentication (requires configuration)

## WebRTC Troubleshooting

If you encounter WebRTC connection issues (e.g., ICE connection state changing to `disconnected` or `failed`), ensure:

*   Both client and server are running.
*   Firewall rules are not blocking ports 3001 (for signaling) and other dynamic ports used by WebRTC.
*   STUN/TURN servers are correctly configured (currently using `stun:stun.l.google.com:19302`).
*   Browser console logs are checked for WebRTC-specific errors.
