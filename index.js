const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const io = require('socket.io')(server, {
  cors: {
    origin: 'http://localhost:3000',
  }
});

const PORT = 3200;
const roomName = 'theRoom';

app.get('/', (req, res) => {
  res.send('<p>Server running</p>');
});

io.use((socket, next) => {
  const username = socket.handshake.auth.userName;
  console.log('Username: ', username, ' connecting');
  if(!username) {
    return next(new Error('invalid username'));
  }
  socket.username = username;
  next();
});

const users = [];

io.on('connection', (socket) => {
  const roomName = socket.handshake.headers.roomid;
  console.log('Room: ', socket.handshake.headers.roomid);
  socket.join(roomName);
  // Get all connected users
  // for(let [id, socket] of io.of('/').sockets) {
  //   users.push({userID: id, username: socket.username, room: roomName}); // This sets all users room to the current room
  // }
  
  users.push({userID: socket.id, username: socket.username, room: roomName});

  // TODO: BEFORE EMITING USERS, filter them out from the user array so that only current roomname users are sent out?
  // Todo: console log users on the frontend

  // Send userlist upon a socket connection
  socket.emit("users", getUsersInRoom(users, roomName));
  // Send userlist to all clients on every connections?
  // io.emit('users', users);

  // Notify existing users
  // socket.broadcast.emit('user connected', {userID: socket.id, username: socket.username});
  socket.to(roomName).emit('user connected', {userID: socket.id, username: socket.username, room: roomName});

  socket.on('start quiz', (startObj) => {
    console.log('Startobj: ', startObj);
  });
  
  // Notify users on disconnection
  socket.on('disconnect', () => {
    socket.to(roomName).emit('user disconnected', socket.id);
    console.log(`${socket.username} has disconnected`);
    const found = users.findIndex((user) => user.userID === socket.id);
    if(found !== -1) {
      users.splice(found, 1);
    }
    console.log('Users after dc: ', users);
  })
});

server.listen(PORT, () => {
  console.log('Listening on port: ', PORT);
});

const getUsersInRoom = (users, room) => {
  const filtered = users.filter((item) => item.room === room);
  return filtered;
};