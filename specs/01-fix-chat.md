## What's Good
- User can chat to models and it's working fine, I can add my API, select models, and chat. 
- The UI is fine but looks AI Generated
- Chat History Works Fine
- All chats are stored in database for particulr user working properly
- Search chat is also working fine

## What to improve
- Make the UI professional, like I have attached a image take inspiration from that
- Instead of hard-coding provider's model, fetch the available model list from the provider and display it in the UI. you will show 5 models(most used by user), if no data then any 5 random, and a More button on the bottom and when user clicks it it will show's the all provider model and user can choose any of it
- Similaraly for the provider choose option, you show top 5 providers: "Nvidia, Groq, OpenRouter, Gemini, Together AI"
- And if user has not configured the API key then he can chat but show him a warning notification in top left that you are using Server's API key, it often rate-limited, suggest to add his API key for better experience
- You can also use AI Generated Titles for chat, for that in start use AI to generate a title for the chat and show it in the sidebar just like ChatGPT
- Add more free providers (OpenRouter, Google, Together AI etc.)
- Improve the UI to make it looks natural not AI generated
- Add Light and Dark mode icon on top right