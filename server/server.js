const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const path = require('path'); // Add path module

const app = express();
const server = http.createServer(app);

app.use(cors({
  origin: "http://localhost:5173",
  credentials: true
}));

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, '../public')));

const io = socketIo(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Store user mappings: email -> {socketId, socket}
const users = new Map();
// Store socket mappings: socket.id -> email
const sockets = new Map();

// Helper function to cleanup user mappings
function cleanupUser(socketId, email = null) {
  if (!email) {
    email = sockets.get(socketId);
  }
  
  if (email) {
    console.log(`Server: Cleaning up user ${email} with socket ${socketId}`);
    users.delete(email);
  }
  
  sockets.delete(socketId);
}

// Helper function to register user with better error handling
function registerUser(socket, email) {
  console.log(`Server: Registering user ${email} with socket ID ${socket.id}`);
  
  // Remove any existing mapping for this email
  if (users.has(email)) {
    const oldData = users.get(email);
    if (oldData.socketId !== socket.id) {
      console.log(`Server: Removing old socket ${oldData.socketId} for user ${email}`);
      sockets.delete(oldData.socketId);
      // Disconnect old socket if it still exists
      if (oldData.socket && oldData.socket.connected) {
        oldData.socket.disconnect(true);
      }
    }
  }
  
  // Store new mappings
  users.set(email, { socketId: socket.id, socket: socket });
  sockets.set(socket.id, email);
  
  console.log(`Server: User ${email} successfully registered with socket ${socket.id}`);
  console.log('Server: Current active users:', Array.from(users.keys()));
}

io.on('connection', (socket) => {
  console.log(`Server: New connection established with socket ID ${socket.id}`);

  // Register user
  socket.on('register-user', (email) => {
    if (!email || typeof email !== 'string') {
      console.error(`Server: Invalid email provided for registration: ${email}`);
      socket.emit('registration-error', { message: 'Invalid email' });
      return;
    }
    
    registerUser(socket, email);
    socket.emit('registration-success', { email, socketId: socket.id });
  });

  // Handle invite sending
  socket.on('send-invite', (data) => {
    console.log(`Server: Processing invite from ${data.from} to ${data.to}`);
    
    if (!data.to || !data.from) {
      console.error('Server: Invalid invite data', data);
      socket.emit('invite-error', { message: 'Invalid invite data' });
      return;
    }

    const receiverData = users.get(data.to);
    
    if (receiverData && receiverData.socket && receiverData.socket.connected) {
      receiverData.socket.emit('invite', data.from);
      console.log(`Server: Invite forwarded to ${data.to} (socket: ${receiverData.socketId})`);
      socket.emit('invite-sent', { to: data.to });
    } else {
      console.log(`Server: User ${data.to} not found or not connected`);
      socket.emit('user-not-found', { email: data.to });
    }
  });

  // Handle invite acceptance
  socket.on('accept-invite', (data) => {
    console.log(`Server: Processing invite acceptance from ${data.from} to ${data.to}`);
    
    const senderData = users.get(data.to);
    
    if (senderData && senderData.socket && senderData.socket.connected) {
      senderData.socket.emit('invite-accepted', data.from);
      console.log(`Server: Invite acceptance forwarded to ${data.to} (socket: ${senderData.socketId})`);
    } else {
      console.log(`Server: User ${data.to} not found for invite acceptance`);
      socket.emit('signaling-error', { 
        message: `User ${data.to} not found for invite acceptance`,
        targetEmail: data.to 
      });
    }
  });

  // Handle invite decline
  socket.on('decline-invite', (data) => {
    console.log(`Server: Processing invite decline from ${data.from} to ${data.to}`);
    
    const senderData = users.get(data.to);
    
    if (senderData && senderData.socket && senderData.socket.connected) {
      senderData.socket.emit('invite-declined', data.from);
      console.log(`Server: Invite decline forwarded to ${data.to} (socket: ${senderData.socketId})`);
    } else {
      console.log(`Server: User ${data.to} not found for invite decline`);
    }
  });

  // Handle WebRTC signaling with improved error handling
  socket.on('signal', (data) => {
    const senderEmail = sockets.get(socket.id);
    
    if (!senderEmail) {
      console.error(`Server: No email found for socket ${socket.id} - signaling failed`);
      socket.emit('signaling-error', { message: 'Sender not registered' });
      return;
    }

    if (!data.to) {
      console.error('Server: No target email in signaling data');
      socket.emit('signaling-error', { message: 'No target specified' });
      return;
    }

    console.log(`Server: Processing signal from ${senderEmail} (${socket.id}) to ${data.to}`);
    console.log(`Server: Signal type: ${data.signal.type || 'ICE candidate'}`);
    
    const receiverData = users.get(data.to);
    
    if (receiverData && receiverData.socket && receiverData.socket.connected) {
      // Forward the signal with sender information
      receiverData.socket.emit('signal', {
        signal: data.signal,
        from: senderEmail
      });
      console.log(`Server: Signal forwarded to ${data.to} (socket: ${receiverData.socketId})`);
      
      // Send acknowledgment back to sender
      socket.emit('signal-delivered', { to: data.to });
    } else {
      console.error(`Server: User ${data.to} not found or disconnected for signaling`);
      socket.emit('signaling-error', { 
        message: `User ${data.to} not available for signaling`,
        targetEmail: data.to 
      });
    }
  });

  // Handle public key exchange
  socket.on('public-key', (data) => {
    console.log(`Server: Processing public key from ${data.from} to ${data.to}`);
    
    const receiverData = users.get(data.to);
    
    if (receiverData && receiverData.socket && receiverData.socket.connected) {
      receiverData.socket.emit('public-key', data);
      console.log(`Server: Public key forwarded to ${data.to} (socket: ${receiverData.socketId})`);
    } else {
      console.log(`Server: User ${data.to} not found for public key exchange`);
    }
  });

  // Handle connection status check
  socket.on('ping-user', (data) => {
    const userData = users.get(data.email);
    if (userData && userData.socket && userData.socket.connected) {
      socket.emit('user-online', { email: data.email, online: true });
    } else {
      socket.emit('user-online', { email: data.email, online: false });
    }
  });

  // Handle manual disconnection
  socket.on('leave', () => {
    const email = sockets.get(socket.id);
    if (email) {
      console.log(`Server: User ${email} manually left`);
      cleanupUser(socket.id, email);
    }
  });

  // Handle socket disconnection
  socket.on('disconnect', (reason) => {
    const email = sockets.get(socket.id);
    console.log(`Server: Socket ${socket.id} disconnected. Reason: ${reason}`);
    
    if (email) {
      console.log(`Server: Cleaning up disconnected user ${email}`);
      cleanupUser(socket.id, email);
    }
    
    console.log('Server: Remaining active users:', Array.from(users.keys()));
  });

  // Handle errors
  socket.on('error', (error) => {
    console.error(`Server: Socket error for ${socket.id}:`, error);
    const email = sockets.get(socket.id);
    if (email) {
      cleanupUser(socket.id, email);
    }
  });
});

// Periodic cleanup of stale connections
setInterval(() => {
  console.log('Server: Running periodic cleanup...');
  let cleanedUp = 0;
  
  for (const [email, userData] of users.entries()) {
    if (!userData.socket || !userData.socket.connected) {
      console.log(`Server: Cleaning up stale user ${email}`);
      users.delete(email);
      sockets.delete(userData.socketId);
      cleanedUp++;
    }
  }
  
  if (cleanedUp > 0) {
    console.log(`Server: Cleaned up ${cleanedUp} stale connections`);
    console.log('Server: Active users after cleanup:', Array.from(users.keys()));
  }
}, 30000); // Run every 30 seconds

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server: Signaling server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Server: Shutting down gracefully...');
  io.close(() => {
    server.close(() => {
      console.log('Server: Process terminated');
      process.exit(0);
    });
  });
});
