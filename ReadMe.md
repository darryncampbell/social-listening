# Social Listening

RSS feed aggregator with AI-powered response generation.

## Requirements

- Node.js 18+
- OpenAI API key

## Setup

```bash
npm install
```

## Run (Development)

```bash
npm run dev
```

Open http://localhost:3000

## Run (Production)

```bash
npm run build
npm start
```

## Configuration

1. Click the cog icon to open the configuration page
2. Add your OpenAI API key (stored securely in HTTP-only cookie)
3. Add RSS feed URLs with titles
4. Click "Done" to return to the home page

## Usage

- Click "Sync" to fetch RSS entries
- Entries are categorized: To Process, Done, Ignored
- Use "Generate Article Response" or "Generate Comment Response" to create AI replies
- Copy responses to clipboard with the Copy button
- Mark entries as Done or Ignored to organize

## Notes

- Reddit URLs with `/c/` are treated as comments
- AI responses are cached in localStorage
- Rate limits: 30 proxy requests/min, 10 AI generations/min
