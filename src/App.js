import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

// Connect to backend socket.io server - update with your backend IP and port
const socket = io("https://chat-backend-k6v0.onrender.com");

function App() {
  const [status, setStatus] = useState('Connecting...');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [paired, setPaired] = useState(false);
  const messagesEndRef = useRef(null);

  // Scroll chat to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    // Socket event listeners
    socket.on('connect', () => {
      console.log('Connected to server:', socket.id);
      setStatus('Connected. Waiting to be paired...');
    });

    socket.on('waiting', () => {
      setStatus('Waiting for a partner...');
      setPaired(false);
      setMessages([]); // Clear old messages
    });

    socket.on('paired', () => {
      setStatus('You are now chatting with a stranger.');
      setPaired(true);
      setMessages([]); // Clear old messages on new pairing
    });

    socket.on('partner left', () => {
      setStatus('Stranger disconnected. Click "Find New Partner" to connect again.');
      setPaired(false);
    });

    socket.on('chat message', (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on('disconnect', (reason) => {
      console.log('Disconnected:', reason);
      setStatus('Disconnected from server.');
      setPaired(false);
    });

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      setStatus('Connection error. Check server.');
    });

    return () => {
      socket.off('connect');
      socket.off('waiting');
      socket.off('paired');
      socket.off('partner left');
      socket.off('chat message');
      socket.off('disconnect');
      socket.off('connect_error');
    };
  }, []);

  // Send message to backend
  const sendMessage = (e) => {
    e.preventDefault();
    if (message.trim() && paired) {
      socket.emit('chat message', message);
      setMessage('');
    }
  };

  // Find new partner (disconnect current, wait for next)
  const findNewPartner = () => {
    if (paired) {
      // Tell backend to disconnect current partner (simulate by disconnecting socket then reconnect)
      socket.disconnect();
      setTimeout(() => {
        socket.connect();
      }, 100);
      setStatus('Reconnecting and looking for a new partner...');
      setPaired(false);
      setMessages([]);
    } else {
      setStatus('Already waiting for a partner...');
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: 'auto', padding: 20 }}>
      <h2>🌐 Random Chat</h2>
      <p><b>Status:</b> {status}</p>

      <div
        style={{
          border: '1px solid gray',
          height: 300,
          overflowY: 'auto',
          padding: 10,
          marginBottom: 10,
          background: '#f9f9f9',
          whiteSpace: 'pre-wrap'
        }}
      >
        {messages.map((msg, idx) => (
          <div
            key={idx}
            style={{
              textAlign: msg.sender === 'you' ? 'right' : 'left',
              marginBottom: 5,
            }}
          >
            <span
              style={{
                display: 'inline-block',
                background: msg.sender === 'you' ? '#dcf8c6' : '#fff',
                padding: 8,
                borderRadius: 10,
                maxWidth: '70%',
                wordWrap: 'break-word',
                border: '1px solid #ccc',
              }}
            >
              {msg.text}
            </span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={sendMessage} style={{ display: 'flex', gap: 10 }}>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={paired ? "Say something..." : "Waiting to be paired..."}
          disabled={!paired}
          style={{ flex: 1, padding: 10 }}
          autoComplete="off"
        />
        <button type="submit" disabled={!paired} style={{ padding: '10px 20px' }}>
          Send
        </button>
      </form>

      <button
        onClick={findNewPartner}
        style={{ marginTop: 10, padding: '10px 20px', width: '100%' }}
      >
        Find New Partner
      </button>
    </div>
  );
}

export default App;
