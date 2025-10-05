# CLyra - Real-time Chat Application

CLyra is a real-time chat application featuring a React frontend and a Node.js backend. It uses WebRTC for secure, peer-to-peer communication and Socket.IO for signaling. The application is architected for a decoupled deployment, with the frontend hosted on Vercel and the backend on a container service like Render.

## Technologies Used

*   **Frontend:**
    *   React
    *   Vite
    *   Socket.IO Client
*   **Backend:**
    *   Node.js
    *   Express
    *   Socket.IO
    *   Docker
*   **Deployment:**
    *   Vercel (Frontend)
    *   Render, Fly.io, or any container hosting service (Backend)

## Project Structure

The project is organized into two main, independent parts:

*   **Frontend (`/`):** A React application built with Vite.
*   **Backend (`/server`):** A Node.js signaling server, ready to be containerized with Docker.

### File Structure
```
.
├── Dockerfile.backend        # Dockerfile for the backend server
├── README.md                 # Project documentation
├── package.json              # Frontend dependencies and scripts
├── server/
│   ├── package.json          # Backend dependencies and scripts
│   └── server.js             # The Node.js signaling server
├── src/
│   ├── components/           # React components
│   ├── services/             # Services for authentication and WebRTC
│   ├── App.jsx               # Main React application component
│   └── main.jsx              # Entry point for the React application
└── vercel.json               # Vercel deployment configuration for the frontend
```

## Local Development Setup

### Prerequisites

*   Node.js (LTS version recommended)
*   npm (Node Package Manager)
*   Docker (Optional, for building the backend image locally)

### 1. Clone the Repository

```bash
git clone [repository-url]
cd clyra
```

### 2. Install Dependencies

This project uses a single `package.json` at the root for the frontend. The backend has its own `package.json`.

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd server
npm install
cd ..
```

### 3. Configure Environment Variables

Create a `.env` file in the project root for the frontend:

```
VITE_SIGNALING_SERVER_URL=http://localhost:3001
```

### 4. Running the Application Locally

You'll need two separate terminals to run the frontend and backend servers.

**Terminal 1: Start the Backend Server**

```bash
cd server
npm start
```
The signaling server will be running on `http://localhost:3001`.

**Terminal 2: Start the Frontend Development Server**

```bash
# From the project root directory
npm run dev
```
The React application will open in your browser at `http://localhost:5173`.

## Deployment

The frontend and backend are designed to be deployed independently.

### Backend Deployment (Render)

The backend is containerized and can be deployed to any service that supports Docker or Node.js.

1.  **Push your code to a GitHub repository.**
2.  **Create a new Web Service on Render** and connect your repository.
3.  **Configuration:**
    *   **Environment:** `Node`
    *   **Root Directory:** `server`
    *   **Build Command:** `npm install`
    *   **Start Command:** `npm start`
4.  **Add Environment Variables:**
    *   `CORS_ORIGIN`: The URL of your deployed Vercel frontend (e.g., `https://your-app.vercel.app`).
5.  **Deploy.** Render will provide a public URL for your backend (e.g., `https://your-backend.onrender.com`).

### Frontend Deployment (Vercel)

1.  **Connect your GitHub repository to Vercel.**
2.  **Configuration:** Vercel should automatically detect and configure the project as a Vite application.
3.  **Add Environment Variables:**
    *   `VITE_SIGNALING_SERVER_URL`: The public URL of your deployed Render backend.
4.  **Deploy.**

## How WebRTC Communication Works

CLyra uses WebRTC for direct peer-to-peer communication, facilitated by the Socket.IO signaling server.

1.  **User Registration:** When a user logs in, the client connects to the signaling server and registers its `userId`, associating it with a unique `socket.id`.
2.  **Offer/Answer Exchange:** To initiate a chat, one client sends an **Offer** to the other via the signaling server. The receiving client responds with an **Answer**, also relayed by the server.
3.  **ICE Candidate Exchange:** Both clients gather network addresses (ICE candidates) and exchange them through the signaling server to find the best path for a direct connection.
4.  **Peer-to-Peer Connection:** Once a path is found, a direct `RTCPeerConnection` is established.
5.  **Data Channel:** A `DataChannel` is created over the peer connection, allowing chat messages to be sent directly between users, ensuring low latency and privacy.
