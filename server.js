const express = require("express");
const app = express();
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const { VM } = require("vm2"); // Make sure to install this: npm install vm2
const ACTIONS = require("./src/Actions");

const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("build"));
app.use((req, res, next) => {
  res.sendFile(path.join(__dirname, "build", "index.html"));
});

const userSocketMap = {};
function getAllConnectedClients(roomId) {
  // Map
  return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map(
    (socketId) => {
      return {
        socketId,
        username: userSocketMap[socketId],
      };
    }
  );
}

io.on("connection", (socket) => {
  console.log("socket connected", socket.id);

  socket.on(ACTIONS.JOIN, ({ roomId, username }) => {
    userSocketMap[socket.id] = username;
    socket.join(roomId);
    const clients = getAllConnectedClients(roomId);
    clients.forEach(({ socketId }) => {
      io.to(socketId).emit(ACTIONS.JOINED, {
        clients,
        username,
        socketId: socket.id,
      });
    });
  });

  socket.on(ACTIONS.CODE_CHANGE, ({ roomId, code }) => {
    socket.in(roomId).emit(ACTIONS.CODE_CHANGE, { code });
  });

  socket.on(ACTIONS.SYNC_CODE, ({ socketId, code }) => {
    io.to(socketId).emit(ACTIONS.CODE_CHANGE, { code });
  });

  socket.on(ACTIONS.RUN_CODE, ({ roomId, code }) => {
    try {
      let output = "";
      const vm = new VM({
        timeout: 5000,
        sandbox: {
          console: {
            log: (...args) => {
              output +=
                args
                  .map((arg) =>
                    typeof arg === "object"
                      ? JSON.stringify(arg, null, 2)
                      : String(arg)
                  )
                  .join(" ") + "\n";
            },
            error: (...args) => {
              output +=
                "ERROR: " +
                args
                  .map((arg) =>
                    typeof arg === "object"
                      ? JSON.stringify(arg, null, 2)
                      : String(arg)
                  )
                  .join(" ") +
                "\n";
            },
            warn: (...args) => {
              output +=
                "WARNING: " +
                args
                  .map((arg) =>
                    typeof arg === "object"
                      ? JSON.stringify(arg, null, 2)
                      : String(arg)
                  )
                  .join(" ") +
                "\n";
            },
          },
        },
      });

      vm.run(code);

      // Send output to all clients in the room
      io.in(roomId).emit(ACTIONS.CODE_OUTPUT, {
        output: output || "No output",
      });
    } catch (error) {
      io.in(roomId).emit(ACTIONS.CODE_OUTPUT, {
        output: `Error: ${error.message}`,
      });
    }
  });

  socket.on("disconnecting", () => {
    const rooms = [...socket.rooms];
    rooms.forEach((roomId) => {
      socket.in(roomId).emit(ACTIONS.DISCONNECTED, {
        socketId: socket.id,
        username: userSocketMap[socket.id],
      });
    });
    delete userSocketMap[socket.id];
    socket.leave();
  });
});

const PORT = process.env.PORT || 5500;
server.listen(PORT, () => console.log(`Listening on port ${PORT}`));
