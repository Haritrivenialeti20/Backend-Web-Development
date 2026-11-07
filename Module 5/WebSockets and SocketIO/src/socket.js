'use strict';

const { Server } = require('socket.io');

function initSocket(httpServer) {
  // Create a Socket.IO server bound to the existing HTTP server.
  const io = new Server(httpServer, { cors: { origin: '*' } });

  io.on('connection', (socket) => {
    console.log(`[+] connected: ${socket.id}`);

    // Join the room requested by the client.
    socket.on('joinRoom', (data) => {
      socket.join(data.room);
    });

    // Leave the room requested by the client.
    socket.on('leaveRoom', (data) => {
      socket.leave(data.room);
    });

    // Broadcast a new comment only to sockets in its room, including sender.
    socket.on('newComment', (data) => {
      io.to(data.room).emit('commentAdded', data);
    });

    // Log when the client disconnects and include Socket.IO's disconnect reason.
    socket.on('disconnect', (reason) => {
      console.log(`[-] disconnected: ${socket.id} (${reason})`);
    });
  });

  return io;
}

module.exports = { initSocket };
