import cors from "cors";
import express from "express";
import { generate, count } from "random-words";
import http from "http";
import { Server } from "socket.io";
import { mongoose } from "mongoose";
import bodyParser from "body-parser";
import { MongoClient, ServerApiVersion } from "mongodb";
import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";

const secretKey = "ganeshchat";

// Mango db connection

const password = encodeURIComponent("gKORA7AcdsJr9ldf");
const uri = `mongodb+srv://danuriganesh:${password}@ganeshchat.y8wz5mr.mongodb.net/`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function connectToDatabase() {
  try {
    await client.connect();
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }
}
connectToDatabase();

// API Server
const app = express();
const api_port = 8001;

const corsOptions = {
  origin: "*",
  methods: ["GET", "POST"],
  optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
};

app.use(cors(corsOptions));
app.use(bodyParser.json());

app.post("/search", async (req, res) => {
  const { searchTerm } = req.body || {};
  if (searchTerm) {
    const database = client.db("ganeshchat");
    const collection = database.collection("users");

    const query = { username: { $regex: new RegExp(searchTerm, "i") } };
    const projection = { _id: 0, username: 1 };

    const searchResults = await collection.find(query, projection).toArray();

    const modified = searchResults.map((result) => {
      return { id: uuidv4(), username: result.username };
    });
    res.send(modified);
  }
});

app.post("/addFriends", async (req, res) => {
  const { from, to } = req.body || {};
  if (from && to) {
    const database = client.db("ganeshchat");
    const collection = database.collection("users");

    const addFriends = await collection.updateOne(
      { username: from }, // Assuming you're using "_id" as the user identifier
      { $addToSet: { friends: to } }
    );

    res.send(addFriends.acknowledged);
  } else {
    // res.send()
  }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body || {};
  if (username && password) {
    const database = client.db("ganeshchat");
    const collection = database.collection("users");

    const hostoryCollection = database.collection("chatHistory");

    const query = { username };
    const projection = { _id: 1, username: 1, password: 1 }; // Only retrieve username and password

    const user = await collection.findOne(query);

    const chatData = await hostoryCollection
      .find({
        $or: [{ sender: username }, { receiver: username }],
      })
      .toArray((err, documents) => {
        if (err) {
          console.error("Error retrieving data:", err);
        } else {
          console.log("Matching documents:", documents);
        }
      });

    const { friends } = user || {};

    let updatedChats = [];

    if (friends?.length && chatData?.length) {
      console.log(true);
      updatedChats = friends.map((username) => {
        const filteredResults = chatData.filter(
          (chat) => chat.receiver === username || chat.sender === username
        );

        console.log({ filteredResults });
        return { name: username, chats: filteredResults };
      });
    }

    if (user) {
      if (user.password === password) {
        res.json({
          message: "Login successfull",
          user: { ...user, chats: updatedChats, password: uuidv4() },
          jwtToken: jwt.sign({ userId: user._id }, secretKey, {
            expiresIn: "1h",
          }),
          status: 1,
        });
      } else {
        res.json({ message: "Password is incorrect", status: 0 });
      }
    } else {
      res.json({ message: "Invalid username" });
    }
  }
});

app.post("/sign-up", async (req, res) => {
  const { username, password } = req.body || {};
  try {
    const database = client.db("ganeshchat");
    const collection = database.collection("users");

    // check if username alreday exits

    const userData = await collection.find({ username }).toArray();

    if (userData.data) {
      res.send({
        message: "Username already exists. username should be unique",
        status: 0,
      });
    } else {
      const user = {
        username,
        password,
        friends: [],
      };
      const result = await collection.insertOne(user);
      if (result.acknowledged) {
        res.json({
          message: "Registered succesfully",
          user: { ...user, password: uuidv4() },
          jwtToken: jwt.sign({ userId: result._id }, secretKey, {
            expiresIn: "1h",
          }),
          status: 1,
        });
      } else {
        res.json({
          message: "there was error. please try again",
          status: 0,
        });
      }
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "An error occurred" });
  }
});

// Socket Connection

const server = http.createServer(app);
const socket_port = 8000;
const activeUsers = {};

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("A new client connected");

  socket.on("join", (username) => {
    activeUsers[username] = socket; // Associate username with socket
  });

  socket.on("disconnect", () => {
    // Remove the socket entry when a user disconnects
    const disconnectedUser = Object.keys(activeUsers).find(
      (username) => activeUsers[username] === socket
    );
    if (disconnectedUser) {
      delete activeUsers[disconnectedUser];
    }
  });

  socket.on("sendMessage", async (data) => {
    const { sender, receiver, content } = data;
    const recipientSocket = activeUsers[receiver];
    try {
      const database = client.db("ganeshchat");
      const collection = database.collection("chatHistory");

      // check if username alreday exits

      const result = await collection.insertOne(data);
    } catch {}
    if (recipientSocket) {
      recipientSocket.emit("receiveMessage", data);
    }
  });
});

app.listen(process.env.PORT || api_port, () => {
  console.log(`API Server is runiing on ${api_port}`);
});

server.listen(socket_port, () => {
  console.log(`Socket connection is running on ${socket_port}`);
});
