async function listGeminiModels() {
  const models = [
    "gemini-2.5-flash",
    "gemini-1.5-flash",
    "gemini-1.5-flash-latest",
    "gemini-1.5-pro",
    "gemini-1.5-pro-latest",
    "gemini-2.0-flash-exp",
    "gemini-2.0-flash",
  ];

  console.log("Supported Gemini models test list:", models);
}

listGeminiModels();
