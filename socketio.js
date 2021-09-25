const clients = {};
const regexPrivateRoom = /^.{20}:to:.{20}$/;

module.exports = function (io) {
  roomEvents(io);
  io.on("connection", (socket) => {
    socket.on("disconnect", (reason) => {
      console.log(reason); // transport
      delete clients[socket.id];
      updateClientsList(io);
    });
    socket.on("data-from-client", (data) => {
      clients[socket.id] = data;
      socket.join("public-room");
    });
    // implement private connection
    socket.on("request-private-connection", (targetSocketID, requestCB) => {
      const targetSocket = io.of("/").sockets.get(targetSocketID);
      if (targetSocket.rooms.size >= 3) {
        requestCB("busy");
        return;
      }
      // send request to target
      io.to(targetSocketID).emit("request-private-connection", socket.id);
      // handle reponse from target
      targetSocket.once(
        "response-private-connection",
        (requestedSocketID, targetSocketId, receiveCB) => {
          clearTimeout(handleTimeout);
          // requestedSocketID == null mean reject
          if (!requestedSocketID) {
            requestCB("reject");
            return;
          }
          const privateRoomID = `${requestedSocketID}:to:${targetSocketId}`;
          configPrivateConnection(
            io,
            privateRoomID,
            requestedSocketID,
            targetSocketID
          );
          receiveCB(`accept: ${privateRoomID}`);
          requestCB(`accept: ${privateRoomID}`);
        }
      );
      // handle if target timeout
      let handleTimeout = setTimeout(() => {
        targetSocket.removeAllListeners("response-private-connection");
        requestCB("timeout");
      }, 6000);
    });
    // all listener when in private room
    privateRoom(io, socket);
  });
};

function roomEvents(io) {
  io.of("/").adapter.on("join-room", (room, id) => {
    // console.log(io.of("/").adapter.rooms);
    if (room === "public-room") {
      updateClientsList(io);
    }
  });
  io.of("/").adapter.on("leave-room", (room, id) => {
    // exit last client when a connected client disconnect from server
    if (regexPrivateRoom.test(room)) {
      const lastClientID = io
        .of("/")
        .adapter.rooms.get(room)
        .values()
        .next().value;

      if (lastClientID) {
        const lastClient = io.of("/").sockets.get(lastClientID);
        lastClient.leave(room);
        lastClient.emit("target-leave-private-connection");
      }
    }
    if (room === "public-room") {
      updateClientsList(io);
    }
  });
}

function updateClientsList(io) {
  io.to("public-room").emit("update-clients-list", clients);
}

function configPrivateConnection(
  io,
  roomID,
  requestID,
  targetID,
  isJoin = true
) {
  if (isJoin) {
    io.of("/").sockets.get(requestID).join(roomID);
    io.of("/").sockets.get(targetID).join(roomID);
    io.to(requestID).emit("update-target-user-data", clients[targetID]);
    io.to(targetID).emit("update-target-user-data", clients[requestID]);
    return;
  }
  // leave room
  io.to(roomID).emit("target-leave-private-connection");
  io.of("/").sockets.get(requestID).leave(roomID);
  io.of("/").sockets.get(targetID).leave(roomID);
}

function privateRoom(io, socket) {
  socket.on("disconnect-room", (roomID, cb) => {
    socket.leave(roomID);
    cb("success");
  });
  socket.on("private-send-message", (data, roomID) => {
    io.to(roomID).emit(
      "private-send-message",
      Object.assign(data, { user: clients[socket.id].name })
    );
  });
  socket.on("private-exchange-file", (data, roomID) => {
    socket.to(roomID).emit("private-exchange-file", data);
  });
  // webrtc
  socket.on("signal-data", (data, roomID) => {
    socket.to(roomID).emit("signal-data", data);
  });
}
