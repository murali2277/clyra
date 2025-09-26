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

## How WebRTC Communication Works

CLyra uses WebRTC for direct peer-to-peer communication between users, facilitated by a Socket.IO signaling server. Here's a breakdown of the communication flow:

1.  **User Registration & Signaling:**
    *   When a user logs into the CLyra client, their browser connects to the Socket.IO signaling server (`http://localhost:3001`).
    *   The client registers its `userId` with the server, associating it with its unique Socket.IO `socket.id`. This allows the server to route messages to specific users.

2.  **Initiating a Call (Offer/Answer Model):**
    *   When User A wants to chat with User B, User A's client initiates a WebRTC peer connection.
    *   User A's client creates a `DataChannel` (for sending chat messages) and then generates an **Offer** (an `RTCSessionDescription` of its capabilities).
    *   This Offer is sent to the signaling server, which then forwards it to User B.
    *   User B's client receives the Offer, sets it as its `remoteDescription`, and then generates an **Answer** (an `RTCSessionDescription` responding to User A's offer).
    *   User B's client sends this Answer back to the signaling server, which forwards it to User A.
    *   User A's client receives the Answer and sets it as its `remoteDescription`.

3.  **ICE Candidate Exchange (Network Discovery):**
    *   During the Offer/Answer exchange, both User A and User B's clients start gathering **ICE Candidates**. These candidates are potential network addresses (IP addresses and ports) through which the peers can connect.
    *   Each time a client discovers an ICE candidate, it sends this candidate to the signaling server, which forwards it to the other peer.
    *   Peers add received ICE candidates to their `RTCPeerConnection` using `addIceCandidate()`. This process helps the peers discover the best possible path for direct communication, potentially bypassing NATs and firewalls using STUN/TURN servers.

4.  **Establishing Peer-to-Peer Connection:**
    *   Once enough ICE candidates have been exchanged and processed, the WebRTC peers attempt to establish a direct connection.
    *   The `RTCPeerConnection` transitions through various states (`checking`, `connected`, `completed`).
    *   Upon successful connection, the `DataChannel` opens, and chat messages can be sent directly between User A and User B without passing through the signaling server.

5.  **Data Channel Communication:**
    *   Messages sent via `WebRTCService.sendMessage()` are transmitted over the established `DataChannel`.
    *   The `DataChannel` provides a reliable, ordered, and secure way to exchange arbitrary data (like chat messages) directly between browsers.

## WebRTC Troubleshooting

If you encounter WebRTC connection issues (e.g., ICE connection state changing to `disconnected` or `failed`), ensure:

*   Both client and server are running.
*   Firewall rules are not blocking ports 3001 (for signaling) and other dynamic ports used by WebRTC.
*   STUN/TURN servers are correctly configured (currently using `stun:stun.l.google.com:19302`).
*   Browser console logs are checked for WebRTC-specific errors.
</content>
<task_progress>
- [x] Analyze WebRTC connection issues
- [x] Read `webrtcService.js`
- [x] Improve ICE candidate handling and `onnegotiationneeded` logic
- [x] Install client dependencies
- [x] Install server dependencies
- [x] Run server (kill existing process)
- [x] Run server
- [x] Run client
- [x] Launch browser to verify fix
- [x] Click "Sign in with Google" button
- [x] Close browser
- [x] Verify fix
- [x] Stop running processes (node.exe)
- [x] Stop running processes (vite.exe)
- [x] Create `README.md`
- [x] Document project requirements
- [x] Read `README.md` for update
- [x] Update `README.md` with working procedure
</task_progress>
