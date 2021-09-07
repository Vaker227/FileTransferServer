const clients = {};
const regexPrivateRoom = /^.{20}:to:.{20}$/;

module.exports = function (io) {
  roomEvents(io);
  io.on("connection", (socket) => {
    socket.on("disconnect", (reason) => {
      console.log(reason);
      delete clients[socket.id];
      updateClientsList(io);
    });
    socket.on("data-from-client", (data) => {
      clients[socket.id] = data;
      socket.join("public-room");
    });
    socket.on("request-private-connection", (targetSocketID, requestCB) => {
      if (socket.rooms.size >= 3) {
        let roomID;
        socket.rooms.forEach((value) => {
          if (regexPrivateRoom.test(value)) {
            roomID = value;
          }
        });
        requestCB("already in connection: " + roomID);
        return;
      }
      const targetSocket = io.of("/").sockets.get(targetSocketID);
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
        targetSocket.once(
          "response-private-connection",
          (requestedSocketID, targetSocketId, receiveCB) => {
            if (!requestedSocketID) {
              return;
            }
            receiveCB("timeout");
          }
        );
        requestCB("timeout");
      }, 6000);
    });
    privateMessage(socket);
  });
};

function roomEvents(io) {
  io.of("/").adapter.on("join-room", (room, id) => {
    console.log(io.of("/").adapter.rooms);
    if (room === "public-room") {
      updateClientsList(io);
    }
  });
  io.of("/").adapter.on("leave-room", (room, id) => {
    // exit last client when a connected client disconnect
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
    return;
  }
  io.of("/").sockets.get(requestID).leave(roomID);
  io.of("/").sockets.get(targetID).leave(roomID);
}

function privateMessage(socket) {
  socket.on("private-send-message", (message, roomID) => {
    socket.to(roomID).emit("private-send-message", message);
  });
}
