var path = require('path');
var http = require('http');
var express = require('express');
var socketio = require('socket.io');
var moment = require('moment');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

// maps socketID to socket object
const sockets = {};
// stores user information
const users = [];
// stores room information
const rooms = [];

/**
 *  Application Bot
 */
const bot = {
    id: 0,
    name: "ChatApp Bot",
    room: "Universal"
}

/**
 * Commands that the Chatbot understands
 */
const botCommands = ["/help", "/users", "/users [username]", "/getRooms"];

/**
 *  Universal Room
 */
const universal = {
    name: "Universal",
    passwordProtected: false,
    password: "",
    owner: null,
    ownerName: bot.name,
    editors: [],
    bannedUsers: []
}

users.push(bot);
rooms.push(universal);

// Sets static folder
app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', socket => {

    // Adds socket reference to object mapping socketID to socket object
    console.log("New Connection!");
    sockets[socket.id] = socket;

    // Welcomes current user
    socket.emit('message', formatMessageResponse(bot.name, `Welcome to ChatApp!<div>To learn how to use addition features dm me '${botCommands[0]}' </div>`));

    // Creates new user
    socket.on('newUser', (data) => {
        var user = {
            id: socket.id,
            name: data.name,
            room: data.room
        };
        users.push(user);

        socket.join(user.room);

        socket.broadcast.to(user.room).emit('message', formatMessageResponse(bot.name, `${user.name} has joined the chat`));

        io.to(user.room).emit('roomUsers', {
            room: user.room,
            users: getRoomUsers(user.room)
        });

        socket.emit('updateRooms', {
            rooms: rooms
        })

    });

    /**
     * Process's user's request to create new room
     */
    socket.on('newRoom', ({ name, passwordProtected, password }) => {

        // checks to room with the same name does not already exist
        var index = rooms.findIndex(room => name == room.name);
        if (index == -1) {
            const user = getCurrentUser(socket.id);
            const room = {
                name: name,
                passwordProtected: passwordProtected,
                password: password,
                owner: socket.id,
                ownerName: user.name,
                editors: [],
                bannedUsers: []
            }
            rooms.push(room);
            joinRoom(socket, room.name, "");
            io.emit('updateRooms', {
                rooms: rooms
            })
            io.to(user.room).emit('message', formatMessageResponse(bot.name, `Welcome to your new room, ${user.name}!`));
        }
        else {
            socket.emit('errorMessage', 'A room with the same name already exists!');
        }
    });

    /**
     *  Process users request to join room, emits response
     */
    socket.on('joinRoomRequest', ({ name, passwordProtected }) => {
        if (rooms[getIndexOfRoom(name)].bannedUsers.includes(socket.id)) {
            socket.emit('errorMessage', 'You have been banned from that room!');
        }
        else if (getCurrentUser(socket.id).room == name) {
            socket.emit('errorMessage', 'You are currently in that room');
        }
        else {
            if (passwordProtected == "true") {
                socket.emit('joinRoomResponse', name);
            }
            else {
                joinRoom(socket, name, "");
                socket.emit('joinRoomResponse', 200);
            }
        }
    });

    /**
     * Emits response based on whether password is valid
     */
    socket.on('passwordResponse', (data) => {
        if (data.password == getRoomPassword(data.name)) {
            joinRoom(socket, data.name, "");
        }
        else {
            socket.emit('errorMessage', 'Incorrect Password!');
        }
    });

    /**
     * Moves socket to new room
     * 
     * @param {socket} socket socket being acted on
     * @param {string} newRoom room that socket is being switched to
     * @param {string} action identifies the action on which join room is being called ('ban', 'kick', etc.)
     */
    function joinRoom(socket, newRoom, action) {

        var user = getCurrentUser(socket.id);
        var formerRoom = user.room;
        // Updates users current room and joins new room / leaves old room
        user.room = newRoom;
        socket.join(newRoom);
        socket.leave(formerRoom);

        if (action == "kicked" || action == "banned") {
            // Broadcasts to old room that user has left and updates members of former room
            socket.broadcast.to(formerRoom).emit('message', formatMessageResponse(bot.name, `${user.name} has been ` + action + ` from the room`));
            socket.emit('message', formatMessageResponse(bot.name, "You were " + action + " from " + formerRoom));
        }
        else {
            // Broadcasts to old room that user has left and updates members of former room
            socket.broadcast.to(formerRoom).emit('message', formatMessageResponse(bot.name, `${user.name} has left the room`));
            if (action == "owner-left") {
                socket.emit('message', formatMessageResponse(bot.name, 'You have moved to the \'Universal\' room'));
            }
            else {
                socket.emit('message', formatMessageResponse(bot.name, 'You have joined: ' + newRoom));
            }
        }

        // Refreshes room data in both the new and former rooms
        roomDataToFrontEnd(formerRoom);
        roomDataToFrontEnd(newRoom);

        // Emits whether user has any privileges in the room they are joining
        var owner = isRoomOwner(socket.id, newRoom);
        var editor = isRoomEditor(socket.id, newRoom);
        grantPrivileges(socket, owner, editor);

        // Broadcasts to new room that user has joined
        socket.broadcast.to(newRoom).emit('message', formatMessageResponse(bot.name, `${user.name} has joined the chat`))
    }

    /**
     * Emits user's privileges to the socket passed
     */
    function grantPrivileges(socket, isOwner, isEditor) {
        socket.emit('ownerPrivileges', {
            isOwner: isOwner,
            isEditor: isEditor
        });
    }

    /**
     * Emits room and users data to front end
     */
    function roomDataToFrontEnd(roomName) {
        io.to(roomName).emit('roomUsers', {
            room: roomName,
            users: getRoomUsers(roomName)
        })
    }

    /**
     * Emits direct message to sender and receiver
     */
    socket.on('dmRequest', (data) => {
        if (data.receiver == data.sender) {
            socket.emit('errorMessage', 'You cannot dm yourself!');
        }
        else if (data.receiver == bot.name) {
            // Process direct messages to the application's ChatBot
            var response = "";
            if (data.message == "hello" || data.message == "hi" || data.message == "hey" || data.message == "yo") {
                response = "hi there!";
            }
            else if (data.message == "/help") {
                response = "<div> DM me any of the following commands...</div><div>";
                var list = "<ul>"
                botCommands.forEach(command => {
                    list += `<li>${command}</li>`
                })
                list += "</ul>";
                response += list;
                response += "</div>";
            }
            else if (data.message.split(' ')[0] == "/users") {
                var arr = data.message.split(' ');
                if (arr.length == 1) {
                    var count = 0;
                    var list = "<ol>"
                    users.forEach(user => {
                        list += `<li>${user.name}</li>`
                        ++count;
                    });
                    list += "</ol>";
                    response += list;
                    response += "<div>There are " + count + " total users currently using the app</div>";
                }
                else if (arr.length == 2) {
                    var username = arr[1];
                    var userObject = getCurrentUser(getUserID(username));
                    console.log(userObject);
                    if (userObject != -1) {
                        var id = userObject.id;
                        var name = userObject.name;
                        var room = userObject.room;
                        response = `<div><ul><li>ID: ${id}</li><li>Name: ${name}</li><li>Room: ${room}</li></ul></div>`;
                    }
                    else {
                        response = 'User with username does not exist';
                    }
                }
                else {
                    response = "Too many arguments passed!";
                }
            }
            else if (data.message == "/getRooms") {
                var count = 0;
                var list = "<ol>"
                users.forEach(user => {
                    list += `<li>User: ${user.name} - ${user.room}</li>`
                    ++count;
                });
                list += "</ol>";
                response += list;
            }
            else if (data.message == "thank you" || data.message == "thanks" || data.message == "thx") {
                response = "you got it!";
            }
            else if (data.message == "bye") {
                response = "cya!";
            }
            else {
                response = "Sorry, I do not understand the command";
            }
            socket.emit('message', formatMessageResponse(data.sender, "DM to Chatbot: " + data.message, 'dm'))
            socket.emit('message', formatMessageResponse(bot.name, response, 'dm'));
        }
        else {
            var senderID = getUserID(data.sender);
            var receiverID = getUserID(data.receiver);
            io.to(senderID).emit('message', formatMessageResponse(data.sender, "Direct Message to " + data.receiver + " : " + data.message, "dm"));
            io.to(receiverID).emit('message', formatMessageResponse(data.sender, "Direct Message : " + data.message, "dm"));
        }
    });

    /**
     * Kicks user from current room and moves them to the 'Universal' Room
     */
    socket.on('kickRequest', (data) => {
        var user = getCurrentUser(getUserID(data.victim));
        if (isRoomOwner(user.id, user.room)) {
            socket.emit('errorMessage', 'You cannot kick the owner from their room!');
        }
        else {
            var victimSocket = sockets[user.id];
            joinRoom(victimSocket, 'Universal', "kicked");
        }
    });

    /**
     * Bans/Removes users from current room and moves them to the 'Universal' Room
     */
    socket.on('banRequest', (data) => {
        var user = getCurrentUser(getUserID(data.victim));
        if (isRoomOwner(user.id, user.room)) {
            socket.emit('errorMessage', 'You cannot kick the owner from their room!');
        }
        else {
            rooms[getIndexOfRoom(user.room)].bannedUsers.push(user.id);
            var victimSocket = sockets[user.id];
            joinRoom(victimSocket, 'Universal', "banned");
        }
    });

    /**
     * Grant's privileges to user specified in data object passed
     */
    socket.on('grantPrivRequest', (data) => {
        var user = getCurrentUser(getUserID(data.user));
        var admin = getCurrentUser(socket.id);
        rooms[getIndexOfRoom(user.room)].editors.push(user.id);
        var userSocket = sockets[user.id];

        socket.emit('message', formatMessageResponse(bot.name, `You have given ${user.name} editor privileges!`))
        userSocket.emit('message', formatMessageResponse(bot.name, 'You have been given editor access by ' + admin.name));

        grantPrivileges(userSocket, isOwner = false, isEditor = true);

    })

    // Emits when user disconnects
    socket.on('disconnect', () => {
        console.log("Disconnection!");
        var user = userLeave(socket.id);
        if (user) {
            io.to(user.room).emit('message', formatMessageResponse(bot.name, `${user.name} has left the chat`));
            io.to(user.room).emit('roomUsers', {
                room: user.room,
                users: getRoomUsers(user.room)
            });
            var deleteRooms = getUsersRooms(socket.id);
            for (r in deleteRooms) {
                deleteRoom(deleteRooms[r].name);
            }
            io.emit('updateRooms', {
                rooms: rooms
            })
        }
    });

    /**
     *  Deletes room name passed and moves users to 'Universal' room
     */
    function deleteRoom(roomName) {
        var index = rooms.findIndex(room => room.name == roomName);
        rooms.splice(index, 1);
        var users = getRoomUsers(roomName);
        moveUsers(users, 'Universal');
    }

    /**
     * Moves users in users array to destination room
     */
    function moveUsers(users, destination) {
        users.forEach(user => {
            var userSocket = sockets[user.id];
            joinRoom(userSocket, destination, 'owner-left');
            user.room = destination;
        })
    }


    socket.on('newMessage', (message) => {
        var user = getCurrentUser(socket.id);
        console.log(user.room);
        io.to(user.room).emit('message', formatMessageResponse(user.name, message));
    })
})

/**
 * Format message object before sending the message data to the client-side
 */
function formatMessageResponse(user, message, type = "") {
    return {
        user: user,
        message: message,
        time: moment().format('h:mm a'),
        type: type
    }
}

function getCurrentUser(id) {
    var user = users.find(user => user.id === id);
    if (user != undefined) {
        return user;
    }
    else {
        return -1;
    }
}

function getUserID(name) {
    var user = users.find(user => user.name === name);
    if (user != undefined) {
        return user.id;
    }
    else {
        return -1;
    }
}

function getRoomOwner(roomName) {
    var room = rooms.find(room => room.name === roomName);
    return room.owner;
}

function getIndexOfRoom(roomName) {
    const index = rooms.findIndex(room => room.name === roomName);
    return index;
}

function getRoomPassword(roomName) {
    var room = rooms.find(room => room.name === roomName);
    return room.password;
}

function userLeave(id) {
    const index = users.findIndex(user => user.id === id);
    if (index != -1) {
        return users.splice(index, 1)[0];
    }
}

function getRoomUsers(room) {
    return users.filter(user => user.room == room);
}

function isRoomOwner(socketID, roomName) {
    if (socketID == getRoomOwner(roomName)) {
        return true;
    }
    return false;
}

function getUsersRooms(id) {
    return rooms.filter(room => room.owner == id);
}

function isRoomEditor(socketID, roomName) {
    if (rooms[getIndexOfRoom(roomName)].editors.includes(socketID)) {
        return true;
    }
    return false;
}

const port = 3456;

server.listen(process.env.PORT || port);

console.log("Running on http://localhost:" + port);