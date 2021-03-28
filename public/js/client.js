const chatForm = document.getElementById('new-message-form');
const newRoomFrom = document.getElementById('new-room-form');
const roomName = document.getElementById('room-name');
const usersList = document.getElementById('users');
const users = document.getElementById('rooms');
const userNameContainer = document.getElementById('username');

const modal = document.getElementById('modal-buttons');
const kickButton = document.getElementById('kick');
const banButton = document.getElementById('ban');
const dmButton = document.getElementById('dm');
const grantButton = document.getElementById('grant');

const chat = document.getElementById('chat');

const username = Qs.parse(location.search, {
    ignoreQueryPrefix: true
});

/**
 * Displays username to DOM
 */
userNameContainer.innerHTML = username.user;

const socket = io();

/**
 * Emits new user on connection
 */
socket.emit('newUser',
    {
        name: username.user,
        room: 'Universal'
    });

socket.on('message', (object) => {
    messageToDOM(object);
});

socket.on('errorMessage', (data) => {
    alert(data);
})

socket.on('roomUsers', ({ room, users }) => {
    roomNameToDOM(room);
    roomMembersToDOM(users);
});

socket.on('ownerPrivileges', (data) => {
    console.log(data.isOwner);
    if (data.isOwner) {
        kickButton.style.display = "block";
        banButton.style.display = "block";
        grantButton.style.display = "block";
    }
    else if (data.isEditor) {
        kickButton.style.display = "block";
        banButton.style.display = "block";
    }
    else {
        kickButton.style.display = "none";
        banButton.style.display = "none";
        grantButton.style.display = "none";
    }
})

socket.on('updateRooms', ({ rooms }) => {
    roomsToDOM(rooms);
})

socket.on('joinRoomResponse', (response) => {
    if (response != 200) {
        var password = prompt(`What is the password to join ${response}`);
        socket.emit('passwordResponse', {
            password: password,
            name: response
        })
    }
})

/**
 * Take in an array of rooms and displays the to users in the DOM. Adds event listeners to each room li
 */
function roomsToDOM(rooms) {
    users.innerHTML = `${rooms.map(room => `<li class=\"${room.passwordProtected}\"data-roomName=\"${room.name}\" data-pwd=\"${room.passwordProtected}\">${room.name}<br>Created by ${room.ownerName}</li>`).join('')}`
    var rooms = users.childNodes;
    for (var i = 0; i < rooms.length; ++i) {
        var li = rooms[i];
        li.addEventListener('click', (event) => {
            socket.emit('joinRoomRequest', {
                name: event.target.dataset.roomname,
                passwordProtected: event.target.dataset.pwd
            })
        }, false);
    }
}


/**
 * Listens for new message, emits message to user's room
 */
chatForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const message = event.target.elements.message;
    // Emits message to server
    socket.emit('newMessage', message.value);

    // Clears input from message from
    message.value = "";
    message.focus();

});

/**
 * Listens to create New Room From
 */
newRoomFrom.addEventListener('submit', (event) => {
    event.preventDefault();
    var roomName = event.target.elements.newRoom;
    var pp = event.target.elements.pwdProtected;
    var password = "";

    if (pp.checked) {
        password = prompt('Please Enter Password');
    }

    socket.emit('newRoom', {
        name: roomName.value,
        passwordProtected: pp.checked,
        password: password
    })

    roomName.value = "";
    pp.checked = false;

})

/**
 * Listens for when direct message button has been clicked
 */
dmButton.addEventListener('click', (event) => {
    var receiver = event.target.dataset.receiver;
    console.log("Message being sent to " + receiver);
    var message = prompt("What would you like to send?");
    socket.emit('dmRequest', {
        sender: userNameContainer.innerHTML,
        receiver: receiver,
        message: message
    })
}, false);

/**
 * Listens for when kick button has been clicked
 */
kickButton.addEventListener('click', (event) => {
    var victim = event.target.dataset.victim;
    if (victim == username) {
        alert("You cannot kick yourself!");
    }
    else {
        console.log("kicking user ... " + victim);
        socket.emit('kickRequest', {
            victim: victim,
        })
    }
}, false);

/**
 * Listens for when ban button has been clicked
 */
banButton.addEventListener('click', (event) => {
    var victim = event.target.dataset.victim;
    if (victim == username.user) {
        alert("You cannot ban yourself!");
    }
    else {
        console.log("banning user ... " + victim);
        socket.emit('banRequest', {
            victim: victim
        })
    }
}, false);

/**
 * Listens for when grant privileges button has been clicked
 */
grantButton.addEventListener('click', (event) => {
    var user = event.target.dataset.user;
    if (user == username.user) {
        alert('You are the current owner!');
    }
    else {
        socket.emit('grantPrivRequest', {
            user : user,
        })
    }
} )

/**
 * Takes in message object and displays it to DOM
 */
function messageToDOM(object) {
    var messageContainer = document.createElement('div');
    messageContainer.classList.add('message');
    messageContainer.innerHTML = `<p class=\"meta\">${object.user} | ${object.time}</p><p class="text">${object.message}</p>`
    if (object.user == username.user){
        messageContainer.classList.add('me');
    }
    if (object.type == "dm"){
        messageContainer.classList.add('dm');
    }
    document.getElementById('chat').appendChild(messageContainer);
    scrollBottom();
}

/**
 * Takes in room name and displays it to DOM
 */
function roomNameToDOM(room) {
    roomName.innerHTML = room;
}

/**
 * Takes in array of users and displays list of users to the DOM
 */
function roomMembersToDOM(users) {
    usersList.innerHTML = `${users.map(user => `<li data-toggle="modal" data-target="#myModal">${user.name}</li>`).join('')}`
    addListenerToNames();
}

/**
 * Adds event listeners to the individual names in the names list
 */
function addListenerToNames() {
    var members = usersList.children;
    console.log(members);
    for (var i = 0; i < members.length; ++i) {
        members[i].addEventListener('click', (event) => {
            var name = event.target.innerHTML;
            console.log(name);
            dmButton.dataset.receiver = name;
            banButton.dataset.victim = name;
            kickButton.dataset.victim = name;
            grantButton.dataset.user = name;
        }, false);
    }
}

function clearChatLog() {
    chat.innerHTML = "";
};

function scrollBottom() {
    var messageBody = document.getElementById('chat');
    messageBody.scrollTop = messageBody.scrollHeight;
}