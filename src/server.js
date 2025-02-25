import WebSocket, { WebSocketServer } from 'ws';
import Express from 'express';
import session from 'express-session';

const wss = new WebSocketServer({ noServer: true });
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const createOrLoadUser = async (username) => {
    let user = await prisma.users.findFirst({
        where: {
            name: username
        },
    });
    if (!user) {
        user = await prisma.users.create({
            data: {
                name: username
            },
        });
    }
    return user;
};

const handleUsername = async (ws, req, data, messages) => {
    req.session.username=data.payload;
    const user = await createOrLoadUser(req.session.username);
    // TODO: make user online
    const updateUser = await prisma.users.update({
	where: {
	    id: user.id
	},
	data: {
	    online: 1
	}
    });
    let result = await Promise.all(messages.map(async m => {
	const likes = await prisma.likes.findMany({
	    where: {
		message_id: m.id
	    }
	});
	return {
	    username: m.users.name, 
	    id: m.id,
	    content: m.content,
	    likes: likes.length
	};
    }));

    ws.send(
	JSON.stringify({
 	    type: 'history',
	    messages: result
	})
    );
    
    return;
};

const handleLike = async (req, data) => {
    const user = await createOrLoadUser(req.session.username);
    try {
	await prisma.likes.create({
	    data: {user_id: user.id, message_id: data.payload}
	});
    } catch (e) {
    }
    const likes = await prisma.likes.findMany({
	where: {
	    message_id: data.payload
	}
    });
    wss.clients.forEach(client => {
	if (client.readyState === WebSocket.OPEN) {
            client.send(
		JSON.stringify({
		    type:'updateMessage',
		    likes: likes.length,
		    id: data.payload
		})
	    );
	}
    });
    return;
};

const handleNewMessage = async (req, data) => {
    const user = await createOrLoadUser(req.session.username);

    const newMessage = await prisma.messages.create({
        data: {
            content: data.payload,
	    user_id: user.id
        },
    });

    // Broadcast the message to all connected clients
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(
		JSON.stringify({
		    type:'message',
		    likes: 0,
		    id: newMessage.id,
		    username: user.name,
		    content: newMessage.content
		})
	    );
        }
    });
};
const handleClose = async (req) => {
    const user = await createOrLoadUser(req.session.username);
    const updateUser = await prisma.users.update({
	where: {
	    id: user.id
	},
	data: {
	    online: 0
	}
    });
    console.log('Client disconnected');
};

const handleUsers = async () => {
    const users = await prisma.users.findMany({});
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(
		JSON.stringify({
		    type:'users',
		    users: users.map(x => ({name: x.name, online: x.online}))
		})
	    );
        }
    });
};

const interval = setInterval(handleUsers, 10 * 1000);

wss.on('connection', async (ws, req) => {
    console.log('Client connected');
    const messages = await prisma.messages.findMany({
	include: {
	    users: true,
	},
	orderBy: { id: 'asc' }
    });

    if (!req.session.views) req.session.views = 0;
    ws.on('message', async message => {
        const data = JSON.parse(message);
	if (data.type==='username') {
	    return handleUsername(ws, req, data, messages);
	}

	if (data.type==='like') {
	    return handleLike(req, data);
	}

	return handleNewMessage(req, data);
    });

    ws.on('close', async () => {
	return handleClose(req);
    });
});

const app = Express();
const sessionHandler = session({
  secret: 'keyboard cat',
  resave: false,
  saveUninitialized: true
});
app.use(sessionHandler);

const server = app.listen(8080);
server.on('upgrade', (request, socket, head) => {
    sessionHandler(request, {}, () => {
	wss.handleUpgrade(request, socket, head, socket => {
	    wss.emit('connection', socket, request);
	});
    });
});
