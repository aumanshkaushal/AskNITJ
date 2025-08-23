import { generateResponse } from '../handlers/responseGenerator.js';
import { replyDM, getUserOverview } from '../lib/redditClient.js';

async function newDMProcessor(messages) {
  for (const message of messages) {
    try {
      console.log(`Processing DM ${message.id} from ${message.sender}: ${message.body.slice(0, 100)}...`);
      let response = await generateResponse(message, true, false, `This message is from u/${message.sender}`);
      while (response.action === 'query_user') {
        const username = response.text;
        console.log(`Querying user ${username} for DM ${message.id}`);
        const userData = await getUserOverview(username);
        const userContext = userData
          .map((item) => `${item.kind === 't3' ? 'Post' : 'Comment'} in r/${item.subreddit}: ${item.content}`)
          .join('\n');
        response = await generateResponse(message, true, false, `User ${username} context:\n${userContext}`);
      }
      if (response.action === 'reply' && response.text !== '0canthelpwiththisquery0') {
        await replyDM(message.id, response.text);
        console.log(`Sent DM response to ${message.sender}: ${response.text}`);
      } else {
        await replyDM(message.id, `I cannot help with this query.\n\n*I'm a bot*⋆.˚ ᡣ𐭩 .𖥔˚`);
        console.log(`Sent fallback response for DM ${message.id}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`Error processing DM ${message.id}:`, error.message);
    }
  }
}

export { newDMProcessor };