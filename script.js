const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const conversationEl = document.getElementById("conversation");
const typingIndicator = document.getElementById("typingIndicator");
const latestQuestionText = document.getElementById("latestQuestionText");
const latestAnswerText = document.getElementById("latestAnswerText");
const clearBtn = document.getElementById("clearBtn");

const WORKER_URL = window.WORKER_URL || "PASTE_YOUR_CLOUDFLARE_WORKER_URL_HERE";

if (!WORKER_URL || WORKER_URL === "PASTE_YOUR_CLOUDFLARE_WORKER_URL_HERE") {
  console.error(
    "Cloudflare Worker URL is not configured. Add your URL in secrets.js.",
  );
}

const STORAGE_KEY = "lorealBeautyChatHistory";

const systemMessage = {
  role: "system",
  content:
    "You are a L’Oréal beauty assistant. Only answer questions related to L’Oréal products, skincare, makeup, haircare, fragrance, beauty routines, and beauty recommendations. Politely refuse unrelated questions, and redirect the user back to beauty topics. Do not provide private inventory or medical diagnosis. For sensitive skin or serious scalp concerns, recommend consulting a qualified professional.",
};

const initialAssistantMessage = {
  role: "assistant",
  content:
    "Bonjour! I’m your L’Oréal Beauty Advisor. Ask me about skincare, makeup, haircare, fragrance, or beauty routines and I’ll recommend products and tips with a premium beauty focus.",
};

let conversationHistory = [];

function saveConversation() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(conversationHistory));
}

function loadConversation() {
  const saved = window.localStorage.getItem(STORAGE_KEY);

  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        conversationHistory = parsed;
        if (conversationHistory[0]?.role !== "system") {
          conversationHistory.unshift(systemMessage);
        }
        return;
      }
    } catch (error) {
      console.warn("Could not load saved conversation", error);
    }
  }

  conversationHistory = [systemMessage, initialAssistantMessage];
}

function createBubble(role, text) {
  const bubble = document.createElement("div");
  bubble.className = `message-bubble ${role}`;

  const label = document.createElement("span");
  label.className = "message-label";
  label.textContent = role === "user" ? "You" : "L’Oréal Advisor";

  const message = document.createElement("p");
  message.textContent = text;

  bubble.append(label, message);
  return bubble;
}

function renderConversation() {
  conversationEl.innerHTML = "";
  const displayMessages = conversationHistory.filter(
    (message) => message.role !== "system",
  );

  displayMessages.forEach((message) => {
    const bubble = createBubble(message.role, message.content);
    conversationEl.appendChild(bubble);
  });

  scrollToBottom();
}

function scrollToBottom() {
  conversationEl.scrollTop = conversationEl.scrollHeight;
}

function updateLatestPanel() {
  const lastUser = [...conversationHistory]
    .reverse()
    .find((item) => item.role === "user");
  const lastAssistant = [...conversationHistory]
    .reverse()
    .find((item) => item.role === "assistant");

  latestQuestionText.textContent = lastUser
    ? lastUser.content
    : "Start with your first beauty question to receive a recommendation.";

  latestAnswerText.textContent = lastAssistant
    ? lastAssistant.content
    : "Bonjour! I’m your L’Oréal Beauty Advisor. Ask me about skincare, makeup, haircare, fragrance, or beauty routines.";
}

function renderTypingIndicator(show) {
  typingIndicator.classList.toggle("hidden", !show);
  if (show) {
    scrollToBottom();
  }
}

function addMessage(role, text) {
  const messageObject = { role, content: text };
  conversationHistory.push(messageObject);
  const bubble = createBubble(role, text);
  conversationEl.appendChild(bubble);
  saveConversation();
  scrollToBottom();
}

function clearConversation() {
  conversationHistory = [systemMessage, initialAssistantMessage];
  saveConversation();
  renderConversation();
  updateLatestPanel();
}

function isBeautyRelatedQuestion(text) {
  const normalized = text.toLowerCase();
  const unrelatedPatterns =
    /\b(math|politics|football|soccer|basketball|baseball|movie|music|recipe|programming|javascript|python|code|computer|history|geography|weather|news|stock|crypto|insurance|bank|real estate|travel|economy|law|celebrity gossip|gaming|sports|science)\b/;
  return !unrelatedPatterns.test(normalized);
}

async function sendMessageToWorker() {
  try {
    const response = await fetch(WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages: conversationHistory }),
    });

    const data = await response.json();

    if (!response.ok) {
      const message = data?.error || "Network response was not ok.";
      throw new Error(message);
    }

    if (!data?.reply) {
      const message = data?.error || "The worker did not return a valid reply.";
      throw new Error(message);
    }

    addMessage("assistant", data.reply);
    updateLatestPanel();
  } catch (error) {
    const errorMessage =
      error?.message ||
      "I’m sorry, I couldn’t reach the beauty service right now.";
    addMessage(
      "assistant",
      `Sorry, the beauty service could not answer: ${errorMessage}`,
    );
    updateLatestPanel();
    console.error("Worker request failed:", error);
  } finally {
    renderTypingIndicator(false);
  }
}

async function handleSubmit(event) {
  event.preventDefault();
  const userText = userInput.value.trim();
  if (!userText) {
    return;
  }

  userInput.value = "";
  addMessage("user", userText);
  latestQuestionText.textContent = userText;
  latestAnswerText.textContent = "Waiting for your L’Oréal Beauty Advisor…";

  if (!isBeautyRelatedQuestion(userText)) {
    const refusal =
      "I’m here to help with L’Oréal beauty, skincare, makeup, haircare, fragrance, and routine questions. Let’s keep the conversation focused on beauty advice.";
    addMessage("assistant", refusal);
    updateLatestPanel();
    return;
  }

  if (!WORKER_URL || WORKER_URL === "PASTE_YOUR_CLOUDFLARE_WORKER_URL_HERE") {
    addMessage(
      "assistant",
      "The cosmetic assistant is not configured yet. Please add your Cloudflare Worker URL in secrets.js.",
    );
    updateLatestPanel();
    return;
  }

  renderTypingIndicator(true);
  await sendMessageToWorker();
}

chatForm.addEventListener("submit", handleSubmit);
clearBtn.addEventListener("click", clearConversation);

loadConversation();
renderConversation();
updateLatestPanel();

window.addEventListener("beforeunload", saveConversation);
