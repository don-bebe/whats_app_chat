require("dotenv").config();
const express = require("express");
const axios = require("axios");
const dialogflow = require("@google-cloud/dialogflow");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const CREDENTIALS_PATH = path.join(__dirname, "dialogflow-credentials.json");
const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));

const sessionClient = new dialogflow.SessionsClient({ credentials });

app.get("/whatsapp/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (
    mode === "subscribe" &&
    token === process.env.WHATSAPP_CLOUD_API_VERIFICATION
  ) {
    console.log("Webhook Verified");
    return res.send(challenge);
  }
  return res.status(403).send("Verification Failed");
});

app.post("/whatsapp/webhook", async (req, res) => {
  try {
    const message = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!message) return res.sendStatus(200);

    const sender = message.from;
    const text = message.text?.body;

    if (text) {
      const aiResponse = await generateDialogflowResponse(text, sender);
      await sendWhatsAppMessage(sender, aiResponse);
    }
  } catch (error) {
    console.error("Error handling message:", error.message);
  }

  res.sendStatus(200);
});

async function handleUserInput(userInput, sessionId){
  let responseText = "";

  switch(userInput.toLowerCase()){
    case "start":
    case "hello":
    case "hi":
    case "hey":
    case "wassup":
      responseText = await generateDialogflowResponse("Default Welcome Intent", sessionId);
      responseText = await sendMenuWithButtons(sessionId);
      break;

    case "1":
      responseText = await generateDialogflowResponse("Cancer Information", sessionId);
      break;

    case "2":
      responseText = await generateDialogflowResponse("CAZ Services", sessionId);
      break;

    case "3":
      responseText = await generateDialogflowResponse("Cope with Cancer", sessionId);
      break;

    case "4":
      responseText = await generateDialogflowResponse("Cancer Research", sessionId);
      break;

    case "5":
      responseText = await generateDialogflowResponse("About Us & Contact", sessionId);
      break;
    case "6":
      responseText = "Thank you for using our service! Have a great day. 😊";
      break;

    case "menu":
      responseText = await sendMenuWithButtons(sessionId);
      break;

    default:
      responseText = "❌ Invalid option. Type 'menu' to see available options.";
  }
  return responseText;
}

async function sendMenuWithButtons(sessionId){
  const menuText = "Cancer Association of Zimbabwe";
  const imageUrl = "/logo.png";

  const buttons = [
    { type: "reply", reply: { id: "1", title: "Cancer Information" } },
    { type: "reply", reply: { id: "2", title: "CAZ Services" } },
    { type: "reply", reply: { id: "3", title: "Cope with Cancer" } },
    { type: "reply", reply: { id: "4", title: "Cancer Research" } },
    { type: "reply", reply: { id: "5", title: "About Us & Contact" } },
    { type: "reply", reply: { id: "6", title: "Exit" } },
  ];

  const message = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: sessionId,
    type: "interactive",
    interactive: {
      type: "button",
      header: {
        type: "image",
        image: { link: imageUrl },
      },
      body: { text: menuText },
      footer: { text: "Choose an option" },
      action: { buttons: buttons },
    },
  };

  try{
    const url = `https://graph.facebook.com/${process.env.WHATSAPP_CLOUD_VERSION}/${process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID}/messages`;
    const response = await axios.post(url, message, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.WHATSAPP_CLOUD_ACCESS_TOKEN}`,
      },
    });
    console.log("Menu sent:", response.data);
  } catch (error) {
    console.error("WhatsApp API Error:", error.response?.data || error.message);
  }

  return "Menu sent with options!";
}

async function generateDialogflowResponse(userInput, sessionId) {
  try {
    const sessionPath = sessionClient.projectAgentSessionPath(
      credentials.project_id,
      sessionId
    );

    const request = {
      session: sessionPath,
      queryInput: {
        text: {
          text: userInput,
          languageCode: "en",
        },
      },
    };

    const responses = await sessionClient.detectIntent(request);
    return responses[0]?.queryResult?.fulfillmentText || "I didn't understand that.";
  } catch (error) {
    console.error("Dialogflow Error:", error.message);
    return "Sorry, I am unable to respond at the moment.";
  }
}

async function sendWhatsAppMessage(to, message) {
  const url = `https://graph.facebook.com/${process.env.WHATSAPP_CLOUD_VERSION}/${process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID}/messages`;

  const data = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: { body: message },
  };

  try {
    const response = await axios.post(url, data, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.WHATSAPP_CLOUD_ACCESS_TOKEN}`,
      },
    });
    console.log("Message sent:", response.data);
  } catch (error) {
    console.error("WhatsApp API Error:", error.response?.data || error.message);
  }
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
