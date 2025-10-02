# AI-Powered Interview Assistant

## Deploy Link

[Live Demo](https://ai-powered-interview-assistant-kappa.vercel.app/)

A web application that helps candidates practice interviews and allows interviewers to review performances.

## Features

- Resume parsing from PDF and DOCX files
- Timed Q&A with AI-generated questions
- Auto scoring and summary generation
- Simple dashboard for interviewers to review candidates
- Persistent state using localStorage

## Tech Stack

- React 18
- Vite
- Tailwind CSS
- React Router DOM
- PDF.js for PDF parsing
- Mammoth for DOCX parsing

## Installation

1. Clone the repository:
   ```bash
   git clone <repo-url>
   cd ai-interview
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

## Usage

- Visit the landing page and click "Start Practicing" to begin as a candidate.
- Upload your resume (PDF or DOCX).
- Confirm details and start the interview.
- Answer timed questions.
- Switch to "Interviewer" tab to view candidate results.


## Build

To build for production:
```bash
npm run build
```

To preview the build:
```bash
npm run preview
