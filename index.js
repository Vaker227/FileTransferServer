const PORT = 3000;
const app = require("express")();
const httpServer = require("http").createServer(app);
const io = require("socket.io")(httpServer);

const router = require("./router");
router(app);

require("./socketio")(io);

httpServer.listen(PORT);
console.log(`Server is listening at http://localhost:${PORT}`);
