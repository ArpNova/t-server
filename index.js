const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "https://arpanstictactoe.vercel.app", 
    methods: ["GET", "POST"]
  }
});

const rooms = {}; // roomId: { players: {X, O}, board, currentPlayer }

io.on('connection', (socket) => {
  console.log('New client:', socket.id);

  // ✅ Create Room
  socket.on("createRoom", (roomId) => {
    if (rooms[roomId]) {
      socket.emit("roomExists");
      return;
    }

    rooms[roomId] = {
      players: {},
      board: Array(9).fill(null),
      currentPlayer: "X"
    };

    socket.join(roomId);
    rooms[roomId].players.X = socket.id;
    socket.data.symbol = "X";
    socket.data.roomId = roomId;

    socket.emit("init", {
      symbol: "X",
      board: rooms[roomId].board,
      currentPlayer: rooms[roomId].currentPlayer
    });
  });

  // ✅ Join Room
  socket.on("joinRoom", (roomId) => {
    const room = rooms[roomId];
    if (!room) {
      socket.emit("noRoom");
      return;
    }

    if (room.players.O) {
      socket.emit("full");
      return;
    }

    socket.join(roomId);
    room.players.O = socket.id;
    socket.data.symbol = "O";
    socket.data.roomId = roomId;

    socket.emit("init", {
      symbol: "O",
      board: room.board,
      currentPlayer: room.currentPlayer
    });
  });

  // ✅ Game Events
  socket.on('makeMove', ({ index, symbol }) => {
    const room = rooms[socket.data.roomId];
    if (!room || room.board[index] !== null || room.currentPlayer !== symbol) return;

    room.board[index] = symbol;
    room.currentPlayer = symbol === 'X' ? 'O' : 'X';

    io.to(socket.data.roomId).emit('updateBoard', {
      board: room.board,
      currentPlayer: room.currentPlayer
    });
  });

  socket.on('restart', () => {
    const room = rooms[socket.data.roomId];
    if (!room) return;
  
    room.board = Array(9).fill(null);
    room.currentPlayer = 'X';
  
    // Send custom restartGame to each player with their correct symbol
    const sockets = [room.players.X, room.players.O];
    sockets.forEach((socketId) => {
      const playerSymbol = socketId === room.players.X ? 'X' : 'O';
      io.to(socketId).emit('restartGame', {
        symbol: playerSymbol,
        board: room.board,
        currentPlayer: room.currentPlayer
      });
    });
  });
  

  socket.on('disconnect', () => {
    const room = rooms[socket.data.roomId];
    if (room) {
      if (room.players.X === socket.id) delete room.players.X;
      if (room.players.O === socket.id) delete room.players.O;

      room.board = Array(9).fill(null);
      room.currentPlayer = 'X';

      io.to(socket.data.roomId).emit('playerLeft');
    }
  });
});

server.listen(3000, () => {
  console.log('Server running on port 3000');
});
