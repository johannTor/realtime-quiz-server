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

// {userId, userName, room}
const users = [];
const rooms = [];

io.on('connection', (socket) => {
  const roomName = socket.handshake.headers.roomid;
  console.log('Room: ', socket.handshake.headers.roomid);
  socket.join(roomName);
  // Get all connected users
  // for(let [id, socket] of io.of('/').sockets) {
  //   users.push({userID: id, username: socket.username, room: roomName}); // This sets all users room to the current room
  // }
  users.push({userID: socket.id, username: socket.username, room: roomName});
  if(!rooms.includes(roomName)) {
    rooms.push(roomName);
  }

  // TODO: BEFORE EMITING USERS, filter them out from the user array so that only current roomname users are sent out?
  // Todo: console log users on the frontend

  // Send userlist upon a socket connection
  socket.emit("users", getUsersInRoom(users, roomName));
  // Send userlist to all clients on every connections?
  // io.emit('users', users);

  // Notify existing users
  // socket.broadcast.emit('user connected', {userID: socket.id, username: socket.username});
  socket.to(roomName).emit('user connected', {userID: socket.id, username: socket.username, room: roomName});

  // Starting quiz event
  socket.on('start quiz', (startObj) => {
    const {msg, status, room, question, questionCount} = startObj;
    console.log('Starting quiz');
    // Notify everyone in given room that the quiz has started (except the sender (creator))
    socket.to(room).emit('quiz started', {msg, status, question, questionCount});
  });

  // Next question event
  socket.on('next question', (questionObj) => {
    // const {msg, status, room, question, currentIndex} = questionObj;
    const {room} = questionObj;
    console.log('Sending next question');
    // Send the next question to everyone in the room (except the sender (creator))
    socket.to(room).emit('get next question', questionObj);
  });

  // Recieve what user has answered
  socket.on('user answered', (userObj) => {
    const creator = getRoomCreator(users, userObj.room);
    if(creator) {
      console.log('User answered sent');
      io.to(creator.userID).emit('mark answered', {userId: userObj.userId});
    }
  });

  // Process the answer and record history
  socket.on('process answer', (answerObj) => {
    // console.log('Forwarding: ', answerObj); 
    // Getting the correct room creator to send the answer to
    const creator = getRoomCreator(users, answerObj.room);
    if(creator) {
      io.to(creator.userID).emit('log answer', answerObj);
    }
  });

  // Forwarding scores
  socket.on('show scores', (scoreObj) => {
    console.log('Recieved: ', scoreObj);
    // Send the scores to everyone besides the creator
    io.to(scoreObj.room).emit('get scores', scoreObj);
  }); 
  
  // Notify users on disconnection
  socket.on('disconnect', () => {
    socket.to(roomName).emit('user disconnected', socket.id);
    console.log(`${socket.username} has disconnected`);
    const found = users.findIndex((user) => user.userID === socket.id);
    if(found !== -1) {
      users.splice(found, 1);
    }
    // console.log('Users after dc: ', users);
  })
});

server.listen(PORT, () => {
  console.log('Listening on port: ', PORT);
});

const getUsersInRoom = (users, room) => {
  const filtered = users.filter((item) => item.room === room);
  return filtered;
};

const getRoomCreator = (users, room) => {
  const found = users.find((user) => user.room === room && user.username === 'creator');
  return found;
};