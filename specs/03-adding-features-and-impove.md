## What is good after 01-fix-chat.md
- UI is impoved I like it although some change needed
- Now it fetches the model list from the provider and showing all models (although TogetherAI does not worked)
- Warning notification works well
- AI generates title after 1 prompt works
- Dark and Light mode works well

## What to improve
- You have created the API keys adding page as the settings page which is not good
- Inside settings there will be Manage API's Button where user can select a provider and add its API beacuse setting contains more things in future like Usage, Analytics, etc
- when I click the model name it shows me providers and below it the selected provider models with show all button, instead I wanted Provider name>its model and we can click on both if we click in Provider name it shows us provider list with show all (n) providers and a little search bar, similaraly all the models of that provider will be fetched and its model will be selected automatically user can click on model name and choose any model
- when I chat and when AI reponse their will only the chat text shown of me and AI, you can add AI and user icon in left and right of it to make it looks more good, I have attached a chat reference of  another chatbot take inspiration from that
- You can also parallay generate AI Chat Title with the particular model whom user started chatting

## What to add and and fix
- The Models that are fetched are of not only text to text but also image gen models and others, and some are thinking model which will alawys think <think> thing so add for that, that it wil show "Thinking" when it generating response and user can click down arrow to show thinking just like in other chatbots, and if user choose an image gen model, paid model then after it chat show him error (but if piad model works no error from API means it is paid API  and then its OK)
- Remove TogetherAI provider for now
- Do proper formatting of md beacuse AI reponse in Md format, if it codes show a code block and a copy icon also,
- You have just added a file icon in the input area for model if it supports file or image upload, but it is not woking, implement this logic also
- ALso add web search icon in the input ara and when it enabled it will fetch web for particulr query and give the seach to AI and then it respond