# CSE330
464065

# Creative Portion

### Creative Feature 1
For the first creative feature, I implemented a feature which allows room creators to grant editor privileges to individual users. This can be done by navigating to the owner's room as the owner -> clicking an individual's name under 'Users in Current Room' container -> clicking 'Grant Editor Privileges'. This will give the individual the ability to kick and ban users from the current room. However, the user cannot ban the owner from his/her own room. 

### Creative Feature 2

For the second creative feature, I implemented a chat bot. The chat bot serves as a moderator for events that take place within the chatroom (logs when a user joins a room, has been kicked from a from a room, banned, etc...). In addition, the bot responds with data for several hard coded commands. To run the commands -> navigate to Universal room -> click on 'ChatApp Bot' under the 'Users in Current Room' tab -> direct message the bot one of the following commands...

1. /help - prints in users chat log the chatbot commands
2. /users - returns list of users currently in the chat app
3. /users [username] - returns details (ID, name, room) about the specific user with the username passed in.
4. /getRooms - returns list of users with what rooms they are currently in

### Creative Feature 3

Deployed application to Heroku : https://chatapp3456.herokuapp.com/
