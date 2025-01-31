require("dotenv").config();
const express = require("express");
const axios = require("axios");
const OpenAI = require("openai");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
      const aiResponse = await generateAIResponse(text);
      await sendWhatsAppMessage(sender, aiResponse);
    }
  } catch (error) {
    console.error("Error handling message:", error.message);
  }

  res.sendStatus(200);
});

async function generateAIResponse(userInput) {
  try {
    const response = await openai.chat.completions.create({
      messages: [{ role: "user", content: userInput }],
      model: process.env.OPENAI_MODEL || "gpt-4o-2024-05-13",
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error("OpenAI Error:", error.message);
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
