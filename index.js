const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "https://arpanstictactoe.vercel.app", //  No trailing slash
    methods: ["GET", "POST"]
  }
});

const rooms = {}; // roomId: { players: {X, O}, board, currentPlayer, lastStarter }

io.on('connection', (socket) => {
  console.log('New client:', socket.id);

  //  Create Room
  socket.on("createRoom", (roomId) => {
    if (rooms[roomId]) {
      socket.emit("roomExists");
      return;
    }

    rooms[roomId] = {
      players: {},
      board: Array(9).fill(null),
      currentPlayer: "X",
      lastStarter: "O" // So X starts first time
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

  //  Join Room
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

    // Send both players their own symbol + common board state
    const sockets = [room.players.X, room.players.O];
    sockets.forEach((socketId) => {
      const playerSymbol = socketId === room.players.X ? 'X' : 'O';
      io.to(socketId).emit("init", {
        symbol: playerSymbol,
        board: room.board,
        currentPlayer: room.currentPlayer
      });
    });

  });

  //  Game Logic
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

  //  Restart with alternating starter
  socket.on('restart', () => {
    const room = rooms[socket.data.roomId];
    if (!room) return;

    const last = room.lastStarter || 'X';
    const nextStarter = last === 'X' ? 'O' : 'X';
    room.lastStarter = nextStarter;

    room.board = Array(9).fill(null);
    room.currentPlayer = nextStarter;

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

  //  Disconnect
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
