// ✅ server/index.js (Node.js + socket.io backend)

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

  socket.on('joinRoom', (roomId) => {
    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = {
        players: {},
        board: Array(9).fill(null),
        currentPlayer: 'X'
      };
    }

    const room = rooms[roomId];
    let symbol;
    if (!room.players.X) {
      room.players.X = socket.id;
      symbol = 'X';
    } else if (!room.players.O) {
      room.players.O = socket.id;
      symbol = 'O';
    } else {
      socket.emit('full');
      return;
    }

    socket.data.symbol = symbol;
    socket.data.roomId = roomId;

    socket.emit('init', {
      symbol,
      board: room.board,
      currentPlayer: room.currentPlayer
    });

    socket.on('makeMove', ({ index, symbol }) => {
      const r = rooms[socket.data.roomId];
      if (!r || r.board[index] !== null || r.currentPlayer !== symbol) return;

      r.board[index] = symbol;
      r.currentPlayer = symbol === 'X' ? 'O' : 'X';

      io.to(socket.data.roomId).emit('updateBoard', {
        board: r.board,
        currentPlayer: r.currentPlayer
      });
    });

    socket.on('restart', () => {
      const r = rooms[socket.data.roomId];
      if (!r) return;

      r.board = Array(9).fill(null);
      r.currentPlayer = 'X';

      io.to(socket.data.roomId).emit('updateBoard', {
        board: r.board,
        currentPlayer: r.currentPlayer
      });
    });

    socket.on('disconnect', () => {
      const r = rooms[socket.data.roomId];
      if (r) {
        if (r.players.X === socket.id) delete r.players.X;
        if (r.players.O === socket.id) delete r.players.O;

        r.board = Array(9).fill(null);
        r.currentPlayer = 'X';
        io.to(socket.data.roomId).emit('playerLeft');
      }
    });
  });
});

server.listen(3000, () => {
  console.log('Server running on port 3000');
});
