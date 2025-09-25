const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  }
});

const users = {}; // Map to store userId -> socketId

io.on('connection', (socket) => {
  console.log(`Server: a user connected with socket ID ${socket.id}`);

  socket.on('register-user', (userId) => {
    users[userId] = socket.id;
    console.log(`Server: User ${userId} registered with socket ID ${socket.id}`);
  });

  socket.on('disconnect', (reason) => {
    for (const userId in users) {
      if (users[userId] === socket.id) {
        delete users[userId];
        console.log(`Server: User ${userId} disconnected (reason: ${reason})`);
        break;
      }
    }
    console.log(`Server: user disconnected with socket ID ${socket.id} (reason: ${reason})`);
  });

  socket.on('send-invite', (data) => {
    const targetSocketId = users[data.to];
    if (targetSocketId) {
      io.to(targetSocketId).emit('invite', data.from);
      console.log(`Invite sent from ${data.from} to ${data.to}`);
    } else {
      console.log(`User ${data.to} not found to send invite.`);
    }
  });

  socket.on('accept-invite', (data) => {
    const targetSocketId = users[data.to];
    if (targetSocketId) {
      io.to(targetSocketId).emit('invite-accepted', data.from);
      console.log(`Invite accepted by ${data.from} from ${data.to}`);
    } else {
      console.log(`User ${data.to} not found to accept invite.`);
    }
  });

  socket.on('decline-invite', (data) => {
    const targetSocketId = users[data.to];
    if (targetSocketId) {
      io.to(targetSocketId).emit('invite-declined', data.from);
      console.log(`Invite declined by ${data.from} from ${data.to}`);
    } else {
      console.log(`User ${data.to} not found to decline invite.`);
    }
  });

  socket.on('signal', (data) => {
    const targetSocketId = users[data.to];
    if (targetSocketId) {
      console.log(`Server: Signaling from ${data.from || socket.id} to ${data.to} (socket: ${targetSocketId})`);
      io.to(targetSocketId).emit('signal', { from: data.from || socket.id, signal: data.signal });
    } else {
      console.log(`Server: User ${data.to} not found for signaling.`);
    }
  });

  socket.on('public-key', (data) => {
    const targetSocketId = users[data.to];
    if (targetSocketId) {
      console.log(`Server: Public key from ${data.from || socket.id} to ${data.to} (socket: ${targetSocketId})`);
      io.to(targetSocketId).emit('public-key', { from: data.from || socket.id, publicKey: data.publicKey });
    } else {
      console.log(`Server: User ${data.to} not found for public key exchange.`);
    }
  });
});

server.listen(3001, () => {
  console.log('listening on *:3001');
});
