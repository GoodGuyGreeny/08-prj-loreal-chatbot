export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Only POST requests are supported." }),
        { status: 405, headers: corsHeaders },
      );
    }

    let requestBody;
    try {
      requestBody = await request.json();
    } catch (error) {
      return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    if (!requestBody.messages || !Array.isArray(requestBody.messages)) {
      return new Response(
        JSON.stringify({ error: "Request must include a messages array." }),
        { status: 400, headers: corsHeaders },
      );
    }

    const apiKey = env.OPENAI_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "OpenAI API key is not configured." }),
        { status: 500, headers: corsHeaders },
      );
    }

    try {
      const openAiResponse = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o",
            messages: requestBody.messages,
            max_tokens: 500,
            temperature: 0.8,
          }),
        },
      );

      const data = await openAiResponse.json();

      if (!openAiResponse.ok) {
        return new Response(
          JSON.stringify({
            error: data.error?.message || "OpenAI request failed.",
          }),
          {
            status: openAiResponse.status,
            headers: corsHeaders,
          },
        );
      }

      const reply = data.choices?.[0]?.message?.content?.trim();
      return new Response(
        JSON.stringify({
          reply: reply || "Sorry, I could not complete your request.",
        }),
        { headers: corsHeaders },
      );
    } catch (error) {
      return new Response(
        JSON.stringify({ error: "Unable to reach the OpenAI service." }),
        { status: 502, headers: corsHeaders },
      );
    }
  },
};
