# Jeopardy Trivia

An interactive, Jeopardy-style trivia web application built with Next.js, React, Tailwind CSS, Framer Motion, and Zustand.

## Features

- **JSON Upload** — Upload a custom `.json` game file from the home page
- **Dynamic Game Board** — Categories and point values rendered from your data
- **Question Modal** — Full-screen reveal flow with Framer Motion animations
- **Scoreboard** — Add teams and adjust scores with `[+]` / `[−]` buttons
- **Persistent State** — Game progress and scores survive page refreshes

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and upload a JSON file. A sample game is included at `public/sample-game.json`.

## JSON Schema

```json
{
  "title": "Game Title",
  "categories": [
    {
      "name": "Category Name",
      "questions": [
        {
          "value": 100,
          "question": "Your question here?",
          "answer": "The answer"
        }
      ]
    }
  ]
}
```

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
├── components/
│   ├── board/              # Game board grid & tiles
│   ├── game/               # Game page layout
│   ├── modal/              # Question modal overlay
│   ├── scoreboard/         # Team score management
│   └── upload/             # JSON upload screen
├── lib/                    # Validation utilities
├── store/                  # Zustand game state
└── types/                  # TypeScript interfaces
```

## Tech Stack

- [Next.js 15](https://nextjs.org/)
- [React 19](https://react.dev/)
- [Tailwind CSS 4](https://tailwindcss.com/)
- [Framer Motion](https://www.framer.com/motion/)
- [Zustand](https://zustand-demo.pmnd.rs/)
