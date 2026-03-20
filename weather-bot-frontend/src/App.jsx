import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import './App.css';

function App() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { text: "Hi! I am your Weather Bot. Ask me about the weather in any city!", isBot: true }
  ]);
  const [sessionId, setSessionId] = useState('');
  
  // To automatically scroll to the bottom of the chat
  const messagesEndRef = useRef(null);

  // Generate a unique session ID when the app loads
  useEffect(() => {
    setSessionId(uuidv4());
  }, []);

  // Scroll to bottom whenever messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    // 1. Add user's message to the screen
    const userMessage = { text: input, isBot: false };
    setMessages((prevMessages) => [...prevMessages, userMessage]);
    
    const textToSend = input;
    setInput(''); // Clear the input box

    // 2. Send message to our Node.js Backend (We will build this next!)
    try {
      const response = await axios.post('http://localhost:8080/api/chat', {
        text: textToSend,
        sessionId: sessionId
      });

      // 3. Add bot's reply to the screen
      const botMessage = { text: response.data.reply, isBot: true };
      setMessages((prevMessages) => [...prevMessages, botMessage]);

    } catch (error) {
      // If backend is not running yet, show this error
      const errorMessage = { text: "Backend is offline! We need to build the Node.js server next.", isBot: true };
      setMessages((prevMessages) => [...prevMessages, errorMessage]);
    }
  };

  return (
    <div className="App">
      <div className="chat-container">
        <div className="chat-header">
          <h2>🌤️ Weather AI Bot</h2>
        </div>
        
        <div className="chat-messages">
          {messages.map((msg, index) => (
            <div key={index} className={`message-bubble ${msg.isBot ? 'bot' : 'user'}`}>
              {msg.text}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <form className="chat-input-area" onSubmit={sendMessage}>
          <input 
            type="text" 
            placeholder="Type a city name (e.g. Phnom Penh)..." 
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button type="submit">Send</button>
        </form>
      </div>
    </div>
  );
}

export default App;