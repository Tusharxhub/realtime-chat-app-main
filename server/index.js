import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import path from 'path';

import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, './.env') });

import { router as userManagerRouter } from './routes/user-manager.js';
import { router as loginLogoutRouter } from './routes/login-logout.js';
import { router as checkTokenRouter } from './routes/check-token.js';
import { router as addFriendRouter } from './routes/add-friend.js';
import { router as getFriendsListRouter } from './routes/get-friends-list.js';
import { verifyToken } from './common/token-manager.js';
import { getUserDetails } from './common/user-manager.js'; // Adjust the path as necessary

const app = express();
const server = http.createServer(app);

const FRONTEND_URL = process.env.FRONTEND_URL;
const PORT = process.env.PORT || 5000;

const io = new Server(server, {
  cors: {
    origin: [FRONTEND_URL],
    credentials: true
  }
});

app.use(express.json());
app.use((_, res, next) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', FRONTEND_URL);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

io.use(async (socket, next) => {
  let allCookies = socket.handshake.headers.cookie;
  if (!allCookies) {
    return next(new Error('Session expired'));
  }

  let token;
  allCookies.split(/;\s*/).forEach(cookieStr => {
    const [name, value] = cookieStr.split('=');
    if (name === 'token') token = value;
  });

  if (!token) {
    return next(new Error('Session expired'));
  }

  try {
    const decodedToken = verifyToken(token);
    socket.request.credentials = { username: decodedToken.username };
    next();
  } catch (err) {
    next(new Error(err.message));
  }
});

let activeRooms = {};
let lastSeenRecords = {};

io.on('connection', (socket) => {
  const username = socket.request.credentials.username;
  
  socket.join(username);
  activeRooms[username] = true;
  delete lastSeenRecords[username];

  console.log('A user connected:', username);
  console.log('Updated activeRooms/lastSeen:', activeRooms, lastSeenRecords);

  let broadcastDependencies = { socket, activeRooms };
  let payload = { username, eventName: 'showMeOnline' };
  _broadcastToFriends(broadcastDependencies, payload);

  socket.on('msg', (msgObj, callback) => {
    const receiver = msgObj.receiver;
    socket.to(receiver).emit('msg', msgObj);
    callback('res from server');
  });

  socket.on('isOnline', (friend, callback) => {
    let res = {
      isOnline: activeRooms[friend] || false,
      lastSeen: lastSeenRecords[friend] || false
    };
    callback(res);
  });

  socket.on('disconnect', () => {
    console.log('USER DISCONNECTED:', username);
    delete activeRooms[username];
    lastSeenRecords[username] = new Date();

    console.log('Updated activeRooms/lastSeen:', activeRooms, lastSeenRecords);

    let broadcastDependencies = { socket, activeRooms, lastSeenRecords };
    let payload = { username, eventName: 'showMeOffline' };
    _broadcastToFriends(broadcastDependencies, payload);
  });
});

function _broadcastToFriends(broadcastDependencies, payload) {
  const { socket, activeRooms, lastSeenRecords } = broadcastDependencies;
  const { username, eventName } = payload;

  if (!socket) {
    console.log('INTERNAL ERR: Missing socket for broadcast');
    return;
  }

  getUserDetails(username)
    .then(userDetails => {
      userDetails.friends.forEach(friend => {
        if (Object.prototype.hasOwnProperty.call(activeRooms, friend)) {
          if (eventName === 'showMeOnline') {
            socket.to(friend).emit(eventName, username);
          } else if (eventName === 'showMeOffline') {
            let data = { friend: username, lastSeen: lastSeenRecords[username] };
            socket.to(friend).emit(eventName, data);
          }
        }
      });
    })
    .catch(err => {
      console.log(err);
    });
}

app.use('/', userManagerRouter);
app.use('/', loginLogoutRouter);
app.use('/', checkTokenRouter);
app.use('/', addFriendRouter);
app.use('/', getFriendsListRouter);

app.get('/', (_, res) => {
  res.send('Server running successfully');
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

export default server;
