const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const cors = require("cors");
const siteURL =
  !process.env.NODE_ENV || process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : "https://insta-quiz.netlify.app";
const io = require("socket.io")(server, {
  cors: {
    origin: siteURL,
    methods: ["GET", "POST"],
    allowedHeaders: ["roomid", "iscreator"],
    credentials: true,
  },
});

const PORT = process.env.PORT || 3200;

app.use(cors());

app.get("/", (req, res) => {
  res.send("<p>Server running</p>");
});

io.use((socket, next) => {
  const username = socket.handshake.auth.userName;
  console.log("Username: ", username, " connecting");
  if (!username) {
    return next(new Error("invalid username"));
  }
  socket.username = username;
  next();
});

// {userId, userName, room}
const users = [];
const rooms = [];

io.on("connection", (socket) => {
  const roomName = socket.handshake.headers.roomid;
  let isCreator = socket.handshake.headers.iscreator;

  // If regular participant, check if given room exists, if it does not, disconnect the user
  if (isCreator === "false") {
    if (!rooms.includes(roomName)) {
      console.log("Room: ", roomName, "did not exist");
      socket.emit("no room", { msg: "No room exists" });
      socket.disconnect();
      return;
    }
    socket.join(roomName);
  } else {
    console.log("Is creator");
    socket.join(roomName);
  }

  // Add the current user, and his roomname if it's not already defined
  users.push({ userID: socket.id, username: socket.username, room: roomName });
  if (!rooms.includes(roomName)) {
    rooms.push(roomName);
  }

  // Send userlist upon a socket connection
  socket.emit("users", getUsersInRoom(users, roomName));

  // Notify existing users
  socket.to(roomName).emit("user connected", {
    userID: socket.id,
    username: socket.username,
    room: roomName,
  });

  // Starting quiz event
  socket.on("start quiz", (startObj) => {
    const { msg, status, room, question, questionCount } = startObj;
    console.log("Starting quiz");
    // Notify everyone in given room that the quiz has started (except the sender (creator))
    socket
      .to(room)
      .emit("quiz started", { msg, status, question, questionCount });
  });

  // Next question event
  socket.on("next question", (questionObj) => {
    // const {msg, status, room, question, currentIndex} = questionObj;
    const { room } = questionObj;
    console.log("Sending next question");
    // Send the next question to everyone in the room (except the sender (creator))
    socket.to(room).emit("get next question", questionObj);
  });

  // Recieve what user has answered
  socket.on("user answered", (userObj) => {
    const creator = getRoomCreator(users, userObj.room);
    if (creator) {
      console.log("User answered sent");
      io.to(creator.userID).emit("mark answered", { userId: userObj.userId });
    }
  });

  // Process the answer and record history
  socket.on("process answer", (answerObj) => {
    // console.log('Forwarding: ', answerObj);
    // Getting the correct room creator to send the answer to
    const creator = getRoomCreator(users, answerObj.room);
    if (creator) {
      io.to(creator.userID).emit("log answer", answerObj);
    }
  });

  // Forwarding scores
  socket.on("show scores", (scoreObj) => {
    // console.log('Recieved: ', scoreObj);
    // Send the scores to everyone besides the creator
    io.to(scoreObj.room).emit("get scores", scoreObj);
  });

  // Notify users on disconnection
  socket.on("disconnect", () => {
    socket.to(roomName).emit("user disconnected", socket.id);
    console.log(`${socket.username} has disconnected`);
    const found = users.findIndex((user) => user.userID === socket.id);
    if (found !== -1) {
      users.splice(found, 1);
    }
    // console.log('Users after dc: ', users);
  });
});

server.listen(PORT, () => {
  console.log("Listening on port: ", PORT);
});

const getUsersInRoom = (users, room) => {
  const filtered = users.filter((item) => item.room === room);
  return filtered;
};

const getRoomCreator = (users, room) => {
  const found = users.find(
    (user) => user.room === room && user.username === "creator"
  );
  return found;
};
