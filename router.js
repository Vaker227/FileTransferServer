module.exports = (app) => {
  app.get("/", (req, res) => {
    res.send("home");
  });
  app.route("/get-public-ip").get((req, res) => {
    let ip = (req.connection && req.connection.remoteAddress) || "";
    if (req.headers["x-forwarded-for"]) {
      ip = req.headers["x-forwarded-for"];
    }
    let port = (req.connection && req.connection.remotePort) || "";
    res.json({ ip, port });
  });
};
