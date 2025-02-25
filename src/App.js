import React, {
    useState,
    useEffect
} from 'react';

export const Login = () => {
    return (<div>Login</div>)
}
const handleUsers = (setUsers, users) => {
    setUsers(() => users);
}

const Chat = () => {
    const [messages, setMessages] = useState([]);
    const [ws, setWs] = useState(null);
    const [message, setMessage] = useState('');
    const [clientId, setClientId] = useState('');
    const [userName, setUsername] = useState(null);
    const [users, setUsers] = useState([]);

    let usernameTmp;
    
    useEffect(() => {
        const websocket = new WebSocket('ws://127.0.0.1:8080');

        websocket.onopen = () => {
            console.log('WebSocket is connected');
            // Generate a unique client ID
            const id = Math.floor(Math.random() * 1000);
            setClientId(id);
        };

        websocket.onmessage = (evt) => {
            const message = JSON.parse(evt.data);

	    if (message.type === 'message') {
		setMessages((prevMessages) =>
                    [...prevMessages, message]);
	    }
	    if (message.type === 'history') {
		setMessages((prevMessages) =>
                    [...message.messages]);
	    }
	    if (message.type === 'users') {
		return handleUsers(setUsers, message.users);
	    }
	    if (message.type === 'updateMessage') {
		setMessages((prevMessages) => {
		    const el = prevMessages.find(x => x.id === message.id)
		    el.likes = message.likes;
                    return [...prevMessages]
		});

	    }
        };

        websocket.onclose = () => {
            console.log('WebSocket is closed');
        };

        setWs(websocket);

        return () => {
            websocket.close();
        };
    }, []);

    const sendMessage = () => {
        if (ws) {
            ws.send(JSON.stringify({
                type: 'message',
                payload: message,
                clientId: clientId
            }));
            setMessage('');
        }
    };

    const handleInputChange = (event) => {
        setMessage(event.target.value);
    };

    const handleUsernameChange = (event) => {
	const name = event.target.value;
	usernameTmp = name;
    }
    
    const setUsernameClick = (event) => {
	const el = document.getElementById('username')
	setUsername(usernameTmp);
        if (ws) {
            ws.send(JSON.stringify({
                type: 'username',
                payload: usernameTmp,
                clientId: clientId
            }));
        }
    }

    const handleLike= (event) => {
        if (ws) {
            ws.send(JSON.stringify({
                type: 'like',
                payload: parseInt(event.target.dataset.id),
                clientId: clientId
            }));
        }
    }

    if (!userName) return (<div><label>Username:<input id="username" type="text" name="username" onChange={handleUsernameChange} /></label><button onClick={setUsernameClick} >Start</button></div>);

    return (
	<div>
	    <div>
	    {messages.map((message, index) =>
		<p key={index}>{message.username} wrote: {message.content} <button data-id={message.id} onClick={handleLike}>{message.likes} Like</button></p>)}
	    <input type="text" name="message" onChange={handleInputChange}></input>
		<button className="square" onClick={sendMessage}>send</button>
	    </div>
	    <div>
		Online Users:
		<ul>
		    {users.filter(x=>x.online).map((user, index) => <li key={index}>{user.name}</li>)}
		</ul>
		Offline Users:
		<ul>
		    {users.filter(x=>!x.online).map((user, index) => <li key={index}>{user.name}</li>)}
		</ul>
	    </div>
	</div>
    );
  }

export default Chat;
