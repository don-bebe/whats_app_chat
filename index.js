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

const optionsToIntent = {
  "Cancer Information": "Cancer Information Intent",
  "CAZ Services": "CAZ Services Intent",
  "Cope with Cancer": "Cope with Cancer Intent",
  "Cancer Research": "Cancer Research Intent",
  "About Us & Contact": "About Us & Contact Intent"
};

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

async function generateDialogflowResponse(userInput, sessionId) {
  try {
    const sessionPath = sessionClient.projectAgentSessionPath(
      credentials.project_id,
      sessionId
    );

    const intentName = optionsToIntent[userInput];

    if (intentName) {
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
    }

    const generalRequest = {
      session: sessionPath,
      queryInput: {
        text: {
          text: userInput,
          languageCode: "en",
        },
      },
    };

    const generalResponses = await sessionClient.detectIntent(generalRequest);
    return generalResponses[0]?.queryResult?.fulfillmentText || "Sorry, I couldn't find anything related to that.";
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
