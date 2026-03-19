require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cors = require('cors');
const dialogflow = require('@google-cloud/dialogflow');

const app = express();
app.use(cors()); // Allows React to talk to this server
app.use(bodyParser.json());

// Setup Dialogflow Client
const sessionClient = new dialogflow.SessionsClient({
    keyFilename: './dialogflow-key.json' // Points to your downloaded key
});

// =================================================================
// CORE AI & WEATHER LOGIC (Used by both React and Facebook)
// =================================================================
async function processMessage(text, sessionId) {
    try {
        // 1. Send user text to Dialogflow
        const sessionPath = sessionClient.projectAgentSessionPath(process.env.GOOGLE_PROJECT_ID, sessionId);
        const request = {
            session: sessionPath,
            queryInput: { text: { text: text, languageCode: 'en-US' } }
        };

        const responses = await sessionClient.detectIntent(request);
        const result = responses[0].queryResult;
        const intentName = result.intent.displayName;
        
        let replyText = result.fulfillmentText; // Default Dialogflow reply

        // 2. If Dialogflow detects the user is asking for Weather
        if (intentName === 'Ask Weather') {
            // Extract the city name recognized by Dialogflow
            const city = result.parameters.fields['geo-city']?.stringValue;
            
            if (city) {
                // Fetch actual weather data from OpenWeatherMap
                const weatherUrl = `http://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&appid=${process.env.WEATHER_API_KEY}`;
                const weatherRes = await axios.get(weatherUrl);
                
                const temp = weatherRes.data.main.temp;
                const desc = weatherRes.data.weather[0].description;
                
                replyText = `🌤️ The current weather in ${city} is ${desc} with a temperature of ${temp}°C.`;
            } else {
                replyText = "Which city would you like to know the weather for?";
            }
        }
        return replyText;
    } catch (error) {
        console.error("Error processing AI/Weather:", error);
        return "Sorry, I am having trouble checking the weather right now. Check if the city name is correct!";
    }
}

// =================================================================
// REACT FRONTEND ROUTE
// =================================================================
app.post('/api/chat', async (req, res) => {
    const { text, sessionId } = req.body;
    const botReply = await processMessage(text, sessionId);
    res.json({ reply: botReply });
});

// =================================================================
// FACEBOOK MESSENGER ROUTES
// =================================================================
// 1. Webhook Verification (Facebook pings this to check your server)
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token === process.env.FB_VERIFY_TOKEN) {
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

// 2. Handle Incoming Messages from Facebook
app.post('/webhook', async (req, res) => {
    const body = req.body;
    
    // ADD THIS LINE RIGHT HERE:
    console.log("🔔 FACEBOOK JUST SENT SOMETHING: ", JSON.stringify(body, null, 2));
    
    if (body.object === 'page') {
        for (let entry of body.entry) {
            const webhook_event = entry.messaging[0];
            const sender_psid = webhook_event.sender.id; // The Facebook user's unique ID

            if (webhook_event.message && webhook_event.message.text) {
                const text = webhook_event.message.text;
                
                // Get AI/Weather reply
                const botReply = await processMessage(text, sender_psid);
                
                // Send reply back to Facebook
                await sendFacebookMessage(sender_psid, botReply);
            }
        }
        res.status(200).send('EVENT_RECEIVED');
    } else {
        res.sendStatus(404);
    }
});

// Helper function to send message back to Facebook
async function sendFacebookMessage(sender_psid, responseText) {
    const url = `https://graph.facebook.com/v18.0/me/messages?access_token=${process.env.FB_PAGE_ACCESS_TOKEN}`;
    const payload = {
        recipient: { id: sender_psid },
        message: { text: responseText }
    };
    try {
        await axios.post(url, payload);
    } catch (error) {
        console.error('Error sending FB message:', error.response?.data || error.message);
    }
}

// Start Server
app.listen(process.env.PORT, () => {
    console.log(`🚀 Server is running on port ${process.env.PORT}`);
});